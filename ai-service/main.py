"""FoodGuard AI Service - 수요 예측 FastAPI 서버."""

import logging
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import accuracy, prediction, training
from schemas.schemas import HealthResponse

logger = logging.getLogger(__name__)

if not settings.INTERNAL_API_TOKEN:
    logger.warning("INTERNAL_API_TOKEN 이 비어 있어 내부 인증 없이 동작합니다 (개발 모드).")


def verify_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    """Spring 만 호출하도록 공유 비밀을 확인한다. 토큰 미설정 시(개발 모드) 통과."""
    expected = settings.INTERNAL_API_TOKEN
    if expected and not secrets.compare_digest(x_internal_token or "", expected):
        raise HTTPException(status_code=401, detail="invalid internal token")


app = FastAPI(
    title="FoodGuard AI Service",
    description="식품 수요 예측 AI 서비스 (Random Forest 기반)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

internal = [Depends(verify_internal_token)]  # /health 를 뺀 전 라우터
app.include_router(prediction.router, prefix="/api/predict", tags=["Prediction"], dependencies=internal)
app.include_router(training.router, prefix="/api/train", tags=["Training"], dependencies=internal)
app.include_router(accuracy.router, prefix="/api/accuracy", tags=["Accuracy"], dependencies=internal)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(
        status="ok",
        service="FoodGuard AI Service",
        version="1.0.0",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.AI_SERVICE_PORT, reload=True)
