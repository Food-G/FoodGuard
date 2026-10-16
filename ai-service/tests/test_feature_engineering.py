"""학습 때와 예측 때 lag 피처가 같은 의미(달력 기준 같은 요일)인지 검증."""

from datetime import date, timedelta

import pandas as pd

from ml.feature_engineering import (
    GLOBAL_FEATURE_COLS,
    build_features,
    make_future_feature_row,
    store_weekday_ratio,
)

START = date(2026, 3, 2)  # 월요일


def _history(days: int, skip: tuple[int, ...] = ()) -> pd.DataFrame:
    """y = 날짜 인덱스(0,1,2,...) 로 값만 보고 며칠 전 값인지 알 수 있게 만든 이력. skip 은 휴무일."""
    rows = [(START + timedelta(days=i), float(i)) for i in range(days) if i not in skip]
    return pd.DataFrame(rows, columns=["ds", "y"])


def test_future_lag7_is_same_weekday_last_week_for_every_horizon():
    hist = _history(28)
    last = hist["ds"].iloc[-1]
    for h in range(1, 8):
        target = last + timedelta(days=h)
        row = make_future_feature_row(target, hist)
        assert row["lag_7"] == (target - timedelta(days=7) - START).days, f"{h}일 뒤"
        assert row["lag_14"] == (target - timedelta(days=14) - START).days, f"{h}일 뒤"


def test_training_lag_is_calendar_based_when_a_day_is_missing():
    # 10일째 휴무 → 행 기준 shift 였다면 그 직후 일주일의 lag_7 이 하루씩 밀린다
    feats = build_features(_history(28, skip=(10,))).set_index("ds")
    assert feats.loc[START + timedelta(days=15), "lag_7"] == 8
    # 7일 전이 휴무였던 날은 그 이전 같은 요일(14일 전) 값으로 대체
    assert feats.loc[START + timedelta(days=17), "lag_7"] == 3


def test_training_and_future_lag_agree():
    # 3일 앞을 예측할 때도 학습 때와 같은 값이 들어가야 한다
    hist = _history(35, skip=(12, 19))
    feats = build_features(hist).set_index("ds")
    for i in (25, 26, 33):
        d = START + timedelta(days=i)
        past = hist[hist["ds"] <= d - timedelta(days=3)]
        assert make_future_feature_row(d, past)["lag_7"] == feats.loc[d, "lag_7"]


def test_lag_1_is_not_used():
    # 7일 앞을 한 모델로 예측하므로 예측 시점에 알 수 없는 어제 판매량은 피처에서 뺀다
    assert "lag_1" not in GLOBAL_FEATURE_COLS


def test_store_weekday_ratio_uses_recent_window():
    # 주말 2배인 매장: 최근 4주 기준 토요일 비율 = 2 / (9/7)
    days = [START + timedelta(days=i) for i in range(35)]
    totals = pd.Series([2.0 if d.weekday() >= 5 else 1.0 for d in days], index=days)
    assert abs(store_weekday_ratio(totals, 5) - 2 / (9 / 7)) < 1e-9
    assert abs(store_weekday_ratio(totals, 0) - 1 / (9 / 7)) < 1e-9
    # 이력이 없으면 1 (요일 보정 없음)
    assert store_weekday_ratio(totals.iloc[:0], 5) == 1.0
