from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DB_URL: str = "mysql+pymysql://root:password@localhost:3306/foodguard"
    DB_SSL: bool = True
    AI_SERVICE_PORT: int = 8000
    MODEL_DIR: str = "trained_models"
    PREDICTION_DAYS: int = 7
    MIN_DATA_POINTS: int = 7       # 글로벌 모델 최소 학습 행 수 (전체 매장·메뉴 합계, 미만이면 요일 평균 사용)
    KMA_API_KEY: str = ""  # data.go.kr 기상청 API 키
    COST_RATIO: float = 0.4  # 원가 데이터 미보유로 인한 근사치: 원가 ≈ 판매가의 40%
    # 발주 근거 설명용 claude CLI 실행 파일. Windows 는 claude.cmd 대신 claude.exe 경로를 적는다
    # (npm 전역 설치: %APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe)
    CLAUDE_CLI: str = "claude"

    model_config = {"env_file": ".env"}


settings = Settings()
