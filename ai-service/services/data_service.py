"""DB 데이터 접근 레이어 (순수 SQL로 Spring Boot의 기존 스키마 읽기/쓰기)."""

from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
import pandas as pd


def get_active_menus(db: Session, store_id: int) -> list[dict]:
    """매장의 활성화된 메뉴 목록 반환."""
    rows = db.execute(
        text(
            "SELECT menu_id, menu_name, category, price "
            "FROM MENU "
            "WHERE store_id = :sid AND is_active = 1"
        ),
        {"sid": store_id},
    ).fetchall()
    return [{"menu_id": r[0], "menu_name": r[1], "category": r[2], "price": r[3]} for r in rows]


def get_sales_data(db: Session, store_id: int, menu_id: int) -> pd.DataFrame:
    """특정 매장/메뉴의 판매 이력 반환 (is_deleted=0 만)."""
    rows = db.execute(
        text(
            "SELECT sales_date, SUM(quantity) as qty "
            "FROM SALES_DATA "
            "WHERE store_id = :sid AND menu_id = :mid AND is_deleted = 0 "
            "GROUP BY sales_date "
            "ORDER BY sales_date ASC"
        ),
        {"sid": store_id, "mid": menu_id},
    ).fetchall()

    if not rows:
        return pd.DataFrame(columns=["ds", "y"])

    df = pd.DataFrame(rows, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"]).dt.date
    df["y"] = df["y"].astype(float)
    return df


def get_store_sales_last_n_days(db: Session, store_id: int, n_days: int = 30) -> list[dict]:
    """대시보드용 매장 전체 최근 판매 데이터."""
    rows = db.execute(
        text(
            "SELECT sd.sales_date, m.menu_id, m.menu_name, SUM(sd.quantity) as qty "
            "FROM SALES_DATA sd "
            "JOIN MENU m ON sd.menu_id = m.menu_id "
            "WHERE sd.store_id = :sid "
            "  AND sd.is_deleted = 0 "
            "  AND sd.sales_date >= DATE_SUB(CURDATE(), INTERVAL :n DAY) "
            "GROUP BY sd.sales_date, m.menu_id, m.menu_name "
            "ORDER BY sd.sales_date ASC"
        ),
        {"sid": store_id, "n": n_days},
    ).fetchall()
    return [
        {"date": str(r[0]), "menu_id": r[1], "menu_name": r[2], "qty": int(r[3])}
        for r in rows
    ]


def save_predictions_bulk(
    db: Session,
    store_id: int,
    menu_id: int,
    predictions: list[dict],
    model_version: str = "rf_v1.0",
) -> None:
    """
    PREDICTION_RESULT 테이블에 예측값 저장.
    같은 (store_id, menu_id, target_date)가 이미 있으면 덮어씀.
    """
    # 기존 미래 예측 삭제 (재예측 시 중복 방지)
    db.execute(
        text(
            "DELETE FROM PREDICTION_RESULT "
            "WHERE store_id = :sid AND menu_id = :mid AND target_date >= CURDATE()"
        ),
        {"sid": store_id, "mid": menu_id},
    )

    for p in predictions:
        db.execute(
            text(
                "INSERT INTO PREDICTION_RESULT "
                "(store_id, menu_id, target_date, predicted_qty, confidence, model_version) "
                "VALUES (:sid, :mid, :tdate, :qty, :conf, :ver)"
            ),
            {
                "sid": store_id,
                "mid": menu_id,
                "tdate": p["date"],
                "qty": p["predicted_qty"],
                "conf": p["confidence"],
                "ver": model_version,
            },
        )

    db.commit()


def get_store_region(db: Session, store_id: int) -> str | None:
    """매장의 지역명 반환 (날씨 API 좌표 조회용)."""
    row = db.execute(
        text("SELECT region FROM STORE WHERE store_id = :sid"),
        {"sid": store_id},
    ).fetchone()
    return row[0] if row else None


def get_saved_predictions(db: Session, store_id: int) -> list[dict]:
    """저장된 예측 결과 조회 (오늘 이후)."""
    rows = db.execute(
        text(
            "SELECT pr.prediction_id, pr.menu_id, m.menu_name, "
            "       pr.target_date, pr.predicted_qty, pr.confidence, "
            "       pr.model_version, pr.created_at "
            "FROM PREDICTION_RESULT pr "
            "JOIN MENU m ON pr.menu_id = m.menu_id "
            "WHERE pr.store_id = :sid AND pr.target_date >= CURDATE() "
            "ORDER BY pr.target_date ASC, m.menu_name ASC"
        ),
        {"sid": store_id},
    ).fetchall()
    return [
        {
            "id": r[0],
            "menu_id": r[1],
            "menu_name": r[2],
            "prediction_date": str(r[3]),
            "predicted_qty": int(r[4]),
            "confidence": float(r[5]) if r[5] else 0.0,
            "model_version": r[6],
            "created_at": str(r[7]),
        }
        for r in rows
    ]
