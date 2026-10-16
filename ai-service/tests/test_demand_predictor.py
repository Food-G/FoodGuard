"""글로벌 모델이 매장·메뉴 이력을 함께 학습해 신메뉴도 예측하는지 검증."""

from datetime import date, timedelta

import numpy as np
import pandas as pd

from ml.demand_predictor import DemandPredictor

START = date(2026, 3, 2)  # 월요일
WEEKEND_FACTOR = 2.0


def _menu(level: float, days: int, seed: int, start: date = START) -> pd.DataFrame:
    """주말에 2배 팔리는 메뉴 이력."""
    rng = np.random.default_rng(seed)
    ds = [start + timedelta(days=i) for i in range(days)]
    y = [level * (WEEKEND_FACTOR if d.weekday() >= 5 else 1.0) * rng.uniform(0.9, 1.1) for d in ds]
    return pd.DataFrame({"ds": ds, "y": np.round(y), "sold_out": 0})


def _store_with_new_menu(new_days: int) -> tuple[dict, date]:
    mature = {(1, m): _menu(level, 56, seed=m) for m, level in ((10, 10), (11, 20), (12, 40))}
    origin = START + timedelta(days=55)  # 일요일
    new = _menu(30, new_days, seed=99, start=origin - timedelta(days=new_days - 1))
    return {**mature, (1, 13): new}, origin


def test_new_menu_with_few_days_is_predicted_with_store_weekday_pattern():
    series, origin = _store_with_new_menu(new_days=3)  # 금·토·일 3일치
    model = DemandPredictor().fit(series)
    assert model.is_trained

    preds = {p["date"].weekday(): p for p in model.predict(1, 13, days=7, start_date=origin)}
    # 이력에 평일 판매가 없어도 같은 매장 메뉴들의 요일 패턴(주말 2배)을 따라야 한다
    assert preds[5]["predicted_qty"] > 1.5 * preds[0]["predicted_qty"]
    # 신메뉴 규모(평일 30, 주말 60)에서 크게 벗어나지 않는다
    assert 20 <= preds[0]["predicted_qty"] <= 40
    assert all(p["recommended_order_qty"] >= p["predicted_qty"] for p in preds.values())


def test_menu_without_history_predicts_zero():
    series, origin = _store_with_new_menu(new_days=3)
    model = DemandPredictor().fit(series)
    assert all(p["predicted_qty"] == 0 for p in model.predict(1, 999, days=7))


def test_scores_cover_every_menu_with_history():
    series, _ = _store_with_new_menu(new_days=3)
    model = DemandPredictor().fit(series)
    # 이력이 긴 메뉴는 out-of-fold wMAPE 기반, 짧은 신메뉴는 보수적 고정값
    assert set(model.scores) == set(series)
    assert model.scores[(1, 12)] > model.scores[(1, 13)]
