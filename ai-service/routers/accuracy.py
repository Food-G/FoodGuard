from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from services.accuracy_service import evaluate, evaluate_recent_live

router = APIRouter()


@router.get("")
def get_accuracy(
    source: str = Query("backtest", pattern="^(backtest|live)$"),
    store_id: Optional[int] = None,
    run_id: Optional[str] = None,
    window_days: Optional[int] = Query(None, ge=1, le=90),
    db: Session = Depends(get_db),
):
    """PREDICTION_LOG 와 실제 판매를 대조한 정확도 (읽기 전용). run_id 생략 시 해당 source 의 최신 실행.
    source=live 에 window_days 를 주면 최근 N일 대상 예측을 평가한다."""
    if source == "live" and window_days:
        return evaluate_recent_live(db, window_days, store_id)
    return evaluate(db, source=source, run_id=run_id, store_id=store_id)
