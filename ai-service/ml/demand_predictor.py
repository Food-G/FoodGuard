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
    # 학습 정책: 최근 N일만 학습 (None = 전체 이력). 모델 파일에 함께 저장되어 재학습해도 유지된다.
    # 클래스 속성이라 이 필드가 생기기 전에 저장된 모델은 None(전체 이력)으로 읽힌다.
    train_window_days: int | None = None

    def __init__(self, store_id: int, menu_id: int, train_window_days: int | None = None):
        self.store_id = store_id
        self.menu_id = menu_id
        self.train_window_days = train_window_days
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
        compute_score: bool = True,
    ) -> "DemandPredictor":
        """
        df: pandas DataFrame with columns ['ds' (date), 'y' (int quantity)]
        weather_df: optional DataFrame with ['ds', 'temp_max', 'temp_min',
                    'precipitation', 'is_rainy', 'is_hot', 'is_cold']
        compute_score: False 면 교차검증을 건너뛴다 (워크포워드 비교처럼 fit 을 반복할 때)
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

        # lag 피처는 전체 이력으로 만든 뒤 학습 행만 줄인다. 행이 너무 적어지면 전체를 쓴다.
        if self.train_window_days:
            since = df["ds"].max() - timedelta(days=self.train_window_days)
            recent = featured[featured["ds"] > since]
            if len(recent) >= MIN_POINTS_MINIMAL:
                featured = recent

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

        if compute_score and len(X) >= 10:
            cv_scores = cross_val_score(
                self.model, X, y, cv=min(5, len(X) // 2), scoring="r2"
            )
            self.score = float(np.clip(np.mean(cv_scores), 0, 1))
        else:
            self.score = 0.5

        self._history = df
        self.is_trained = True
        return self

    def matches_history(self, df: pd.DataFrame) -> bool:
        """저장된 모델이 학습한 이력과 주어진 판매 데이터가 같은지 판정.

        같으면 재학습 없이 그대로 예측에 쓸 수 있다 (행 수 + 마지막 날짜 + 합계 비교).
        """
        if self._history is None or df is None or df.empty:
            return False
        if len(self._history) != len(df):
            return False

        cur = pd.to_datetime(df["ds"]).dt.date.max()
        saved = pd.to_datetime(self._history["ds"]).dt.date.max()
        if cur != saved:
            return False

        return float(df["y"].sum()) == float(self._history["y"].sum())

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(
        self,
        days: int = 7,
        forecast_df: Optional[pd.DataFrame] = None,
        as_of: Optional[date] = None,
    ) -> list[dict]:
        """
        Returns list of dicts:
            {'date': date, 'predicted_qty': int, 'confidence': float}
        forecast_df: optional 7-day weather forecast DataFrame
        as_of: 예측 기준일 (기본 오늘). 백테스트는 과거 날짜를 넘겨 '그날의 예측'을 재현한다.
        """
        as_of = as_of or date.today()
        if self._history is None or len(self._history) == 0:
            return self._zero_predictions(days, as_of)

        last_date = pd.to_datetime(self._history["ds"]).dt.date.max()

        if not self.is_trained:
            return self._simple_avg_predictions(last_date, days, as_of)

        history_working = self._history.copy()
        predictions = []

        # 예측 대상은 항상 '내일부터 days 일'이다. 판매 이력이 오늘보다 오래 끊겨 있으면
        # 그 사이를 모델 자신의 예측으로 이어 붙이며(lag 피처 유지) 굴려 나가되 저장은 하지 않는다.
        # 예전에는 마지막 판매일 다음날부터 예측해서, 데이터가 끊기면 예측이 전부 과거 날짜가 됐다.
        first_target = max(last_date, as_of) + timedelta(days=1)
        total_steps = (first_target - last_date).days + days - 1

        for step in range(1, total_steps + 1):
            target = last_date + timedelta(days=step)
            # 실제 판매에서 몇 번째 날인지 (이어 붙인 구간이 길수록 신뢰도가 떨어진다)
            i = step

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

            if target >= first_target:
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

    def _simple_avg_predictions(self, last_date: date, days: int, as_of: date) -> list[dict]:
        """요일별 평균으로 단순 예측 (데이터 부족 시 사용)."""
        df = self._history.copy()
        df["dow"] = pd.to_datetime(df["ds"]).dt.dayofweek
        dow_mean = df.groupby("dow")["y"].mean().to_dict()
        overall_mean = float(df["y"].mean()) if len(df) > 0 else 0.0

        predictions = []
        first_target = max(last_date, as_of) + timedelta(days=1)
        for k in range(days):
            target = first_target + timedelta(days=k)
            i = (target - last_date).days
            dow = target.weekday()
            qty = max(0, round(dow_mean.get(dow, overall_mean)))
            confidence = round(max(15.0, 40.0 - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)
            predictions.append({"date": target, "predicted_qty": qty, "confidence": confidence})
        return predictions

    def _zero_predictions(self, days: int, as_of: date) -> list[dict]:
        today = as_of
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

    def version_label(self, base: str) -> str:
        """PREDICTION_LOG.model_version 에 남길 이름. 학습 정책까지 구분한다."""
        return f"{base}-w{self.train_window_days}" if self.train_window_days else base

    def save(self, path: str | None = None) -> str:
        path = path or self._model_path()
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
