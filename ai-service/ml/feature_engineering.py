import pandas as pd
import numpy as np
from datetime import date
from typing import Optional

try:
    import holidays as holidays_lib
    _KR_HOLIDAYS = holidays_lib.country_holidays("KR", years=range(2023, 2030))
except Exception:
    _KR_HOLIDAYS = set()

WEATHER_FEATURE_COLS = [
    "temp_max", "temp_min", "precipitation",
    "is_rainy", "is_hot", "is_cold",
]

# 글로벌 모델(demand_predictor) 피처. lag·rolling 은 메뉴 규모(scale)로 나눈 비율로 들어간다
# lag_1(어제 판매량)은 쓰지 않는다: 한 모델로 1~7일 뒤를 예측하므로 2일차부터는 예측 시점에 알 수 없는 값이다
# month·day_of_month 는 뺐다: 이력이 3~4개월뿐이라 연 계절성을 배울 수 없고 우연한 패턴만 외운다
GLOBAL_FEATURE_COLS = [
    "day_of_week", "is_weekend", "is_holiday",
    "lag_7", "lag_14",
    "rolling_mean_7", "rolling_mean_14",
    "rolling_std_7",
    "store_dow_ratio", "log_level", "n_obs",
    "store_id", "menu_id",
]

# #2: 날씨 API 실패 시 월별 계절 기온 기본값 (서울 기준, °C)
_SEASONAL_TEMP_MAX = {1:3, 2:6, 3:11, 4:18, 5:23, 6:27, 7:30, 8:30, 9:26, 10:19, 11:11, 12:5}
_SEASONAL_TEMP_MIN = {1:-3, 2:-1, 3:4, 4:9, 5:14, 6:19, 7:23, 8:23, 9:17, 10:9, 11:3, 12:-2}


def add_date_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    dt = pd.to_datetime(df["ds"])
    df["day_of_week"] = dt.dt.dayofweek
    df["day_of_month"] = dt.dt.day
    df["month"] = dt.dt.month
    df["week_of_year"] = dt.dt.isocalendar().week.astype(int)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_holiday"] = df["ds"].apply(lambda x: 1 if x in _KR_HOLIDAYS else 0)
    df["is_monday"] = (df["day_of_week"] == 0).astype(int)
    df["is_friday"] = (df["day_of_week"] == 4).astype(int)
    df["is_saturday"] = (df["day_of_week"] == 5).astype(int)
    df["is_sunday"] = (df["day_of_week"] == 6).astype(int)
    return df


def weekday_lag(history_df: pd.DataFrame, dates, k: int) -> np.ndarray:
    """
    각 날짜의 k일 전(k는 7의 배수) 같은 요일 판매량. 그날이 휴무·미입력이면 그 이전 같은 요일 값.
    행 위치가 아니라 달력으로 계산해야 판매 없는 날이 빠져도 '지난주 같은 요일'이 유지된다.
    학습(add_lag_features)과 예측(make_future_feature_row)이 이 함수를 같이 써서 정의를 맞춘다.
    """
    y = pd.Series(history_df["y"].to_numpy(dtype=float), index=pd.to_datetime(history_df["ds"]))
    targets = pd.DatetimeIndex(pd.to_datetime(list(dates)))
    full = y.reindex(pd.date_range(y.index.min(), max(y.index.max(), targets.max()), freq="D"))
    filled = full.groupby(full.index.dayofweek).ffill()
    return filled.shift(k).reindex(targets).to_numpy()


def store_weekday_ratio(store_totals: pd.Series, dow: int, window: int = 28) -> float:
    """
    매장 요일 비율: 매장 전체 일 판매량(영업일 순 Series, index=날짜)의 최근 window 영업일 중
    dow 요일 평균 / 전체 평균. 같은 매장 메뉴들이 요일 패턴을 함께 추정하게 하는 값이다. 계산할 수 없으면 1.
    """
    recent = store_totals.tail(window)
    same = recent[pd.to_datetime(recent.index).dayofweek == dow]
    if same.empty or recent.mean() <= 0:
        return 1.0
    return float(same.mean() / recent.mean())


def add_lag_features(df: pd.DataFrame, lags: list[int] = (7, 14)) -> pd.DataFrame:
    df = df.copy().sort_values("ds").reset_index(drop=True)
    for lag in lags:
        df[f"lag_{lag}"] = weekday_lag(df, df["ds"], lag)
    return df


def add_rolling_features(df: pd.DataFrame, windows: list[int] = (7, 14)) -> pd.DataFrame:
    df = df.copy().sort_values("ds").reset_index(drop=True)
    shifted = df["y"].shift(1)
    for w in windows:
        # #7: 데이터가 충분할 때만 의미 있는 rolling 통계 생성 (window 절반 이상 필요)
        min_p = max(w // 2, 3)
        df[f"rolling_mean_{w}"] = shifted.rolling(window=w, min_periods=min_p).mean()
        df[f"rolling_std_{w}"] = shifted.rolling(window=w, min_periods=min_p).std().fillna(0)
    return df


def build_features(
    df: pd.DataFrame,
    weather_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """Full pipeline: date + lag + rolling + (optional) weather features."""
    df = add_date_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)

    if weather_df is not None and not weather_df.empty:
        weather_copy = weather_df.copy()
        weather_copy["ds"] = pd.to_datetime(weather_copy["ds"]).dt.date
        available_cols = [c for c in WEATHER_FEATURE_COLS if c in weather_copy.columns]
        df = df.merge(weather_copy[["ds"] + available_cols], on="ds", how="left")

        # #2: 날씨 결측값을 0°C 대신 계절 평균으로 채움
        for col in available_cols:
            if col == "temp_max":
                df[col] = df.apply(
                    lambda r: float(_SEASONAL_TEMP_MAX.get(int(r["month"]), 15)) if pd.isna(r[col]) else r[col],
                    axis=1,
                )
            elif col == "temp_min":
                df[col] = df.apply(
                    lambda r: float(_SEASONAL_TEMP_MIN.get(int(r["month"]), 5)) if pd.isna(r[col]) else r[col],
                    axis=1,
                )
            else:
                df[col] = df[col].fillna(0)

        # temp_max가 있으면 is_hot, is_cold 파생
        if "temp_max" in df.columns:
            if "is_hot" not in df.columns:
                df["is_hot"] = (df["temp_max"] >= 30).astype(int)
            if "is_cold" not in df.columns:
                df["is_cold"] = (df["temp_max"] <= 5).astype(int)

    return df


def make_future_feature_row(
    target_date: date,
    history_df: pd.DataFrame,
    weather_row: Optional[dict] = None,
) -> dict:
    """미래 날짜에 대한 피처 딕셔너리 생성."""
    dt = pd.Timestamp(target_date)

    row = {
        "day_of_week": dt.dayofweek,
        "day_of_month": dt.day,
        "month": dt.month,
        "week_of_year": int(dt.isocalendar().week),
        "is_weekend": int(dt.dayofweek >= 5),
        "is_holiday": int(target_date in _KR_HOLIDAYS),
        "is_monday": int(dt.dayofweek == 0),
        "is_friday": int(dt.dayofweek == 4),
        "is_saturday": int(dt.dayofweek == 5),
        "is_sunday": int(dt.dayofweek == 6),
    }

    sorted_hist = history_df.sort_values("ds").reset_index(drop=True)
    y_vals = sorted_hist["y"].values

    # 목표일 기준 달력으로 같은 요일 값을 찾는다 (학습 때 lag 와 같은 정의). 없으면 이력 평균
    for k in (7, 14):
        v = weekday_lag(sorted_hist, [target_date], k)[0] if len(y_vals) > 0 else np.nan
        row[f"lag_{k}"] = float(v) if not np.isnan(v) else (float(y_vals.mean()) if len(y_vals) > 0 else 0.0)

    last_7 = y_vals[-7:] if len(y_vals) >= 7 else y_vals
    last_14 = y_vals[-14:] if len(y_vals) >= 14 else y_vals

    row["rolling_mean_7"] = float(np.mean(last_7)) if len(last_7) > 0 else 0.0
    row["rolling_mean_14"] = float(np.mean(last_14)) if len(last_14) > 0 else 0.0
    row["rolling_std_7"] = float(np.std(last_7)) if len(last_7) > 1 else 0.0

    if weather_row is not None:
        for col in WEATHER_FEATURE_COLS:
            row[col] = float(weather_row.get(col, 0.0))
    else:
        # #2: 날씨 없을 때 0°C 대신 계절 평균으로 채움
        month = dt.month
        temp_max = float(_SEASONAL_TEMP_MAX.get(month, 15))
        temp_min = float(_SEASONAL_TEMP_MIN.get(month, 5))
        row["temp_max"] = temp_max
        row["temp_min"] = temp_min
        row["precipitation"] = 0.0
        row["is_rainy"] = 0
        row["is_hot"] = int(temp_max >= 30)
        row["is_cold"] = int(temp_max <= 5)

    return row
