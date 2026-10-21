"""식자재 단위 안전재고 보정(split conformal) 검증."""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from ml.calibration import (
    CALIBRATION_WEEKS,
    calibration_origins,
    conformal_quantile,
    safety_factor,
    usage_ratios,
)

START = date(2026, 3, 2)  # 월요일


def _store(days: int, seed: int = 0) -> dict:
    """주말 2배 패턴 + 포아송 잡음인 메뉴 3개짜리 매장."""
    rng = np.random.default_rng(seed)
    ds = [START + timedelta(days=i) for i in range(days)]
    series = {}
    for menu_id, level in ((1, 20), (2, 40), (3, 60)):
        lam = [level * (2.0 if d.weekday() >= 5 else 1.0) for d in ds]
        series[(1, menu_id)] = pd.DataFrame({"ds": ds, "y": rng.poisson(lam).astype(float), "sold_out": 0})
    return series


def test_usage_ratios_sum_menus_into_ingredients_before_dividing():
    recipes = {1: [(100, 0.2)], 2: [(100, 0.1), (200, 1.0)]}
    ratios = usage_ratios(actual={1: 10, 2: 20}, predicted={1: 8, 2: 25}, recipes=recipes)
    # 식자재 100: (10×0.2 + 20×0.1) / (8×0.2 + 25×0.1), 식자재 200: 20 / 25
    assert sorted(ratios) == sorted([4.0 / 4.1, 0.8])


def test_conformal_quantile_uses_finite_sample_rank():
    scores = [float(i) for i in range(1, 11)]
    assert conformal_quantile(scores, 0.6) == 7.0  # ceil(11 × 0.6) = 7번째
    assert conformal_quantile(scores[:9], 0.6) is None  # 표본 부족


def test_calibration_origins_are_weekly_and_end_at_last_day():
    series = _store(days=60)
    origins = sorted(calibration_origins(series, {1}))
    last = START + timedelta(days=59)
    assert len(origins) == CALIBRATION_WEEKS
    assert origins[-1] == last - timedelta(days=7)
    assert all((b - a).days == 7 for a, b in zip(origins, origins[1:]))


def test_safety_factor_without_recipes_is_one():
    assert safety_factor(_store(days=60), recipes={}) == 1.0


def test_safety_factor_raises_point_forecast_toward_target_quantile():
    recipes = {1: [(100, 0.1)], 2: [(100, 0.2), (200, 0.5)], 3: [(200, 0.3), (300, 1.0)]}
    factor = safety_factor(_store(days=70, seed=1), recipes)
    # 점추정은 중앙값 근처라 60% 분위수 보정은 1보다 조금 크다
    assert 1.0 < factor < 1.3
