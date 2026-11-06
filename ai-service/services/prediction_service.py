"""수요 예측 비즈니스 로직."""

import logging
from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from config import settings
from ml.demand_predictor import DemandPredictor
from services.data_service import (
    get_active_menus,
    get_sales_data,
    get_store_region,
    get_store_sales_start_date,
    save_predictions_bulk,
)
from services.weather_service import (
    fetch_forecast_weather,
    fetch_historical_weather,
    get_coords,
)

logger = logging.getLogger(__name__)

MODEL_VERSION = "rf_weather_v1.0"


def predict_and_save_store(db: Session, store_id: int) -> dict:
    """
    매장의 모든 활성 메뉴에 대해 예측 수행 후 DB 저장.
    날씨 API는 매장당 1회만 호출해서 모든 메뉴가 공유한다.
    반환: {menu_id: predictions_list}
    """
    menus = get_active_menus(db, store_id)
    if not menus:
        return {}

    region = get_store_region(db, store_id)

    # 기상청 7일 예보 (예측용) — API 키 없으면 빈 DataFrame
    forecast_df = fetch_forecast_weather(
        region, settings.KMA_API_KEY, days=settings.PREDICTION_DAYS
    )

    # Open-Meteo 좌표 (과거 날씨 학습용)
    lat, lon = get_coords(region)

    # 과거 날씨는 매장 전체 기간에 대해 1회만 조회해서 모든 메뉴가 공유한다
    # (예전에는 메뉴마다 같은 구간을 반복 호출했다)
    hist_weather_df: Optional[pd.DataFrame] = None
    start_date = get_store_sales_start_date(db, store_id)
    db.commit()
    if start_date is not None:
        hist = fetch_historical_weather(lat, lon, start_date, date.today())
        if not hist.empty:
            hist_weather_df = hist

    results = {}
    for menu in menus:
        menu_id = menu["menu_id"]
        predictions = predict_and_save_menu(
            db, store_id, menu_id,
            lat=lat, lon=lon, forecast_df=forecast_df,
            hist_weather_df=hist_weather_df,
        )
        results[menu_id] = predictions

    return results


def predict_and_save_menu(
    db: Session,
    store_id: int,
    menu_id: int,
    days: int | None = None,
    lat: float | None = None,
    lon: float | None = None,
    forecast_df: Optional[pd.DataFrame] = None,
    hist_weather_df: Optional[pd.DataFrame] = None,
) -> list[dict]:
    """
    특정 메뉴 예측 수행 후 DB 저장.
    lat/lon/forecast_df 미제공 시 내부에서 직접 날씨 API를 호출한다.
    hist_weather_df 를 넘기면 과거 날씨 API 호출을 건너뛴다 (매장 단위 호출 공유).
    반환: prediction dict list
    """
    if days is None:
        days = settings.PREDICTION_DAYS

    if lat is None:
        region = get_store_region(db, store_id)
        lat, lon = get_coords(region)
        forecast_df = fetch_forecast_weather(
            region, settings.KMA_API_KEY, days=days
        )

    sales_df = get_sales_data(db, store_id, menu_id)
    # 외부 API 호출·학습 동안 읽기 트랜잭션을 열어 두면 TiDB 가 연결을 끊는다 ('Lost connection'). 여기서 끝낸다.
    db.commit()

    # Open-Meteo로 과거 날씨 조회 (모델 학습에 날씨 패턴 반영)
    weather_df: Optional[pd.DataFrame] = hist_weather_df
    if weather_df is None and not sales_df.empty:
        start_date = sales_df["ds"].min()
        hist = fetch_historical_weather(lat, lon, start_date, date.today())
        if not hist.empty:
            weather_df = hist

    predictor = DemandPredictor.load(store_id, menu_id)

    # 저장된 모델이 지금과 같은 판매 이력으로 학습돼 있으면 재학습을 건너뛴다
    # (예전에는 load 직후 무조건 fit 해서 모델 캐시가 무의미했다)
    if predictor is not None and predictor.is_trained and predictor.matches_history(sales_df):
        logger.info("store=%s menu=%s: 저장된 모델 재사용 (재학습 생략)", store_id, menu_id)
    else:
        if predictor is None:
            predictor = DemandPredictor(store_id, menu_id)
        predictor.fit(sales_df, weather_df=weather_df)
        if predictor.is_trained:
            predictor.save()

    predictions = predictor.predict(
        days=days,
        forecast_df=forecast_df if (forecast_df is not None and not forecast_df.empty) else None,
    )
    save_predictions_bulk(db, store_id, menu_id, predictions, model_version=predictor.version_label(MODEL_VERSION))

    return predictions


def train_store_models(db: Session, store_id: int) -> dict[int, float]:
    """매장의 모든 메뉴 모델을 강제 재학습. 반환: {menu_id: model_score}"""
    menus = get_active_menus(db, store_id)
    scores: dict[int, float] = {}

    region = get_store_region(db, store_id)
    lat, lon = get_coords(region)

    for menu in menus:
        menu_id = menu["menu_id"]
        sales_df = get_sales_data(db, store_id, menu_id)
        db.commit()

        weather_df = None
        if not sales_df.empty:
            hist = fetch_historical_weather(lat, lon, sales_df["ds"].min(), date.today())
            if not hist.empty:
                weather_df = hist

        # 승격된 학습 정책은 강제 재학습에서도 유지한다
        current = DemandPredictor.load(store_id, menu_id)
        predictor = DemandPredictor(store_id, menu_id,
                                    train_window_days=current.train_window_days if current else None)
        predictor.fit(sales_df, weather_df=weather_df)

        if predictor.is_trained:
            predictor.save()
            scores[menu_id] = round(predictor.score * 100, 1)
        else:
            scores[menu_id] = 0.0

    return scores
