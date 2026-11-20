from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.schemas import (
    StorePredictionResponse,
    TriggerResponse,
    MenuPrediction,
    PredictionItem,
)
from services.data_service import get_saved_predictions
from services.prediction_service import predict_and_save_store

router = APIRouter()


@router.post("/store/{store_id}", response_model=TriggerResponse)
def trigger_store_prediction(store_id: int, db: Session = Depends(get_db)):
    """매장의 모든 메뉴에 대해 예측을 실행하고 DB에 저장."""
    try:
        results = predict_and_save_store(db, store_id)
        return TriggerResponse(
            status="success",
            message=f"Store {store_id} prediction complete",
            store_id=store_id,
            menus_predicted=len(results),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/store/{store_id}", response_model=StorePredictionResponse)
def get_store_predictions(store_id: int, db: Session = Depends(get_db)):
    """저장된 예측 결과 조회 (오늘 이후)."""
    rows = get_saved_predictions(db, store_id)

    # menu_id별로 그룹핑
    menu_map: dict[int, dict] = {}
    for r in rows:
        mid = r["menu_id"]
        if mid not in menu_map:
            menu_map[mid] = {"menu_id": mid, "menu_name": r["menu_name"], "predictions": []}
        menu_map[mid]["predictions"].append(
            PredictionItem(
                prediction_date=r["prediction_date"],
                predicted_qty=r["predicted_qty"],
                recommended_order_qty=r["recommended_order_qty"],
                confidence=r["confidence"],
            )
        )

    menus = [
        MenuPrediction(
            menu_id=v["menu_id"],
            menu_name=v["menu_name"],
            predictions=v["predictions"],
        )
        for v in menu_map.values()
    ]

    return StorePredictionResponse(
        store_id=store_id,
        generated_at=datetime.now(),
        menus=menus,
    )
