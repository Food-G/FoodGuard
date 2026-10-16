from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from schemas.schemas import TrainResponse
from services.prediction_service import train_store_models

router = APIRouter()


@router.post("/store/{store_id}", response_model=TrainResponse)
def train_store(store_id: int, db: Session = Depends(get_db)):
    """매장의 모든 메뉴 모델을 강제 재학습."""
    try:
        scores = train_store_models(db, store_id)
        return TrainResponse(
            status="success",
            message=f"Training complete for store {store_id}",
            store_id=store_id,
            models_trained=len(scores),
            scores=scores,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
