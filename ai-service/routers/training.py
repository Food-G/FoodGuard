from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from schemas.schemas import TrainResponse
from services import model_registry
from services.prediction_service import train_store_models

router = APIRouter()


@router.post("/store/{store_id}", response_model=None)
def train_store(
    store_id: int,
    target: str = Query("champion", pattern="^(champion|challenger)$"),
    db: Session = Depends(get_db),
):
    """매장의 모든 메뉴 모델을 강제 재학습. target=challenger 면 운영 모델은 그대로 두고 챌린저만 학습·비교한다."""
    try:
        if target == "challenger":
            return model_registry.train_challenger(db, store_id)
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


@router.post("/store/{store_id}/promote")
def promote(store_id: int, expect: str):
    """챔피언을 보관하고 챌린저로 교체. Spring ProposalExecutor.MODEL_PROMOTE 만 호출한다."""
    try:
        return model_registry.promote(store_id, expect)
    except model_registry.ChallengerMismatch as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/store/{store_id}/rollback")
def rollback(store_id: int, to: str):
    try:
        return model_registry.rollback(store_id, to)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/store/{store_id}/status")
def model_status(store_id: int, db: Session = Depends(get_db)):
    return model_registry.status(db, store_id)
