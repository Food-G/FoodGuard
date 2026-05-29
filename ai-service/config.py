from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:password@localhost:3306/foodguard"
    DB_SSL: bool = True
    AI_SERVICE_PORT: int = 8000
    MODEL_DIR: str = "trained_models"
    PREDICTION_DAYS: int = 7
    MIN_DATA_POINTS: int = 7       # 최소 학습 데이터 수 (미만이면 요일 평균 사용)
    MIN_DATA_POINTS_MID: int = 15  # 중간 피처셋 전환 기준
    MIN_DATA_POINTS_FULL: int = 30 # 전체 피처셋 전환 기준
    KMA_API_KEY: str = ""  # data.go.kr 기상청 API 키

    model_config = {"env_file": ".env"}


settings = Settings()
