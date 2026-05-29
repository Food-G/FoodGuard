from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from schemas.schemas import (
    SingleMenuPredictionResponse,
    StorePredictionResponse,
    TriggerResponse,
    MenuPrediction,
    PredictionItem,
)
from services.data_service import get_active_menus, get_saved_predictions, get_store_region
from services.prediction_service import predict_and_save_menu, predict_and_save_store
from services.weather_service import fetch_forecast_weather, get_coords

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


@router.post("/store/{store_id}/menu/{menu_id}", response_model=SingleMenuPredictionResponse)
def trigger_menu_prediction(
    store_id: int, menu_id: int, db: Session = Depends(get_db)
):
    """특정 메뉴 예측 실행."""
    menus = get_active_menus(db, store_id)
    menu = next((m for m in menus if m["menu_id"] == menu_id), None)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    try:
        # #12: 날씨 API를 여기서 한 번만 호출 (predict_and_save_menu 내부 재호출 방지)
        region = get_store_region(db, store_id)
        lat, lon = get_coords(region)
        forecast_df = fetch_forecast_weather(region, settings.KMA_API_KEY, days=settings.PREDICTION_DAYS)

        raw_preds = predict_and_save_menu(db, store_id, menu_id, lat=lat, lon=lon, forecast_df=forecast_df)
        items = [
            PredictionItem(
                prediction_date=p["date"],
                predicted_qty=p["predicted_qty"],
                confidence=p["confidence"],
            )
            for p in raw_preds
        ]
        return SingleMenuPredictionResponse(
            store_id=store_id,
            menu_id=menu_id,
            menu_name=menu["menu_name"],
            generated_at=datetime.now(),
            predictions=items,
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
