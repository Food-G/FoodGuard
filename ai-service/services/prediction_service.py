"""수요 예측 비즈니스 로직."""

from datetime import datetime

from sqlalchemy.orm import Session

from config import settings
from ml.demand_predictor import DemandPredictor
from services.data_service import (
    get_active_menus,
    get_sales_data,
    save_predictions_bulk,
)

MODEL_VERSION = "rf_v1.0"


def predict_and_save_store(db: Session, store_id: int) -> dict:
    """
    매장의 모든 활성 메뉴에 대해 예측 수행 후 DB 저장.
    반환: {menu_id: predictions_list}
    """
    menus = get_active_menus(db, store_id)
    if not menus:
        return {}

    results = {}
    for menu in menus:
        menu_id = menu["menu_id"]
        predictions = predict_and_save_menu(db, store_id, menu_id)
        results[menu_id] = predictions

    return results


def predict_and_save_menu(
    db: Session,
    store_id: int,
    menu_id: int,
    days: int | None = None,
) -> list[dict]:
    """
    특정 메뉴 예측 수행 후 DB 저장.
    반환: prediction dict list
    """
    if days is None:
        days = settings.PREDICTION_DAYS

    sales_df = get_sales_data(db, store_id, menu_id)

    # 캐시된 모델 로드 or 새 모델 생성
    predictor = DemandPredictor.load(store_id, menu_id)
    if predictor is None:
        predictor = DemandPredictor(store_id, menu_id)

    predictor.fit(sales_df)

    if predictor.is_trained:
        predictor.save()

    predictions = predictor.predict(days=days)
    save_predictions_bulk(db, store_id, menu_id, predictions, model_version=MODEL_VERSION)

    return predictions


def train_store_models(db: Session, store_id: int) -> dict[int, float]:
    """
    매장의 모든 메뉴 모델을 강제 재학습.
    반환: {menu_id: model_score}
    """
    menus = get_active_menus(db, store_id)
    scores: dict[int, float] = {}

    for menu in menus:
        menu_id = menu["menu_id"]
        sales_df = get_sales_data(db, store_id, menu_id)

        predictor = DemandPredictor(store_id, menu_id)
        predictor.fit(sales_df)

        if predictor.is_trained:
            predictor.save()
            scores[menu_id] = round(predictor.score * 100, 1)
        else:
            scores[menu_id] = 0.0

    return scores
