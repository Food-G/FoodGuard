from datetime import date, datetime
from pydantic import BaseModel


class PredictionItem(BaseModel):
    prediction_date: date
    predicted_qty: int
    recommended_order_qty: int
    confidence: float


class MenuPrediction(BaseModel):
    menu_id: int
    menu_name: str
    predictions: list[PredictionItem]


class StorePredictionResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    store_id: int
    generated_at: datetime
    menus: list[MenuPrediction]
    model_versions: dict[int, str] = {}


class TriggerResponse(BaseModel):
    status: str
    message: str
    store_id: int
    menus_predicted: int = 0


class TrainResponse(BaseModel):
    status: str
    message: str
    store_id: int
    models_trained: int = 0
    scores: dict[int, float] = {}


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
