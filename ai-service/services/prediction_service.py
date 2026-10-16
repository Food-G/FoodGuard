"""수요 예측 비즈니스 로직."""

from datetime import date
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from config import settings
from ml.demand_predictor import DemandPredictor
from services.data_service import (
    get_active_menus,
    get_all_sales_data,
    get_closed_dates,
    get_store_region,
    save_predictions_bulk,
)
from services.weather_service import (
    fetch_forecast_weather,
    fetch_historical_weather,
    get_coords,
)

# v1.1: 판매 이력 영업일 달력 정렬(0 채움), lag 달력 기준·lag_1 제거, 품절일 학습 제외
# v2.0: 메뉴별 로컬 모델 → 전체 매장·메뉴 글로벌 모델 (PROJECT_STATUS.md 10절)
MODEL_VERSION = "xgb_global_v2.0"


def train_global_model(db: Session) -> DemandPredictor:
    """전체 매장×메뉴 판매 이력 + 매장별 과거 날씨로 글로벌 모델을 학습한다."""
    series = get_all_sales_data(db)

    # Open-Meteo로 과거 날씨 조회 (매장 지역별 1회, 모델 학습에 날씨 패턴 반영)
    weather: dict[int, pd.DataFrame] = {}
    for store_id in {sid for sid, _ in series}:
        start_date = min(df["ds"].min() for (sid, _), df in series.items() if sid == store_id)
        lat, lon = get_coords(get_store_region(db, store_id))
        hist = fetch_historical_weather(lat, lon, start_date, date.today())
        if not hist.empty:
            weather[store_id] = hist

    predictor = DemandPredictor().fit(series, weather=weather)
    if predictor.is_trained:
        predictor.save()
    return predictor


def predict_and_save_store(db: Session, store_id: int) -> dict:
    """
    매장의 모든 활성 메뉴에 대해 예측 수행 후 DB 저장.
    글로벌 모델은 요청당 1회 학습해서 모든 메뉴가 공유한다.
    반환: {menu_id: predictions_list}
    """
    menus = get_active_menus(db, store_id)
    if not menus:
        return {}

    # 기상청 7일 예보 (예측용) — API 키 없으면 빈 DataFrame
    forecast_df = fetch_forecast_weather(
        get_store_region(db, store_id), settings.KMA_API_KEY, days=settings.PREDICTION_DAYS
    )
    predictor = train_global_model(db)

    return {
        menu["menu_id"]: _predict_and_save(db, predictor, store_id, menu["menu_id"], forecast_df)
        for menu in menus
    }


def predict_and_save_menu(
    db: Session,
    store_id: int,
    menu_id: int,
    forecast_df: Optional[pd.DataFrame] = None,
) -> list[dict]:
    """
    특정 메뉴 예측 수행 후 DB 저장.
    forecast_df 미제공 시 내부에서 직접 예보 API를 호출한다.
    반환: prediction dict list
    """
    if forecast_df is None:
        forecast_df = fetch_forecast_weather(
            get_store_region(db, store_id), settings.KMA_API_KEY, days=settings.PREDICTION_DAYS
        )
    return _predict_and_save(db, train_global_model(db), store_id, menu_id, forecast_df)


def _predict_and_save(
    db: Session,
    predictor: DemandPredictor,
    store_id: int,
    menu_id: int,
    forecast_df: Optional[pd.DataFrame],
) -> list[dict]:
    predictions = predictor.predict(
        store_id,
        menu_id,
        days=settings.PREDICTION_DAYS,
        forecast_df=forecast_df if (forecast_df is not None and not forecast_df.empty) else None,
    )
    # 휴무로 등록된 날은 팔지 않으므로 발주 근거에서 뺀다
    closed = get_closed_dates(db, store_id)
    for p in predictions:
        if p["date"] in closed:
            p["predicted_qty"] = p["recommended_order_qty"] = 0
    save_predictions_bulk(db, store_id, menu_id, predictions, model_version=MODEL_VERSION)

    return predictions


def train_store_models(db: Session, store_id: int) -> dict[int, float]:
    """글로벌 모델을 강제 재학습. 반환: 이 매장 활성 메뉴의 {menu_id: model_score}"""
    predictor = train_global_model(db)
    # score는 이미 0~100 스케일 (wMAPE 기반). 판매 이력이 없는 메뉴는 0
    return {
        menu["menu_id"]: round(predictor.scores.get((store_id, menu["menu_id"]), 0.0), 1)
        for menu in get_active_menus(db, store_id)
    }
