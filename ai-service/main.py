"""FoodGuard AI Service - 수요 예측 FastAPI 서버."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import prediction, training
from schemas.schemas import HealthResponse

app = FastAPI(
    title="FoodGuard AI Service",
    description="식품 수요 예측 AI 서비스 (Random Forest 기반)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prediction.router, prefix="/api/predict", tags=["Prediction"])
app.include_router(training.router, prefix="/api/train", tags=["Training"])


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
