"""FoodGuard AI Service - 수요 예측 FastAPI 서버."""

from fastapi import Depends, FastAPI

from auth import verify_internal_key
from config import settings
from routers import agents, events, explain, ingest, prediction, training
from schemas.schemas import HealthResponse

# 다른 컨테이너·서버에서 접근 가능하게 열면서 키가 없으면 누구나 예측·Claude 를 부를 수 있다
if settings.AI_SERVICE_HOST not in ("127.0.0.1", "localhost") and not settings.INTERNAL_API_KEY:
    raise RuntimeError("AI_SERVICE_HOST 를 외부에 열 때는 INTERNAL_API_KEY 가 필요합니다")

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
app.include_router(ingest.router, prefix="/api/ingest", tags=["Ingest"], dependencies=_internal)
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"], dependencies=_internal)


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
