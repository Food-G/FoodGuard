"""
rolling-origin 백테스트 — 글로벌 DemandPredictor와 베이스라인 4종을 같은 조건에서 비교한다.

    python backtest.py --synthetic            # 합성 데이터 (DB 불필요)
    python backtest.py --db [--store 60005]   # SALES_DATA 실데이터 (읽기 전용)
    python backtest.py --db --cold-start      # 신메뉴(이력 1·3·5일) 예측 비교
    python backtest.py --db --compare         # Prophet·LSTM 비교 실험 추가 (requirements-experiment.txt)

각 예측 시점(origin)마다 그날까지의 이력만으로 학습하고 다음 7일을 예측해 실제 판매량과 비교한다.
글로벌 모델은 시점마다 그날까지의 전체 매장×메뉴 이력으로 한 번 학습해 그 시점의 메뉴들을 예측한다
(--store 는 평가 대상만 그 매장으로 줄이고, 학습은 운영과 같이 전체 매장으로 한다).
- wMAPE   : sum|실제-예측| / sum(실제)
- MASE    : 시계열별 MAE / 학습 구간 계절 나이브(7일 전) MAE 의 평균 (Hyndman & Koehler 2006).
            1보다 작으면 계절 나이브보다 낫다
- 커버리지: 실제 판매량 <= 추천 발주량인 비율. 목표는 critical fractile (현재 0.6)
- 식자재 단위 (--db, 레시피 있는 매장): 7일 식자재 사용량 기준 커버리지·잉여율·부족률.
  보정 비율은 그 시점 이전의 겹치지 않는 주간 구간 최대 4개로만 구한다 (운영 ml/calibration.py 와 같은 규칙,
  --step 7 로 돌려야 운영과 같은 주 간격이 된다)
베이스라인 '매장 요일비율×28일 평균'은 글로벌 모델의 기준값(scale)을 단순화한 값이다
(모델은 28일 평균 대신 요일 효과를 뺀 평균을 쓴다). 모델의 보정이 얼마나 더해지는지 보려고 넣었다.
날씨 피처는 넣지 않는다. 과거 실측 날씨를 예보 대신 쓰면 성능이 부풀려지므로 별도 실험으로 분리한다.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date, timedelta

import numpy as np
import pandas as pd

from ml.calibration import CALIBRATION_WEEKS, conformal_quantile, ingredient_usage, usage_ratios, window_sums
from ml.demand_predictor import CRITICAL_FRACTILE, DemandPredictor
from ml.feature_engineering import store_weekday_ratio

HORIZON = 7
MODEL = "DemandPredictor (글로벌)"
SeriesKey = tuple[int, int]  # (store_id, menu_id)


def synthetic_series(days: int = 200, seed: int = 42) -> pd.DataFrame:
    """요일 패턴(월 0.7 ~ 토 1.7배) + 기간 동안 15% 상승 추세 + 포아송 잡음."""
    rng = np.random.default_rng(seed)
    dow_factor = [0.7, 0.8, 0.9, 1.0, 1.3, 1.7, 1.2]
    start = date(2026, 1, 5)  # 월요일
    rows = []
    for i in range(days):
        d = start + timedelta(days=i)
        lam = 30 * dow_factor[d.weekday()] * (1 + 0.15 * i / days)
        rows.append((d, float(rng.poisson(lam))))
    return pd.DataFrame(rows, columns=["ds", "y"])


def db_series() -> tuple[dict[SeriesKey, pd.DataFrame], dict[int, list[tuple[int, float]]]]:
    from database import SessionLocal
    from services.data_service import get_all_sales_data, get_recipes

    db = SessionLocal()
    try:
        return get_all_sales_data(db), get_recipes(db)
    finally:
        db.close()


def recent_weekly(history: list[tuple[date, list[float]]], origin: date) -> list[float]:
    """origin 이전에 끝난, 서로 겹치지 않는 최근 주간 구간 최대 CALIBRATION_WEEKS 개의 비율."""
    picked: list[float] = []
    last = None
    n = 0
    for o, ratios in reversed(history):
        if o + timedelta(days=HORIZON) <= origin and (last is None or o + timedelta(days=HORIZON) <= last):
            picked += ratios
            last = o
            n += 1
            if n == CALIBRATION_WEEKS:
                break
    return picked


def store_totals(series: dict[SeriesKey, pd.DataFrame]) -> dict[int, pd.Series]:
    """매장별 전체 메뉴 일 판매량 합계 (영업일 순)."""
    parts: dict[int, list[pd.Series]] = defaultdict(list)
    for (sid, _), df in series.items():
        parts[sid].append(df.set_index("ds")["y"])
    return {sid: pd.concat(p).groupby(level=0).sum().sort_index() for sid, p in parts.items()}


def baselines(train: pd.DataFrame, targets: list[date], store_total: pd.Series) -> dict[str, dict[date, float]]:
    """origin 까지의 이력만 쓰는 단순 예측 4종. store_total: origin 까지의 매장 전체 일 판매량."""
    by_dow: dict[int, list[float]] = defaultdict(list)
    for d, v in zip(train["ds"], train["y"]):
        by_dow[d.weekday()].append(float(v))
    ma7 = float(train["y"].tail(7).mean())
    level = float(train["y"].tail(28).mean())

    out: dict[str, dict[date, float]] = {
        "계절 나이브": {}, "요일 평균(4주)": {}, "이동평균(7일)": {}, "매장 요일비율×28일 평균": {},
    }
    for t in targets:
        same = by_dow.get(t.weekday())
        out["계절 나이브"][t] = same[-1] if same else ma7
        out["요일 평균(4주)"][t] = float(np.mean(same[-4:])) if same else ma7
        out["이동평균(7일)"][t] = ma7
        out["매장 요일비율×28일 평균"][t] = level * store_weekday_ratio(store_total, t.weekday())
    return out


def seasonal_naive_scale(train: pd.DataFrame) -> float:
    """MASE 분모: 학습 구간에서 '7일 전 같은 요일 값'으로 예측했을 때의 MAE."""
    y = dict(zip(train["ds"], train["y"]))
    diffs = [abs(v - y[d - timedelta(days=7)]) for d, v in y.items() if d - timedelta(days=7) in y]
    return float(np.mean(diffs)) if diffs else 0.0


def eval_targets(df: pd.DataFrame, origin: date) -> list[date]:
    """휴무일(행 없음)과 품절일(실제 수요를 모름)은 평가에서 제외."""
    sold_out = set(df.loc[df["sold_out"] == 1, "ds"]) if "sold_out" in df.columns else set()
    days = set(df["ds"])
    targets = [origin + timedelta(days=h) for h in range(1, HORIZON + 1)]
    return [t for t in targets if t in days and t not in sold_out]


def wmape(g: pd.DataFrame) -> float:
    return float(g["ae"].sum() / max(g["y"].sum(), 1e-9) * 100)


def run(
    series: dict[SeriesKey, pd.DataFrame],
    min_train: int,
    step: int,
    store: int | None = None,
    recipes: dict[int, list[tuple[int, float]]] | None = None,
    compare: bool = False,
) -> None:
    if compare:
        from compare_models import LSTMForecaster, prophet_forecast
    series = {k: df.sort_values("ds").reset_index(drop=True) for k, df in series.items()}
    plan: dict[date, list[tuple[SeriesKey, int]]] = defaultdict(list)  # origin -> [(시계열, origin 행 위치)]
    scales: dict[SeriesKey, float] = {}
    for key, df in series.items():
        if store is not None and key[0] != store:
            continue
        last = df["ds"].iloc[-1]
        for i in range(min_train - 1, len(df), step):
            origin = df["ds"].iloc[i]
            if origin + timedelta(days=HORIZON) > last:
                break
            scales.setdefault(key, seasonal_naive_scale(df.iloc[: i + 1]))
            plan[origin].append((key, i))

    records = []  # (method, series, horizon, actual, pred)
    covered = []
    n_origins = 0
    recipe_stores = {sid for sid, mid in series if mid in (recipes or {})}
    ratio_history: dict[int, list[tuple[date, list[float]]]] = defaultdict(list)  # 매장 -> [(시점, 식자재 비율)]
    ing_records = []  # (method, 실제 사용량, 발주 기준량)
    factors = []
    for origin in sorted(plan):
        past = {k: df[df["ds"] <= origin] for k, df in series.items()}
        past = {k: df for k, df in past.items() if len(df) > 0}
        model = DemandPredictor().fit(past)
        totals = store_totals(past)
        if compare:
            lstm = LSTMForecaster().fit(past, origin)

        # 운영과 같이 이전 주간 구간들의 식자재 비율로 보정 비율을 정하고 모델에 넣는다
        q = conformal_quantile(
            [r for h in ratio_history.values() for r in recent_weekly(h, origin)], CRITICAL_FRACTILE
        )
        model.safety_factor = q if q is not None else 1.0
        for sid in {key[0] for key, _ in plan[origin]} & recipe_stores:
            sums = window_sums(model, series, sid, origin)
            actual = {m: s[0] for m, s in sums.items()}
            point = {m: s[1] for m, s in sums.items()}
            if q is not None:
                factors.append(q)
                use = ingredient_usage(actual, recipes)
                for method, req in (
                    ("점추정 합 (안전재고 없음)", ingredient_usage(point, recipes)),
                    ("메뉴·일자 추천량 합 (모델 출력)", ingredient_usage({m: s[2] for m, s in sums.items()}, recipes)),
                    ("점추정 합 × 보정 비율 (식자재 conformal)", {i: v * q for i, v in ingredient_usage(point, recipes).items()}),
                ):
                    ing_records += [(method, use.get(i, 0.0), r) for i, r in req.items() if r > 0]
            ratio_history[sid].append((origin, usage_ratios(actual, point, recipes)))

        for key, i in plan[origin]:
            df = series[key]
            actual = dict(zip(df["ds"], df["y"]))
            targets = eval_targets(df, origin)

            preds = baselines(df.iloc[: i + 1], targets, totals[key[0]])
            out = {p["date"]: p for p in model.predict(*key, days=HORIZON, start_date=origin)}
            preds[MODEL] = {t: out[t]["predicted_qty"] for t in targets}
            if compare:
                preds["Prophet (메뉴별)"] = prophet_forecast(df.iloc[: i + 1], targets)
                preds["LSTM (글로벌)"] = lstm.predict(key, targets)
            for t in targets:
                for method, p in preds.items():
                    records.append((method, key, origin, (t - origin).days, actual[t], p[t]))
                covered.append(actual[t] <= out[t]["recommended_order_qty"])
            n_origins += 1

    if not records:
        print("평가할 구간이 없습니다 (--min-train 을 줄여 보세요).")
        return

    r = pd.DataFrame(records, columns=["method", "series", "origin", "h", "y", "pred"])
    r["ae"] = (r["y"] - r["pred"]).abs()

    print(f"시계열 {len(scales)}개, 예측 시점 {n_origins}개, 평가 일수 {len(r) // r['method'].nunique()}개\n")
    head = "| 방법 | wMAPE | MASE | " + " | ".join(f"{h}일 뒤" for h in range(1, HORIZON + 1)) + " |"
    print(head)
    print("|" + "---|" * (head.count("|") - 1))
    for method, g in r.groupby("method", sort=False):
        mae = g.groupby("series")["ae"].mean()
        mase = np.mean([mae[s] / scales[s] for s in mae.index if scales.get(s, 0) > 0])
        by_h = [wmape(g[g["h"] == h]) for h in range(1, HORIZON + 1)]
        print(f"| {method} | {wmape(g):.1f}% | {mase:.3f} | " + " | ".join(f"{v:.1f}%" for v in by_h) + " |")

    # 계획서 정량 목표 "메뉴별 판매량 예측 정확도: 주간 단위 ±10% 오차 이내" — 메뉴×예측 시점마다 7일 합계로 비교
    weekly = r.groupby(["method", "series", "origin"], sort=False)[["y", "pred"]].sum().reset_index()
    weekly = weekly[weekly["y"] > 0]
    weekly["ape"] = (weekly["pred"] - weekly["y"]).abs() / weekly["y"] * 100
    print(f"\n주간 합계 오차 (메뉴×7일 {len(weekly) // weekly['method'].nunique()}개, 계획서 목표 ±10%)\n")
    print("| 방법 | 주간 wMAPE | 주간 오차 중앙값 | ±10% 이내 비율 |")
    print("|---|---|---|---|")
    for method, g in weekly.groupby("method", sort=False):
        w = (g["pred"] - g["y"]).abs().sum() / g["y"].sum() * 100
        print(f"| {method} | {w:.1f}% | {g['ape'].median():.1f}% | {(g['ape'] <= 10).mean() * 100:.1f}% |")

    print(f"\n추천 발주량 커버리지(실제 <= 추천): {np.mean(covered) * 100:.1f}% (목표 {CRITICAL_FRACTILE * 100:.0f}%)")

    if not ing_records:
        return
    ing = pd.DataFrame(ing_records, columns=["method", "use", "req"])
    ing = ing[ing["use"] > 0]
    print(
        f"\n식자재 단위 7일 발주 평가: 레시피 있는 매장 {len(recipe_stores)}곳, 보정 가능 시점 {len(factors)}개, "
        f"식자재×구간 {len(ing) // ing['method'].nunique()}개, 보정 비율 평균 {np.mean(factors):.3f} "
        f"(범위 {min(factors):.3f}~{max(factors):.3f})\n"
    )
    print(f"| 방법 | 커버리지 (목표 {CRITICAL_FRACTILE * 100:.0f}%) | 평균 잉여율 | 평균 부족률 |")
    print("|---|---|---|---|")
    for method, g in ing.groupby("method", sort=False):
        excess = ((g["req"] - g["use"]).clip(lower=0) / g["use"]).mean() * 100
        short = ((g["use"] - g["req"]).clip(lower=0) / g["use"]).mean() * 100
        print(f"| {method} | {(g['use'] <= g['req']).mean() * 100:.1f}% | {excess:.1f}% | {short:.1f}% |")
    print("잉여율·부족률: 식자재×구간마다 (발주 기준량 - 실제 사용량)의 양수·음수 부분을 실제 사용량으로 나눈 평균")


def run_cold_start(series: dict[SeriesKey, pd.DataFrame], origin_row: int = 35, new_days=(1, 3, 5)) -> None:
    """
    신메뉴 시뮬레이션: origin_row 영업일째인 매장에 k일 전 출시한 메뉴로 보고 그 메뉴 이력만 최근 k일로 줄여
    다음 7일을 예측한다 (다른 메뉴는 origin 까지 전부 사용). 이력 7일 미만에서 '요일 평균(4주)'은
    기존 로컬 모델의 신메뉴 처리(요일 평균, 없으면 전체 평균)와 같다 (반올림만 다름).
    """
    series = {k: df.sort_values("ds").reset_index(drop=True) for k, df in series.items()}
    records = []  # (method, k, actual, pred)
    n_series = 0
    for key, df in series.items():
        if len(df) < origin_row + HORIZON:
            continue
        n_series += 1
        origin = df["ds"].iloc[origin_row - 1]
        actual = dict(zip(df["ds"], df["y"]))
        targets = eval_targets(df, origin)
        others = {k: d[d["ds"] <= origin] for k, d in series.items() if k != key}
        others = {k: d for k, d in others.items() if len(d) > 0}

        for k in new_days:
            past = {**others, key: df.iloc[origin_row - k: origin_row]}
            model = DemandPredictor().fit(past)
            preds = baselines(past[key], targets, store_totals(past)[key[0]])
            out = {p["date"]: p["predicted_qty"] for p in model.predict(*key, days=HORIZON, start_date=origin)}
            preds[MODEL] = {t: out[t] for t in targets}
            for method, p in preds.items():
                records.extend((method, k, actual[t], p[t]) for t in targets)

    r = pd.DataFrame(records, columns=["method", "k", "y", "pred"])
    r["ae"] = (r["y"] - r["pred"]).abs()
    print(f"신메뉴 시뮬레이션: 시계열 {n_series}개, 각 {origin_row}영업일째 시점, 7일 예측 wMAPE\n")
    print("| 방법 | " + " | ".join(f"이력 {k}일" for k in new_days) + " |")
    print("|---|" + "---|" * len(new_days))
    for method, g in r.groupby("method", sort=False):
        print(f"| {method} | " + " | ".join(f"{wmape(g[g['k'] == k]):.1f}%" for k in new_days) + " |")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--synthetic", action="store_true", help="합성 데이터 200일")
    src.add_argument("--db", action="store_true", help="DB SALES_DATA 의 모든 매장x메뉴")
    parser.add_argument("--store", type=int, help="--db 와 함께: 이 매장 메뉴만 평가 (학습은 전체)")
    parser.add_argument("--cold-start", action="store_true", help="--db 와 함께: 신메뉴(이력 1·3·5일) 예측 비교")
    parser.add_argument("--compare", action="store_true", help="Prophet·LSTM 비교 실험 추가 (requirements-experiment.txt 필요)")
    parser.add_argument("--min-train", type=int, help="첫 예측 시점까지의 최소 학습 일수 (기본: 합성 90, DB 28)")
    parser.add_argument("--step", type=int, default=2, help="예측 시점 간격(일 단위 행 수, 기본 2)")
    args = parser.parse_args()

    if args.synthetic:
        run({(0, 0): synthetic_series()}, args.min_train or 90, args.step, compare=args.compare)
    elif args.cold_start:
        run_cold_start(db_series()[0])
    else:
        series, recipes = db_series()
        run(series, args.min_train or 28, args.step, store=args.store, recipes=recipes, compare=args.compare)


if __name__ == "__main__":
    main()
