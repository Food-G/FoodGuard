"""
FoodGuard 수요 예측 모델.

데이터 양에 따라 세 가지 전략:
- 데이터 >= MIN_POINTS_FULL : RandomForest + 전체 피처 + 날씨
- MIN_POINTS_MID <= 데이터  : RandomForest + 중간 피처 + 날씨
- MIN_POINTS_MINIMAL <= 데이터: RandomForest + 최소 피처
- 데이터 < MIN_POINTS_MINIMAL: 요일별 평균 단순 예측
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
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
    MID_FEATURE_COLS,
    MINIMAL_FEATURE_COLS,
    WEATHER_FEATURE_COLS,
    build_features,
    make_future_feature_row,
)

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
        self.trained_at: datetime | None = None  # #8: 학습 시각 기록

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

        # #11: 이상치 상한 클리핑 — 상위 1% × 3배 초과 데이터 제거
        if len(df) >= 10:
            upper = df["y"].quantile(0.99) * 3
            df["y"] = df["y"].clip(upper=max(float(upper), 1.0))

        n = len(df)
        min_minimal = settings.MIN_DATA_POINTS
        min_mid = settings.MIN_DATA_POINTS_MID
        min_full = settings.MIN_DATA_POINTS_FULL

        if n < min_minimal:
            self._history = df
            self.is_trained = False
            return self

        # #6: 점진적 피처셋 선택 (급격한 전략 전환 방지)
        if n >= min_full:
            base_cols = FULL_FEATURE_COLS.copy()
        elif n >= min_mid:
            base_cols = MID_FEATURE_COLS.copy()
        else:
            base_cols = MINIMAL_FEATURE_COLS.copy()

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

        # #4: 데이터 수에 따라 신뢰도 측정 방식 조정
        if len(X) >= 10:
            cv_scores = cross_val_score(
                self.model, X, y, cv=min(5, len(X) // 2), scoring="r2"
            )
            self.score = float(np.clip(np.mean(cv_scores), 0, 1))
        else:
            # 데이터 7~9개: cross-validation 불가 → 보수적 점수 (0.5 하드코딩 제거)
            self.score = 0.3

        self._history = df
        self.is_trained = True
        self.trained_at = datetime.now()  # #8
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
        # 판매 데이터가 오래됐을 경우 오늘 기준으로 예측 (과거 날짜에 저장 방지)
        base_date = max(last_date, date.today())

        if not self.is_trained:
            return self._simple_avg_predictions(base_date, days)

        predictions = []

        for i in range(1, days + 1):
            target = base_date + timedelta(days=i)

            weather_row = None
            if forecast_df is not None and not forecast_df.empty:
                match = forecast_df[forecast_df["ds"] == target]
                if not match.empty:
                    weather_row = match.iloc[0].to_dict()

            # #1: 실제 이력(self._history)만 사용 — 예측값을 lag로 재사용하지 않음
            # 이전 코드에서 history_working에 예측값을 누적하던 방식이 오차를 복리로 키웠음
            feat_row = make_future_feature_row(target, self._history, weather_row=weather_row)

            X = np.array([[feat_row.get(col, 0.0) for col in self.feature_cols]])
            pred_qty = max(0, round(float(self.model.predict(X)[0])))

            confidence = self._calc_confidence()
            # 예측일이 멀수록 신뢰도 감소 (1일차: 0%, 7일차: -9%)
            confidence = round(max(15.0, confidence - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)

            predictions.append(
                {
                    "date": target,
                    "predicted_qty": pred_qty,
                    "confidence": confidence,
                }
            )

        return predictions

    def _simple_avg_predictions(self, last_date: date, days: int) -> list[dict]:
        """요일별 평균으로 단순 예측 (데이터 부족 시 사용)."""
        df = self._history.copy()
        n = len(df)
        df["dow"] = pd.to_datetime(df["ds"]).dt.dayofweek
        dow_mean = df.groupby("dow")["y"].mean().to_dict()
        overall_mean = float(df["y"].mean()) if n > 0 else 0.0

        # #4: 데이터가 매우 적으면 신뢰도 상한을 낮춤
        base_confidence = 30.0 if n < 7 else 40.0

        predictions = []
        for i in range(1, days + 1):
            target = last_date + timedelta(days=i)
            dow = target.weekday()
            qty = max(0, round(dow_mean.get(dow, overall_mean)))
            confidence = round(max(15.0, base_confidence - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)
            predictions.append({"date": target, "predicted_qty": qty, "confidence": confidence})
        return predictions

    def _zero_predictions(self, days: int) -> list[dict]:
        today = date.today()
        return [
            {"date": today + timedelta(days=i), "predicted_qty": 0, "confidence": 0.0}
            for i in range(1, days + 1)
        ]

    def _calc_confidence(self) -> float:
        # #5: 예측값이 평균 근처면 +10% 보너스 제거 — R² 점수만으로 신뢰도 결정
        return max(15.0, self.score * 85.0)

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
