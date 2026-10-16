"""FoodGuard AI 서비스 기능을 MCP 도구로 노출하는 서버.

에이전트(Claude 등)가 예측/학습/데이터 조회 함수를 tool-call로 직접 사용할 수 있게 한다.
routers/services 계층의 기존 함수를 그대로 감싸며, 새 비즈니스 로직은 추가하지 않는다.
"""

from mcp.server.fastmcp import FastMCP

from database import SessionLocal
from services.data_service import get_active_menus, get_sales_data, get_saved_predictions
from services.prediction_service import (
    predict_and_save_menu,
    predict_and_save_store,
    train_store_models,
)

mcp = FastMCP("foodguard-ai")


def _serialize(predictions: list[dict]) -> list[dict]:
    return [{**p, "date": p["date"].isoformat()} for p in predictions]


@mcp.tool()
def predict_store(store_id: int) -> dict[int, list[dict]]:
    """매장의 모든 활성 메뉴에 대해 7일 수요 예측을 실행하고 DB(PREDICTION_RESULT)에 저장한다."""
    with SessionLocal() as db:
        results = predict_and_save_store(db, store_id)
        return {menu_id: _serialize(preds) for menu_id, preds in results.items()}


@mcp.tool()
def predict_menu(store_id: int, menu_id: int) -> list[dict]:
    """특정 메뉴의 7일 수요 예측을 실행하고 DB에 저장한다."""
    with SessionLocal() as db:
        return _serialize(predict_and_save_menu(db, store_id, menu_id))


@mcp.tool()
def train_store(store_id: int) -> dict[int, float]:
    """매장의 모든 메뉴 모델을 강제 재학습하고 메뉴별 정확도 점수(%)를 반환한다."""
    with SessionLocal() as db:
        return train_store_models(db, store_id)


@mcp.tool()
def get_predictions(store_id: int) -> list[dict]:
    """DB에 저장된, 오늘 이후의 예측 결과를 조회한다."""
    with SessionLocal() as db:
        return get_saved_predictions(db, store_id)


@mcp.tool()
def get_menus(store_id: int) -> list[dict]:
    """매장의 활성 메뉴 목록(menu_id, menu_name, category, price)을 조회한다."""
    with SessionLocal() as db:
        return get_active_menus(db, store_id)


@mcp.tool()
def get_sales_history(store_id: int, menu_id: int) -> list[dict]:
    """특정 메뉴의 날짜별 판매 수량 이력을 조회한다."""
    with SessionLocal() as db:
        df = get_sales_data(db, store_id, menu_id)
        return [{"date": row.ds.isoformat(), "qty": row.y} for row in df.itertuples()]


if __name__ == "__main__":
    mcp.run()
