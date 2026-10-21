"""
FoodGuard 수요 예측 모델 — 매장·메뉴 통합 글로벌 모델.

메뉴마다 따로 학습하던 로컬 XGBoost(메뉴당 30~90행) 대신, 모든 매장×메뉴 판매 이력을
하나의 XGBoost 로 학습한다 (Montero-Manso & Hyndman 2021, M5 상위권 방법들).
- 정답은 판매량 / scale. scale = 메뉴 규모(level) × 매장 요일 비율.
  level 은 최근 28영업일 판매량을 그날의 매장 요일 비율로 나눈 평균 (요일 효과를 뺀 규모)
  규모가 다른 메뉴가 같은 패턴을 공유하고, 모델은 이 기준값에 대한 보정 비율을 학습한다
- 매장 요일 비율(feature_engineering.store_weekday_ratio)은 같은 매장 메뉴 전체 판매량으로 추정해
  메뉴 하나의 요일별 표본 4개보다 잡음이 적다
- 매장·메뉴 ID(범주형), 메뉴 규모(log_level), 이력 길이(n_obs)로 매장·메뉴별 차이를 보정
- 손실은 L1(절대오차): 평가지표 wMAPE·MASE 가 절대오차 기준이라 중앙값 예측이 맞다
- 데이터가 적어 깊이 3, 트리 100개, min_child_weight 100 으로 보정 폭을 작게 제한
- 이력 1~6일인 신메뉴도 같은 모델로 예측한다 (규모와 매장 요일 비율로 시작). 이력이 없으면 0

추천 발주량(recommended_order_qty) = 점추정 × safety_factor.
safety_factor 는 식자재 7일 사용량 기준으로 품절비용 vs 폐기비용의 critical fractile
(뉴스벤더 모델)을 맞추는 conformal 보정 비율이다 (ml/calibration.py, prediction_service 가 설정).
원가 데이터가 없어 COST_RATIO(판매가 대비 원가 비율 근사치, config.py)로 근사한다.
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold, cross_val_predict
from xgboost import XGBRegressor

from config import settings
from ml.feature_engineering import (
    GLOBAL_FEATURE_COLS,
    WEATHER_FEATURE_COLS,
    build_features,
    make_future_feature_row,
    store_weekday_ratio,
)

# 예측일이 멀어질수록 신뢰도 감소폭 (일당 %)
CONFIDENCE_DECAY_PER_DAY = 1.5

# 뉴스벤더 모델의 critical fractile = Cu / (Cu + Co)
#   Co(폐기비용) = COST_RATIO * price, Cu(품절비용) = (1 - COST_RATIO) * price
#   => critical fractile = 1 - COST_RATIO
# 판매가 대비 비율만 쓰므로 실제 price 값 없이도 계산 가능.
CRITICAL_FRACTILE = round(1.0 - settings.COST_RATIO, 4)

# 메뉴 규모(level)를 재는 최근 영업일 수
LEVEL_WINDOW = 28
# scale 로 나눠 비율로 넣는 피처
SCALED_COLS = ["lag_7", "lag_14", "rolling_mean_7", "rolling_mean_14", "rolling_std_7"]
# 학습 행이 이보다 적은 메뉴는 out-of-fold 오차가 불안정해 confidence 를 보수적 고정값으로 둔다
MIN_ROWS_FOR_SCORE = 10
DEFAULT_CONFIDENCE = 25.0

XGB_PARAMS = dict(
    n_estimators=100,
    max_depth=3,
    learning_rate=0.03,
    min_child_weight=100,
    subsample=0.8,
    colsample_bytree=0.8,
    tree_method="hist",
    enable_categorical=True,
    max_cat_to_onehot=1,
    random_state=42,
    n_jobs=-1,
)

SeriesKey = tuple[int, int]  # (store_id, menu_id)


class DemandPredictor:
    def __init__(self):
        self.model: XGBRegressor | None = None
        self.critical_fractile: float = CRITICAL_FRACTILE
        # 식자재 단위 conformal 보정 비율 (ml/calibration.safety_factor). 1.0 이면 점추정 그대로
        self.safety_factor: float = 1.0
        self.feature_cols: list[str] = GLOBAL_FEATURE_COLS
        # 이력 있는 메뉴별 wMAPE 기반 confidence 기준값 (0~100, 학습 행이 적으면 DEFAULT_CONFIDENCE)
        self.scores: dict[SeriesKey, float] = {}
        self.is_trained: bool = False
        self.use_weather: bool = False
        self._histories: dict[SeriesKey, pd.DataFrame] = {}
        self._store_totals: dict[int, pd.Series] = {}
        self._store_ratios: dict[int, dict[date, float]] = {}  # 매장별 {영업일: 그 전날까지 기준 요일 비율}
        self._categories: dict[str, list[int]] = {}
        self.trained_at: datetime | None = None

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def fit(
        self,
        series: dict[SeriesKey, pd.DataFrame],
        weather: Optional[dict[int, pd.DataFrame]] = None,
    ) -> "DemandPredictor":
        """
        series: {(store_id, menu_id): DataFrame ['ds', 'y'(, 'sold_out')]} — 전체 매장×메뉴 영업일 이력
        weather: {store_id: DataFrame ['ds', 'temp_max', 'temp_min', 'precipitation',
                  'is_rainy', 'is_hot', 'is_cold']} — 없는 매장은 날씨 결측으로 학습
        """
        weather = {sid: w for sid, w in (weather or {}).items() if w is not None and not w.empty}
        self._histories = {key: _clean(df) for key, df in series.items() if len(df) > 0}
        self._store_totals = _store_totals(self._histories)
        self._store_ratios = {sid: _past_store_ratios(totals) for sid, totals in self._store_totals.items()}

        parts = [
            self._training_rows(key, df, weather.get(key[0]), self._store_ratios[key[0]])
            for key, df in self._histories.items()
        ]
        train = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
        self.is_trained = len(train) >= settings.MIN_DATA_POINTS
        if not self.is_trained:
            return self

        self.use_weather = len(weather) > 0
        self.feature_cols = GLOBAL_FEATURE_COLS + (WEATHER_FEATURE_COLS if self.use_weather else [])
        self._categories = {c: sorted(int(v) for v in train[c].unique()) for c in ("store_id", "menu_id")}

        # 시간순으로 정렬해 두면 아래 KFold 가 날짜 구간 단위 fold 가 된다
        train = train.sort_values("ds", kind="stable").reset_index(drop=True)
        X = self._design(train)
        y = (train["y"] / train["scale"]).to_numpy()

        self.model = XGBRegressor(objective="reg:absoluteerror", **XGB_PARAMS)
        self.model.fit(X, y)

        # 메뉴별 confidence: out-of-fold 예측으로 메뉴마다 실제 오차율(wMAPE)을 잰다
        oof = cross_val_predict(XGBRegressor(objective="reg:absoluteerror", **XGB_PARAMS), X, y, cv=KFold(5))
        train["oof_ae"] = (train["y"] - np.clip(oof, 0, None) * train["scale"]).abs()
        self.scores = {key: DEFAULT_CONFIDENCE for key in self._histories}
        for (sid, mid), g in train.groupby(["store_id", "menu_id"]):
            if len(g) >= MIN_ROWS_FOR_SCORE:
                wmape = float(g["oof_ae"].sum() / max(g["y"].sum(), 1e-9) * 100)
                self.scores[(int(sid), int(mid))] = float(np.clip(100.0 - wmape, 15.0, 95.0))

        self.trained_at = datetime.now()  # #8
        return self

    def _training_rows(
        self,
        key: SeriesKey,
        df: pd.DataFrame,
        weather_df: Optional[pd.DataFrame],
        store_ratios: dict[date, float],
    ) -> pd.DataFrame:
        """메뉴 이력의 각 영업일을 '그 전날까지의 이력으로 그날을 맞히는' 학습 행으로 만든다."""
        f = build_features(df, weather_df)
        # 예측 때(make_future_feature_row)와 같은 규칙: 같은 요일 이력이 없으면 이력 평균, rolling 은 있는 만큼
        hist_mean = f["y"].shift(1).expanding().mean()
        for c in ("lag_7", "lag_14", "rolling_mean_7", "rolling_mean_14"):
            f[c] = f[c].fillna(hist_mean)
        f["store_dow_ratio"] = f["ds"].map(store_ratios)
        f["level"] = _deseasoned(f, store_ratios).shift(1).rolling(LEVEL_WINDOW, min_periods=1).mean()
        f["n_obs"] = np.arange(len(f))
        f["store_id"], f["menu_id"] = key
        f = f.iloc[1:]  # 첫날은 이전 이력이 없다
        if "sold_out" in f.columns:
            # 품절일 판매량은 수요의 하한일 뿐이라 학습 정답에서 뺀다 (다른 날의 lag 값으로는 그대로 쓴다)
            f = f[f["sold_out"] == 0]
        return _with_scale(f)

    def _design(self, f: pd.DataFrame) -> pd.DataFrame:
        X = f.copy()
        for c in SCALED_COLS:
            X[c] = f[c] / f["scale"]
        X["log_level"] = np.log1p(f["level"])
        X["n_obs"] = np.minimum(f["n_obs"], LEVEL_WINDOW)
        for c in ("store_id", "menu_id"):
            # 학습에 없던 매장·메뉴(첫 판매 직후 신메뉴)는 결측으로 들어가 공통 패턴을 따른다
            X[c] = pd.Categorical(f[c], categories=self._categories[c])
        for c in self.feature_cols:
            if c not in X.columns:
                X[c] = np.nan  # 과거 날씨를 못 받은 매장
        return X[self.feature_cols]

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(
        self,
        store_id: int,
        menu_id: int,
        days: int = 7,
        forecast_df: Optional[pd.DataFrame] = None,
        start_date: Optional[date] = None,
    ) -> list[dict]:
        """
        Returns list of dicts:
            {'date': date, 'predicted_qty': int, 'recommended_order_qty': int, 'confidence': float}
        forecast_df: optional 7-day weather forecast DataFrame (이 매장 지역)
        start_date: 이 날짜 다음 날부터 예측 (백테스트용). 없으면 max(마지막 판매일, 오늘)
        """
        hist = self._histories.get((store_id, menu_id))
        if hist is None:
            return self._zero_predictions(days)

        # 판매 데이터가 오래됐을 경우 오늘 기준으로 예측 (과거 날짜에 저장 방지)
        base_date = start_date or max(hist["ds"].max(), date.today())

        if not self.is_trained:
            return self._simple_avg_predictions(hist, base_date, days)

        totals = self._store_totals[store_id]
        level = float(_deseasoned(hist.tail(LEVEL_WINDOW), self._store_ratios[store_id]).mean())
        rows = []
        for i in range(1, days + 1):
            target = base_date + timedelta(days=i)

            weather_row = None
            if forecast_df is not None and not forecast_df.empty:
                match = forecast_df[forecast_df["ds"] == target]
                if not match.empty:
                    weather_row = match.iloc[0].to_dict()

            # #1: 실제 이력만 사용 — 예측값을 lag로 재사용하지 않음 (오차 복리 방지)
            row = make_future_feature_row(target, hist, weather_row=weather_row)
            row.update(
                level=level,
                n_obs=len(hist),
                store_dow_ratio=store_weekday_ratio(totals, target.weekday()),
                store_id=store_id,
                menu_id=menu_id,
            )
            rows.append(row)

        f = _with_scale(pd.DataFrame(rows))
        X = self._design(f)
        point = np.maximum(0, np.round(self.model.predict(X) * f["scale"].to_numpy()))
        base_confidence = max(15.0, self.scores.get((store_id, menu_id), DEFAULT_CONFIDENCE))

        # 안전재고 반영 추천 발주량 = 점추정 × safety_factor. 백엔드가 레시피로 합산하면 식자재 단위로
        # 분위수를 한 번 적용한 값이 된다. 비율이 1에 가까워(≈1.01) 날마다 반올림하면 사라지므로,
        # 기간 합계가 round(합계 × 비율)이 되도록 남는 단위를 소수부가 큰 날부터 1씩 더한다 (최대잔여 방식)
        raw = point * self.safety_factor
        recommended = np.floor(raw)
        extra = int(round(raw.sum() - recommended.sum()))
        recommended[np.argsort(-(raw - recommended), kind="stable")[:extra]] += 1

        predictions = []
        for i, (p, r) in enumerate(zip(point, recommended), start=1):
            predictions.append(
                {
                    "date": base_date + timedelta(days=i),
                    "predicted_qty": int(p),
                    "recommended_order_qty": int(r),
                    # 예측일이 멀수록 신뢰도 감소 (1일차: 0%, 7일차: -9%)
                    "confidence": round(max(15.0, base_confidence - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2),
                }
            )
        return predictions

    def _simple_avg_predictions(self, hist: pd.DataFrame, last_date: date, days: int) -> list[dict]:
        """요일별 평균으로 단순 예측 (전체 학습 데이터가 MIN_DATA_POINTS 미만일 때만 사용)."""
        df = hist.copy()
        n = len(df)
        df["dow"] = pd.to_datetime(df["ds"]).dt.dayofweek
        dow_mean = df.groupby("dow")["y"].mean().to_dict()
        dow_values = df.groupby("dow")["y"].apply(list).to_dict()
        overall_mean = float(df["y"].mean()) if n > 0 else 0.0
        overall_values = df["y"].tolist()

        # #4: 데이터가 매우 적으면 신뢰도 상한을 낮춤
        base_confidence = 30.0 if n < 7 else 40.0

        predictions = []
        for i in range(1, days + 1):
            target = last_date + timedelta(days=i)
            dow = target.weekday()
            qty = max(0, round(dow_mean.get(dow, overall_mean)))

            # 모델이 없으므로 요일별(부족하면 전체) 판매 이력의 critical fractile
            # 경험적 분위수로 추천 발주량 근사
            values = dow_values.get(dow) or overall_values
            rec_qty = max(qty, int(np.ceil(np.percentile(values, self.critical_fractile * 100)))) if values else qty

            confidence = round(max(15.0, base_confidence - (i - 1) * CONFIDENCE_DECAY_PER_DAY), 2)
            predictions.append({
                "date": target,
                "predicted_qty": qty,
                "recommended_order_qty": rec_qty,
                "confidence": confidence,
            })
        return predictions

    def _zero_predictions(self, days: int) -> list[dict]:
        today = date.today()
        return [
            {
                "date": today + timedelta(days=i),
                "predicted_qty": 0,
                "recommended_order_qty": 0,
                "confidence": 0.0,
            }
            for i in range(1, days + 1)
        ]

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def save(self) -> str:
        path = os.path.join(settings.MODEL_DIR, "global_model.joblib")
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, path)
        return path


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ds"] = pd.to_datetime(df["ds"]).dt.date
    df = df.sort_values("ds").reset_index(drop=True)
    df["y"] = df["y"].astype(float).clip(lower=0)

    # #11: 이상치 상한 클리핑 — 상위 1% × 3배 초과 데이터 제거
    if len(df) >= 10:
        upper = df["y"].quantile(0.99) * 3
        df["y"] = df["y"].clip(upper=max(float(upper), 1.0))
    return df


def _store_totals(histories: dict[SeriesKey, pd.DataFrame]) -> dict[int, pd.Series]:
    """매장별 전체 메뉴 일 판매량 합계 (영업일 순)."""
    parts: dict[int, list[pd.Series]] = {}
    for (sid, _), df in histories.items():
        parts.setdefault(sid, []).append(df.set_index("ds")["y"])
    return {sid: pd.concat(p).groupby(level=0).sum().sort_index() for sid, p in parts.items()}


def _past_store_ratios(totals: pd.Series) -> dict[date, float]:
    """각 영업일의 매장 요일 비율을 그 전날까지의 매장 판매량으로 계산 (학습 행용)."""
    return {d: store_weekday_ratio(totals.iloc[:i], d.weekday()) for i, d in enumerate(totals.index)}


def _deseasoned(df: pd.DataFrame, store_ratios: dict[date, float]) -> pd.Series:
    """
    판매량 / 그날의 매장 요일 비율. 메뉴 규모(level)를 요일 효과를 뺀 값으로 재서,
    이력이 주말에 몰린 신메뉴도 규모가 부풀지 않게 한다.
    """
    ratio = df["ds"].map(store_ratios)
    return df["y"] / ratio.where(ratio > 0, 1.0)


def _with_scale(f: pd.DataFrame) -> pd.DataFrame:
    f = f.copy()
    f["scale"] = np.maximum(f["level"] * f["store_dow_ratio"], 1.0)
    return f
