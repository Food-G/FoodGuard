"""
식자재 단위 안전재고 보정 — split conformal (Romano et al. 2019 의 보정 단계).

메뉴·일자별 60% 분위수를 7일·여러 메뉴에 걸쳐 더하면 합계가 실제 60% 분위수보다 커진다
(분위수는 더해지지 않는다. 메뉴·일자 오차가 서로 상쇄되는 위험 분산을 무시하게 됨).
대신 메뉴 점추정치를 레시피로 식자재 7일 사용량으로 합친 뒤, 과거 몇 주의
'실제 사용량 / 예측 사용량' 비율 분포에서 목표 분위수(critical fractile)를 한 번만 구해 곱한다.

비율 하나(safety factor)를 모든 메뉴 점추정치에 곱해 recommended_order_qty 로 저장하면,
백엔드 recommend() 가 그것을 레시피로 합산한 값 = 식자재 사용량 점추정 × 분위수 비율이 된다.
즉 백엔드 수정 없이 식자재 단위로 분위수를 한 번만 적용한 것과 같다.
식자재마다 따로 보정하기에는 표본(주 4개)이 너무 적어 전 매장·식자재의 비율을 함께 쓴다.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, timedelta

import pandas as pd

from config import settings
from ml.demand_predictor import CRITICAL_FRACTILE, DemandPredictor

Recipes = dict[int, list[tuple[int, float]]]  # {menu_id: [(ingredient_id, 메뉴 1개당 사용량)]}
SeriesKey = tuple[int, int]  # (store_id, menu_id)

# 보정에 쓰는 최근 주간 시점 수 (매장별)
CALIBRATION_WEEKS = 4
# 보정 시점까지 최소 영업일 수 (이보다 짧으면 그 시점 모델이 운영 모델과 너무 달라서 뺀다)
MIN_HISTORY = 28
# 비율이 이보다 적으면 보정하지 않는다 (safety factor 1.0 = 점추정 그대로)
MIN_SCORES = 10


def ingredient_usage(qty: dict[int, float], recipes: Recipes) -> dict[int, float]:
    """메뉴별 수량 {menu_id: qty} → 식자재별 사용량 {ingredient_id: qty}."""
    usage: dict[int, float] = defaultdict(float)
    for menu_id, q in qty.items():
        for ingredient_id, per_unit in recipes.get(menu_id, []):
            usage[ingredient_id] += q * per_unit
    return dict(usage)


def usage_ratios(actual: dict[int, float], predicted: dict[int, float], recipes: Recipes) -> list[float]:
    """한 매장·한 예측 구간의 식자재별 '실제 사용량 / 예측 사용량' (예측 사용량 0 은 제외)."""
    a = ingredient_usage(actual, recipes)
    p = ingredient_usage(predicted, recipes)
    return [a.get(i, 0.0) / p[i] for i in p if p[i] > 0]


def conformal_quantile(scores: list[float], level: float) -> float | None:
    """유한표본 보정 분위수: 정렬한 점수의 ceil((n+1)·level) 번째 값. 점수가 MIN_SCORES 보다 적으면 None."""
    if len(scores) < MIN_SCORES:
        return None
    s = sorted(scores)
    k = math.ceil((len(s) + 1) * level)
    return s[min(k, len(s)) - 1]


def window_sums(
    model: DemandPredictor,
    series: dict[SeriesKey, pd.DataFrame],
    store_id: int,
    origin: date,
) -> dict[int, tuple[float, float, float]]:
    """
    매장 메뉴별 (origin, origin+7일] 영업일의 (실제, 점추정, 추천 발주량) 합계.
    휴무일(행 없음)과 품절일(실제 수요를 모름)은 양쪽 합계에서 모두 뺀다.
    """
    end = origin + timedelta(days=settings.PREDICTION_DAYS)
    out = {}
    for (sid, mid), df in series.items():
        if sid != store_id or df["ds"].min() > origin:
            continue
        days = df[(df["ds"] > origin) & (df["ds"] <= end)]
        if "sold_out" in days.columns:
            days = days[days["sold_out"] == 0]
        if days.empty:
            continue
        preds = {p["date"]: p for p in model.predict(sid, mid, days=settings.PREDICTION_DAYS, start_date=origin)}
        out[mid] = (
            float(days["y"].sum()),
            float(sum(preds[d]["predicted_qty"] for d in days["ds"])),
            float(sum(preds[d]["recommended_order_qty"] for d in days["ds"])),
        )
    return out


def calibration_origins(series: dict[SeriesKey, pd.DataFrame], store_ids: set[int]) -> dict[date, set[int]]:
    """매장별 최근 CALIBRATION_WEEKS 개 주간 시점 (영업일 7일 간격, 마지막 구간은 마지막 영업일에서 끝남)."""
    open_days: dict[int, set[date]] = defaultdict(set)
    for (sid, _), df in series.items():
        if sid in store_ids:
            open_days[sid].update(df["ds"])
    origins: dict[date, set[int]] = defaultdict(set)
    for sid, days in open_days.items():
        days = sorted(days)
        for j in range(1, CALIBRATION_WEEKS + 1):
            i = len(days) - 1 - 7 * j
            if i + 1 >= MIN_HISTORY:
                origins[days[i]].add(sid)
    return origins


def safety_factor(series: dict[SeriesKey, pd.DataFrame], recipes: Recipes) -> float:
    """
    레시피가 있는 매장마다 최근 주간 시점에서 '그 시점까지의 이력으로 학습 → 다음 7일 예측'을 다시 해 보고,
    식자재 사용량 비율의 critical fractile 분위수를 돌려준다. 비율이 부족하면 1.0.
    날씨는 넣지 않는다: 과거 시점의 예보를 재현할 수 없어 실측 날씨를 쓰면 오차가 작게 잡힌다.
    """
    store_ids = {sid for sid, mid in series if mid in recipes}
    scores: list[float] = []
    for origin, sids in calibration_origins(series, store_ids).items():
        past = {k: df[df["ds"] <= origin] for k, df in series.items()}
        model = DemandPredictor().fit({k: df for k, df in past.items() if len(df) > 0}, with_scores=False)
        if not model.is_trained:
            continue
        for sid in sids:
            sums = window_sums(model, series, sid, origin)
            scores += usage_ratios({m: s[0] for m, s in sums.items()}, {m: s[1] for m, s in sums.items()}, recipes)
    q = conformal_quantile(scores, CRITICAL_FRACTILE)
    return q if q is not None else 1.0
