from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:password@localhost:3306/foodguard"
    DB_SSL: bool = True
    AI_SERVICE_PORT: int = 8000
    MODEL_DIR: str = "trained_models"
    PREDICTION_DAYS: int = 7
    MIN_DATA_POINTS: int = 7

    model_config = {"env_file": ".env"}


settings = Settings()
