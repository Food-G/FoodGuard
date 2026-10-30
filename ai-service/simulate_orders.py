"""
발주 시뮬레이션 — 같은 실제 수요 이력에 관행 발주 규칙과 FoodGuard 발주를 각각 흘려 폐기량·품절량을 비교한다
(Huber et al. 2019 의 평가 설계: 예측 정확도가 아니라 폐기·품절 비용으로 발주 방법을 평가).

    python simulate_orders.py --synthetic   # 합성 매장 1곳 (DB 불필요)
    python simulate_orders.py --db          # SALES_DATA·레시피 실데이터 (읽기 전용, 약 5분)

정책은 발주 구조가 모두 같고 예측값만 다르다. 백엔드 OrderRequestService.recommend() 와 같은 규칙:
  발주량 = max(0, 책임 기간 안의 식자재 필요량 − 현재 재고 − 진행 중 발주)
  책임 기간 = 리드타임 − 1 + min(발주 주기, 보관기한) 일
- FoodGuard: 그 발주일까지의 이력으로 글로벌 모델을 학습해 메뉴 추천 발주량(점추정 × 식자재 conformal 보정 비율)을 레시피로 합산
- 관행 규칙: 메뉴마다 '지난주 같은 요일 판매량 × (1 + 여유율)'
- 요일 평균(4주): 단순 통계 베이스라인 (backtest.py 와 같은 정의)
재고는 입고 로트별로 보관기한까지 쓸 수 있고, 먼저 상하는 로트부터 쓴다(FIFO). 기한을 넘긴 잔량은 폐기,
그날 재고로 못 채운 수요는 품절. 수요는 실제 판매량 × 레시피 사용량이다.

가정·한계
- 보관기한·리드타임·발주 주기는 아래 SCENARIOS 로 가정한다 (INGREDIENT 에 값이 아직 없음). 전 식자재 공통
- 판매량을 수요로 쓴다. 품절일 판매량은 실제 수요보다 작을 수 있다 (모든 정책에 같은 조건)
- 휴무일(판매 없는 날)은 미리 안다고 보고 필요량에서 뺀다
- 날씨 피처는 넣지 않는다 (backtest.py 와 같은 이유)
- 시뮬레이션 끝에 남은 재고는 폐기로 세지 않는다
- 보정 비율은 매주 월요일 기준 7일 구간(매장별 최근 4개)으로 구한다. 운영은 영업일 7일 간격이라 시점이 조금 다르다
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd

from backtest import SeriesKey, baselines, db_series, store_totals, synthetic_series
from config import settings
from ml.calibration import CALIBRATION_WEEKS, MIN_HISTORY, Recipes, conformal_quantile, usage_ratios, window_sums
from ml.demand_predictor import DemandPredictor

HORIZON = settings.PREDICTION_DAYS
# 발주일 격자의 기준일 (월요일). 매장끼리 발주일이 같아야 같은 날 학습한 모델을 함께 쓸 수 있다
EPOCH = date(2026, 1, 5)
RULE_MARGINS = (0.0, 0.1, 0.2)
FOODGUARD = "FoodGuard (안전재고 포함)"
# 폐기 1단위의 손실 = 식자재 원가 1, 품절 1단위의 손실 = 놓친 마진 = (1 − COST_RATIO) / COST_RATIO
SHORTAGE_COST = (1 - settings.COST_RATIO) / settings.COST_RATIO


@dataclass(frozen=True)
class Scenario:
    name: str
    lead_time: int  # 발주 후 입고까지 일수 (다음날 = 1)
    cycle: int  # 발주 간격 일수
    shelf_life: int  # 입고일 포함 사용 가능 일수

    @property
    def coverage(self) -> int:
        return self.lead_time - 1 + min(self.cycle, self.shelf_life)


SCENARIOS = [
    Scenario("주 1회 발주 · 보관 7일 (장류·냉동)", 1, 7, 7),
    Scenario("3일마다 발주 · 보관 4일 (육류·두부)", 1, 3, 4),
    Scenario("2일마다 발주 · 보관 3일 (엽채류)", 1, 2, 3),
]


def simulate_ingredient(
    demand: dict[date, float],
    required: dict[date, float],
    start: date,
    end: date,
    lead_time: int,
    shelf_life: int,
) -> dict[str, float]:
    """
    식자재 1개의 일별 재고 흐름. required = {발주일: 책임 기간 필요량}.
    start(첫 발주일) + 리드타임 전의 수요는 첫 입고 전이라 세지 않는다.
    """
    lots: list[list] = []  # [마지막 사용 가능일, 잔량], 마지막 사용 가능일 순
    pending: list[tuple[date, float]] = []  # (입고일, 수량)
    count_from = start + timedelta(days=lead_time)
    out = {"demand": 0.0, "received": 0.0, "waste": 0.0, "short": 0.0}
    d = start
    while d <= end:
        for arrive, qty in [p for p in pending if p[0] == d]:
            lots.append([d + timedelta(days=shelf_life - 1), qty])
            out["received"] += qty
        pending = [p for p in pending if p[0] != d]
        lots.sort(key=lambda lot: lot[0])

        need = demand.get(d, 0.0) if d >= count_from else 0.0
        out["demand"] += need
        for lot in lots:
            take = min(lot[1], need)
            lot[1] -= take
            need -= take
        out["short"] += need

        out["waste"] += sum(q for last, q in lots if last <= d)
        lots = [lot for lot in lots if lot[0] > d and lot[1] > 0]

        if d in required:
            # 백엔드와 같이 재고는 유통기한과 관계없이 전량 차감한다
            stock = sum(q for _, q in lots) + sum(q for _, q in pending)
            qty = max(0.0, required[d] - stock)
            if qty > 0:
                pending.append((d + timedelta(days=lead_time), qty))
        d += timedelta(days=1)
    return out


class ModelCache:
    """발주일·보정 시점마다 '그날까지의 이력으로 학습한 글로벌 모델'. 매장·시나리오가 같은 날이면 함께 쓴다."""

    def __init__(self, series: dict[SeriesKey, pd.DataFrame], recipes: Recipes):
        self.series = series
        self.recipes = recipes
        self._models: dict[date, DemandPredictor] = {}
        self._ratios: dict[tuple[date, int], list[float]] = {}

    def model(self, d: date) -> DemandPredictor:
        if d not in self._models:
            past = {k: df[df["ds"] <= d] for k, df in self.series.items()}
            self._models[d] = DemandPredictor().fit({k: df for k, df in past.items() if len(df) > 0})
        return self._models[d]

    def _ratios_at(self, o: date, sid: int) -> list[float]:
        if (o, sid) not in self._ratios:
            sums = window_sums(self.model(o), self.series, sid, o)
            self._ratios[(o, sid)] = usage_ratios(
                {m: s[0] for m, s in sums.items()}, {m: s[1] for m, s in sums.items()}, self.recipes
            )
        return self._ratios[(o, sid)]

    def safety_factor(self, d: date, open_days: dict[int, list[date]]) -> float:
        """d 이전에 끝난 주간 구간(월요일 시작) 매장별 최근 CALIBRATION_WEEKS 개의 식자재 비율 분위수."""
        scores: list[float] = []
        for sid, days in open_days.items():
            o = d - timedelta(days=HORIZON + (d - EPOCH).days % 7)
            for _ in range(CALIBRATION_WEEKS):
                if sum(1 for x in days if x <= o) < MIN_HISTORY:
                    break
                scores += self._ratios_at(o, sid)
                o -= timedelta(days=7)
        q = conformal_quantile(scores, self.model(d).critical_fractile)
        return q if q is not None else 1.0


def menu_forecasts(
    cache: ModelCache,
    sid: int,
    d: date,
    targets: list[date],
    open_days: dict[int, list[date]],
) -> dict[str, dict[int, float]]:
    """발주일 d 에 정책별로 본 메뉴별 책임 기간 판매량 합계 {정책: {menu_id: 수량}}."""
    past = {k: df[df["ds"] <= d] for k, df in cache.series.items() if k[0] == sid}
    past = {k: df for k, df in past.items() if len(df) > 0 and k[1] in cache.recipes}
    if not past:
        return {}
    total = store_totals(past)[sid]
    model = cache.model(d)
    model.safety_factor = cache.safety_factor(d, open_days)

    out: dict[str, dict[int, float]] = defaultdict(dict)
    for (_, mid), train in past.items():
        base = baselines(train, targets, total)
        preds = {p["date"]: p for p in model.predict(sid, mid, days=HORIZON, start_date=d)}
        out[FOODGUARD][mid] = float(sum(preds[t]["recommended_order_qty"] for t in targets))
        out["FoodGuard (안전재고 없음)"][mid] = float(sum(preds[t]["predicted_qty"] for t in targets))
        out["요일 평균(4주)"][mid] = float(sum(base["요일 평균(4주)"][t] for t in targets))
        for m in RULE_MARGINS:
            out[f"관행: 지난주 × {1 + m:.1f}"][mid] = float(sum(base["계절 나이브"][t] for t in targets)) * (1 + m)
    return out


def run_store(cache: ModelCache, sid: int, sc: Scenario, open_days: dict[int, list[date]]) -> list[dict]:
    """한 매장·한 시나리오에서 정책별·식자재별 폐기·품절 합계."""
    days = open_days[sid]
    if len(days) <= MIN_HISTORY:
        return []
    last = days[-1]
    order_days = []
    d = days[MIN_HISTORY - 1]
    while d + timedelta(days=sc.coverage) <= last:
        if (d - EPOCH).days % sc.cycle == 0:
            order_days.append(d)
        d += timedelta(days=1)
    if not order_days:
        return []

    demand: dict[int, dict[date, float]] = defaultdict(lambda: defaultdict(float))  # 식자재 -> 날짜 -> 사용량
    for (s, mid), df in cache.series.items():
        if s == sid:
            for ing, per_unit in cache.recipes.get(mid, []):
                for ds, y in zip(df["ds"], df["y"]):
                    demand[ing][ds] += y * per_unit

    required: dict[str, dict[int, dict[date, float]]] = defaultdict(lambda: defaultdict(dict))  # 정책 -> 식자재 -> 발주일
    open_set = set(days)
    for d in order_days:
        targets = [t for t in (d + timedelta(days=h) for h in range(1, sc.coverage + 1)) if t in open_set]
        for policy, qty in menu_forecasts(cache, sid, d, targets, open_days).items():
            for mid, q in qty.items():
                for ing, per_unit in cache.recipes[mid]:
                    required[policy][ing][d] = required[policy][ing].get(d, 0.0) + q * per_unit

    rows = []
    for policy, by_ing in required.items():
        for ing, req in by_ing.items():
            r = simulate_ingredient(demand[ing], req, order_days[0], last, sc.lead_time, sc.shelf_life)
            if r["demand"] > 0:
                rows.append({"policy": policy, "store": sid, "ingredient": ing, **r})
    return rows


def report(rows: list[dict], sc: Scenario) -> None:
    r = pd.DataFrame(rows)
    r["waste_rate"] = r["waste"] / r["demand"] * 100
    r["short_rate"] = r["short"] / r["demand"] * 100
    r["cost"] = r["waste_rate"] + SHORTAGE_COST * r["short_rate"]
    n = len(r) // r["policy"].nunique()
    print(f"\n### {sc.name} (리드타임 {sc.lead_time}일, 책임 기간 {sc.coverage}일) — 매장×식자재 {n}개\n")
    print("| 정책 | 폐기율 | 품절률 | 비용 지수 | 폐기율 (관행 ×1.1 대비) |")
    print("|---|---|---|---|---|")
    g = r.groupby("policy", sort=False)[["waste_rate", "short_rate", "cost"]].mean()
    ref = g.loc["관행: 지난주 × 1.1", "waste_rate"]
    for policy, v in g.iterrows():
        change = (v["waste_rate"] / ref - 1) * 100 if ref > 0 else float("nan")
        print(f"| {policy} | {v['waste_rate']:.1f}% | {v['short_rate']:.1f}% | {v['cost']:.1f} | {change:+.0f}% |")


def run(series: dict[SeriesKey, pd.DataFrame], recipes: Recipes) -> None:
    series = {k: df.sort_values("ds").reset_index(drop=True) for k, df in series.items()}
    recipe_stores = sorted({sid for sid, mid in series if mid in recipes})
    open_days: dict[int, list[date]] = {}
    for sid in recipe_stores:
        open_days[sid] = sorted({d for (s, _), df in series.items() if s == sid for d in df["ds"]})

    cache = ModelCache(series, recipes)
    print(f"레시피 있는 매장 {len(recipe_stores)}곳, 품절 비용 = 폐기 비용 × {SHORTAGE_COST:.2f} (COST_RATIO {settings.COST_RATIO})")
    for sc in SCENARIOS:
        rows = [row for sid in recipe_stores for row in run_store(cache, sid, sc, open_days)]
        if rows:
            report(rows, sc)
    print(
        "\n폐기율·품절률: 매장×식자재마다 폐기량·품절량을 그 식자재 총수요로 나눈 평균 (단위가 kg·L·개로 섞여 있어 비율 평균)."
        f"\n비용 지수 = 폐기율 + {SHORTAGE_COST:.2f} × 품절률 (식자재 원가 기준, 뉴스벤더 비용과 같은 비율). 낮을수록 좋다"
    )


def synthetic_store() -> tuple[dict[SeriesKey, pd.DataFrame], Recipes]:
    """합성 매장 1곳: 규모가 다른 메뉴 3개 (backtest.synthetic_series 의 패턴) + 식자재 3개 레시피."""
    series = {}
    for mid, (seed, scale) in enumerate([(1, 1.0), (2, 0.5), (3, 2.0)], start=1):
        df = synthetic_series(seed=seed)
        df["y"] = np.round(df["y"] * scale)
        df["sold_out"] = 0
        series[(0, mid)] = df
    recipes = {1: [(1, 0.2), (2, 1.0)], 2: [(1, 0.1)], 3: [(2, 2.0), (3, 0.15)]}
    return series, recipes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--synthetic", action="store_true", help="합성 매장 1곳 (메뉴 3개, 200일)")
    src.add_argument("--db", action="store_true", help="DB SALES_DATA·레시피의 레시피 있는 매장")
    args = parser.parse_args()
    run(*(synthetic_store() if args.synthetic else db_series()))


if __name__ == "__main__":
    main()
