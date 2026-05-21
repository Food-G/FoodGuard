"""
FoodGuard 수요 예측 모델.

데이터 양에 따라 두 가지 전략을 사용합니다:
- 데이터 >= MIN_POINTS: RandomForestRegressor + 특징 엔지니어링 + 날씨
- 데이터 < MIN_POINTS: 요일별 평균 기반 단순 예측
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score

from config import settings
from ml.feature_engineering import (
    FULL_FEATURE_COLS,
    MINIMAL_FEATURE_COLS,
    WEATHER_FEATURE_COLS,
    build_features,
    make_future_feature_row,
)

MIN_POINTS_FULL = 30
MIN_POINTS_MINIMAL = 7

# 예측일이 멀어질수록 신뢰도 감소폭 (일당 %)
CONFIDENCE_DECAY_PER_DAY = 1.5


class DemandPredictor:
    def __init__(self, store_id: int, menu_id: int):
        self.store_id = store_id
        self.menu_id = menu_id
        self.model: RandomForestRegressor | None = None
        self.feature_cols: list[str] = FULL_FEATURE_COLS
        self.score: float = 0.0
        self.is_trained: bool = False
        self.use_weather: bool = False
        self._history: pd.DataFrame | None = None

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(
        self,
        df: pd.DataFrame,
        weather_df: Optional[pd.DataFrame] = None,
    ) -> "DemandPredictor":
        """
        df: pandas DataFrame with columns ['ds' (date), 'y' (int quantity)]
        weather_df: optional DataFrame with ['ds', 'temp_max', 'temp_min',
                    'precipitation', 'is_rainy', 'is_hot', 'is_cold']
        """
        df = df.copy()
        df["ds"] = pd.to_datetime(df["ds"]).dt.date
        df = df.sort_values("ds").reset_index(drop=True)
        df["y"] = df["y"].clip(lower=0)

        n = len(df)

        if n < MIN_POINTS_MINIMAL:
            self._history = df
            self.is_trained = False
            return self

        base_cols = FULL_FEATURE_COLS.copy() if n >= MIN_POINTS_FULL else MINIMAL_FEATURE_COLS.copy()

        featured = build_features(df, weather_df)

        # 날씨 피처 중 실제로 데이터가 있는 것만 추가
        available_weather = [
            c for c in WEATHER_FEATURE_COLS
            if c in featured.columns and featured[c].notna().any()
        ]
        self.feature_cols = base_cols + available_weather
        self.use_weather = len(available_weather) > 0

        featured = featured.dropna(subset=base_cols)

        X = featured[self.feature_cols].fillna(0).values
        y = featured["y"].values

        self.model = RandomForestRegressor(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X, y)

        if len(X) >= 10:
            cv_scores = cross_val_score(
                self.model, X, y, cv=min(5, len(X) // 2), scoring="r2"
            )
            self.score = float(np.clip(np.mean(cv_scores), 0, 1))
        else:
            self.score = 0.5

        self._history = df
        self.is_trained = True
        return self

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(
        self,
        days: int = 7,
        forecast_df: Optional[pd.DataFrame] = None,
    ) -> list[dict]:
        """
        Returns list of dicts:
            {'date': date, 'predicted_qty': int, 'confidence': float}
        forecast_df: optional 7-day weather forecast DataFrame
        """
        if self._history is None or len(self._history) == 0:
            return self._zero_predictions(days)

        last_date = pd.to_datetime(self._history["ds"]).dt.date.max()

        if not self.is_trained:
            return self._simple_avg_predictions(last_date, days)

        history_working = self._history.copy()
        predictions = []

        for i in range(1, days + 1):
            target = last_date + timedelta(days=i)

            weather_row = None
            if forecast_df is not None and not forecast_df.empty:
                match = forecast_df[forecast_df["ds"] == target]
                if not match.empty:
                    weather_row = match.iloc[0].to_dict()

            feat_row = make_future_feature_row(target, history_working, weather_row=weather_row)

            X = np.array([[feat_row.get(col, 0.0) for col in self.feature_cols]])
            pred_qty = max(0, round(float(self.model.predict(X)[0])))

            confidence = self._calc_confidence(pred_qty, history_working)
            # 예측일이 멀수록 신뢰도 감소 (1일차: 0%, 7일차: -9%)
            confidence = round(max(15.0, confidence - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)

            predictions.append(
                {
                    "date": target,
                    "predicted_qty": pred_qty,
                    "confidence": confidence,
                }
            )

            new_row = pd.DataFrame({"ds": [target], "y": [float(pred_qty)]})
            history_working = pd.concat([history_working, new_row], ignore_index=True)

        return predictions

    def _simple_avg_predictions(self, last_date: date, days: int) -> list[dict]:
        """요일별 평균으로 단순 예측 (데이터 부족 시 사용)."""
        df = self._history.copy()
        df["dow"] = pd.to_datetime(df["ds"]).dt.dayofweek
        dow_mean = df.groupby("dow")["y"].mean().to_dict()
        overall_mean = float(df["y"].mean()) if len(df) > 0 else 0.0

        predictions = []
        for i in range(1, days + 1):
            target = last_date + timedelta(days=i)
            dow = target.weekday()
            qty = max(0, round(dow_mean.get(dow, overall_mean)))
            confidence = round(max(15.0, 40.0 - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)
            predictions.append({"date": target, "predicted_qty": qty, "confidence": confidence})
        return predictions

    def _zero_predictions(self, days: int) -> list[dict]:
        today = date.today()
        return [
            {"date": today + timedelta(days=i), "predicted_qty": 0, "confidence": 0.0}
            for i in range(1, days + 1)
        ]

    def _calc_confidence(self, pred_qty: int, history_df: pd.DataFrame) -> float:
        base = self.score * 85.0
        y_vals = history_df["y"].values
        if len(y_vals) > 0:
            mean_val = np.mean(y_vals)
            std_val = np.std(y_vals) if len(y_vals) > 1 else mean_val * 0.3
            if std_val > 0 and abs(pred_qty - mean_val) <= 2 * std_val:
                base = min(base + 10.0, 95.0)
        return max(15.0, base)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> str:
        path = self._model_path()
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        return path

    @classmethod
    def load(cls, store_id: int, menu_id: int) -> "DemandPredictor | None":
        path = cls._build_path(store_id, menu_id)
        if os.path.exists(path):
            return joblib.load(path)
        return None

    def _model_path(self) -> str:
        return self._build_path(self.store_id, self.menu_id)

    @staticmethod
    def _build_path(store_id: int, menu_id: int) -> str:
        return os.path.join(
            settings.MODEL_DIR,
            f"store_{store_id}_menu_{menu_id}.joblib",
        )
