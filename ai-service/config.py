from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:password@localhost:3306/foodguard"
    DB_SSL: bool = True
    AI_SERVICE_PORT: int = 8000
    MODEL_DIR: str = "trained_models"
    PREDICTION_DAYS: int = 7
    MIN_DATA_POINTS: int = 7
    KMA_API_KEY: str = ""  # data.go.kr 기상청 API 키

    # .env 를 fgcli(FOODGUARD_*)와 같이 쓰므로 모르는 키는 무시한다
    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
