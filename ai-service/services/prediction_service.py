"""수요 예측 비즈니스 로직."""

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
    save_predictions_bulk,
)
from services.weather_service import (
    fetch_forecast_weather,
    fetch_historical_weather,
    get_coords,
)

MODEL_VERSION = "xgb_weather_v1.0"


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

    results = {}
    for menu in menus:
        menu_id = menu["menu_id"]
        predictions = predict_and_save_menu(
            db, store_id, menu_id,
            lat=lat, lon=lon, forecast_df=forecast_df,
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
) -> list[dict]:
    """
    특정 메뉴 예측 수행 후 DB 저장.
    lat/lon/forecast_df 미제공 시 내부에서 직접 날씨 API를 호출한다.
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

    # Open-Meteo로 과거 날씨 조회 (모델 학습에 날씨 패턴 반영)
    weather_df: Optional[pd.DataFrame] = None
    if not sales_df.empty:
        start_date = sales_df["ds"].min()
        hist = fetch_historical_weather(lat, lon, start_date, date.today())
        if not hist.empty:
            weather_df = hist

    predictor = DemandPredictor.load(store_id, menu_id)
    if predictor is None:
        predictor = DemandPredictor(store_id, menu_id)

    predictor.fit(sales_df, weather_df=weather_df)

    if predictor.is_trained:
        predictor.save()

    predictions = predictor.predict(
        days=days,
        forecast_df=forecast_df if (forecast_df is not None and not forecast_df.empty) else None,
    )
    save_predictions_bulk(db, store_id, menu_id, predictions, model_version=MODEL_VERSION)

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

        weather_df = None
        if not sales_df.empty:
            hist = fetch_historical_weather(lat, lon, sales_df["ds"].min(), date.today())
            if not hist.empty:
                weather_df = hist

        predictor = DemandPredictor(store_id, menu_id)
        predictor.fit(sales_df, weather_df=weather_df)

        if predictor.is_trained:
            predictor.save()
            scores[menu_id] = round(predictor.score, 1)  # score는 이미 0~100 스케일 (wMAPE 기반)
        else:
            scores[menu_id] = 0.0

    return scores
