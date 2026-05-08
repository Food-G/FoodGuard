"""
FoodGuard 수요 예측 모델.

데이터 양에 따라 두 가지 전략을 사용합니다:
- 데이터 >= MIN_POINTS: RandomForestRegressor + 특징 엔지니어링
- 데이터 < MIN_POINTS: 요일별 평균 기반 단순 예측
"""

from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import StandardScaler

from config import settings
from ml.feature_engineering import (
    FULL_FEATURE_COLS,
    MINIMAL_FEATURE_COLS,
    build_features,
    make_future_feature_row,
)

MIN_POINTS_FULL = 30
MIN_POINTS_MINIMAL = 7


class DemandPredictor:
    def __init__(self, store_id: int, menu_id: int):
        self.store_id = store_id
        self.menu_id = menu_id
        self.model: RandomForestRegressor | None = None
        self.feature_cols: list[str] = FULL_FEATURE_COLS
        self.score: float = 0.0
        self.is_trained: bool = False
        self._history: pd.DataFrame | None = None

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(self, df: pd.DataFrame) -> "DemandPredictor":
        """
        df: pandas DataFrame with columns ['ds' (date), 'y' (int quantity)]
        """
        df = df.copy()
        df["ds"] = pd.to_datetime(df["ds"]).dt.date
        df = df.sort_values("ds").reset_index(drop=True)
        df["y"] = df["y"].clip(lower=0)

        n = len(df)

        if n < MIN_POINTS_MINIMAL:
            # 평균 기반 fallback — 모델을 훈련하지 않음
            self._history = df
            self.is_trained = False
            return self

        if n >= MIN_POINTS_FULL:
            self.feature_cols = FULL_FEATURE_COLS
        else:
            self.feature_cols = MINIMAL_FEATURE_COLS

        featured = build_features(df)
        featured = featured.dropna(subset=self.feature_cols)

        X = featured[self.feature_cols].values
        y = featured["y"].values

        self.model = RandomForestRegressor(
            n_estimators=200,
            max_depth=8,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X, y)

        # 교차 검증 점수 (R²) → 신뢰도 기반
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

    def predict(self, days: int = 7) -> list[dict]:
        """
        Returns list of dicts:
            {'date': date, 'predicted_qty': int, 'confidence': float}
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
            feat_row = make_future_feature_row(target, history_working)

            X = np.array([[feat_row[col] for col in self.feature_cols]])
            pred_qty = max(0, round(float(self.model.predict(X)[0])))

            confidence = self._calc_confidence(pred_qty, history_working)

            predictions.append(
                {
                    "date": target,
                    "predicted_qty": pred_qty,
                    "confidence": round(confidence, 2),
                }
            )

            # 예측값을 다음 반복에서 lag 특징으로 사용
            new_row = pd.DataFrame(
                {"ds": [pd.Timestamp(target)], "y": [float(pred_qty)]}
            )
            history_working = pd.concat(
                [history_working, new_row], ignore_index=True
            )

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
            predictions.append(
                {"date": target, "predicted_qty": qty, "confidence": 40.0}
            )
        return predictions

    def _zero_predictions(self, days: int) -> list[dict]:
        today = date.today()
        return [
            {"date": today + timedelta(days=i), "predicted_qty": 0, "confidence": 0.0}
            for i in range(1, days + 1)
        ]

    def _calc_confidence(self, pred_qty: int, history_df: pd.DataFrame) -> float:
        """
        신뢰도 계산:
        - 모델 R² 점수 (0~1) → 기본 신뢰도
        - 예측값이 역사적 범위 안에 있으면 보너스
        """
        base = self.score * 85.0  # 최대 85%
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
