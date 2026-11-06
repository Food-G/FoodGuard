"""FoodGuard AI Service - 수요 예측 FastAPI 서버."""

from fastapi import Depends, FastAPI

from auth import verify_internal_key
from config import settings
from routers import events, explain, prediction, training
from schemas.schemas import HealthResponse

app = FastAPI(
    title="FoodGuard AI Service",
    description="식품 수요 예측 AI 서비스 (글로벌 XGBoost 기반)",
    version="1.0.0",
)

# 브라우저는 백엔드만 부르므로 CORS 는 열지 않는다. /health 만 키 없이 열어 둔다
_internal = [Depends(verify_internal_key)]
app.include_router(prediction.router, prefix="/api/predict", tags=["Prediction"], dependencies=_internal)
app.include_router(training.router, prefix="/api/train", tags=["Training"], dependencies=_internal)
app.include_router(explain.router, prefix="/api/explain", tags=["Explain"], dependencies=_internal)
app.include_router(events.router, prefix="/api/events", tags=["Events"], dependencies=_internal)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    return HealthResponse(
        status="ok",
        service="FoodGuard AI Service",
        version="1.0.0",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.AI_SERVICE_HOST, port=settings.AI_SERVICE_PORT, reload=settings.AI_RELOAD)
