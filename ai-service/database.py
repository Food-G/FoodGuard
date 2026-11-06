from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import settings

_connect_args = {"ssl": {"ssl-mode": "verify-identity"}} if settings.DB_SSL else {}

engine = create_engine(
    settings.DB_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    pool_recycle=180,  # TiDB Cloud 가 유휴 연결을 먼저 끊으므로 그보다 짧게
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
