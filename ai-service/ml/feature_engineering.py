import pandas as pd
import numpy as np
from datetime import date, timedelta

try:
    import holidays as holidays_lib
    _KR_HOLIDAYS = holidays_lib.country_holidays("KR", years=range(2023, 2030))
except Exception:
    _KR_HOLIDAYS = set()

FULL_FEATURE_COLS = [
    "day_of_week", "day_of_month", "month", "week_of_year",
    "is_weekend", "is_holiday",
    "is_monday", "is_friday", "is_saturday", "is_sunday",
    "lag_1", "lag_7", "lag_14",
    "rolling_mean_7", "rolling_mean_14",
    "rolling_std_7",
]

MINIMAL_FEATURE_COLS = [
    "day_of_week", "day_of_month", "month",
    "is_weekend", "is_holiday",
    "is_saturday", "is_sunday",
    "rolling_mean_7",
]


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


def add_lag_features(df: pd.DataFrame, lags: list[int] = (1, 7, 14)) -> pd.DataFrame:
    df = df.copy().sort_values("ds").reset_index(drop=True)
    for lag in lags:
        df[f"lag_{lag}"] = df["y"].shift(lag)
    return df


def add_rolling_features(df: pd.DataFrame, windows: list[int] = (7, 14)) -> pd.DataFrame:
    df = df.copy().sort_values("ds").reset_index(drop=True)
    shifted = df["y"].shift(1)
    for w in windows:
        df[f"rolling_mean_{w}"] = shifted.rolling(window=w, min_periods=1).mean()
        df[f"rolling_std_{w}"] = shifted.rolling(window=w, min_periods=1).std().fillna(0)
    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Full pipeline: date + lag + rolling features."""
    df = add_date_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    return df


def make_future_feature_row(
    target_date: date,
    history_df: pd.DataFrame,
) -> dict:
    """Build a single feature dict for a future date using recent history."""
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

    def _get_lag(n: int) -> float:
        if len(y_vals) >= n:
            return float(y_vals[-n])
        return float(y_vals.mean()) if len(y_vals) > 0 else 0.0

    row["lag_1"] = _get_lag(1)
    row["lag_7"] = _get_lag(7)
    row["lag_14"] = _get_lag(14)

    last_7 = y_vals[-7:] if len(y_vals) >= 7 else y_vals
    last_14 = y_vals[-14:] if len(y_vals) >= 14 else y_vals

    row["rolling_mean_7"] = float(np.mean(last_7)) if len(last_7) > 0 else 0.0
    row["rolling_mean_14"] = float(np.mean(last_14)) if len(last_14) > 0 else 0.0
    row["rolling_std_7"] = float(np.std(last_7)) if len(last_7) > 1 else 0.0

    return row
