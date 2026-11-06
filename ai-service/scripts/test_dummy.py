"""
FoodGuard AI 모델 더미 데이터 테스트 스크립트.

1. DB에 테스트용 STORE / MENU / SALES_DATA 삽입
2. /api/train  으로 모델 학습
3. /api/predict 으로 예측 실행
4. 결과 출력

실행 방법:
    venv\Scripts\activate
    python -m scripts.test_dummy    (ai-service 폴더에서)
"""

import random
import sys
from datetime import date, timedelta

import requests
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import os

# ── 설정 ────────────────────────────────────────────────────────────────────
load_dotenv()

DB_URL = os.getenv("DB_URL")
AI_BASE = f"http://localhost:{os.getenv('AI_SERVICE_PORT', 8000)}"

STORE_NAME   = "테스트매장_AI_DUMMY"
MENU_ITEMS   = [
    ("김치찌개", "한식", 8000),
    ("된장찌개", "한식", 7000),
    ("비빔밥",   "한식", 9000),
]
DAYS_OF_DATA = 35   # 30+ 이상이어야 RandomForest 풀 모델 사용


# ── DB 헬퍼 ─────────────────────────────────────────────────────────────────
def get_engine():
    ssl_args = {"ssl": {"ca": None}} if os.getenv("DB_SSL") == "true" else {}
    return create_engine(DB_URL, connect_args=ssl_args if ssl_args else {})


def setup_test_data(conn) -> tuple[int, list[int]]:
    """테스트 STORE / MENU 생성(이미 있으면 재사용), SALES_DATA 삽입."""

    # ── STORE ────────────────────────────────────────────────────────────────
    row = conn.execute(
        text("SELECT store_id FROM STORE WHERE store_name = :name"),
        {"name": STORE_NAME},
    ).fetchone()

    if row:
        store_id = row[0]
        print(f"[STORE] 기존 테스트 매장 재사용  store_id={store_id}")
    else:
        conn.execute(
            text(
                "INSERT INTO STORE (store_name, address, phone, region, is_active, opened_at) "
                "VALUES (:name, '서울시 테스트구', '02-0000-0000', '서울', 1, CURDATE())"
            ),
            {"name": STORE_NAME},
        )
        conn.commit()
        store_id = conn.execute(
            text("SELECT store_id FROM STORE WHERE store_name = :name"),
            {"name": STORE_NAME},
        ).fetchone()[0]
        print(f"[STORE] 테스트 매장 생성  store_id={store_id}")

    # ── MENU ─────────────────────────────────────────────────────────────────
    menu_ids = []
    for menu_name, category, price in MENU_ITEMS:
        row = conn.execute(
            text(
                "SELECT menu_id FROM MENU "
                "WHERE store_id = :sid AND menu_name = :mname"
            ),
            {"sid": store_id, "mname": menu_name},
        ).fetchone()

        if row:
            menu_ids.append(row[0])
            print(f"[MENU]  기존 메뉴 재사용  menu_id={row[0]}  {menu_name}")
        else:
            conn.execute(
                text(
                    "INSERT INTO MENU (store_id, menu_name, category, price, is_active) "
                    "VALUES (:sid, :mname, :cat, :price, 1)"
                ),
                {"sid": store_id, "mname": menu_name, "cat": category, "price": price},
            )
            conn.commit()
            mid = conn.execute(
                text(
                    "SELECT menu_id FROM MENU "
                    "WHERE store_id = :sid AND menu_name = :mname"
                ),
                {"sid": store_id, "mname": menu_name},
            ).fetchone()[0]
            menu_ids.append(mid)
            print(f"[MENU]  메뉴 생성  menu_id={mid}  {menu_name}")

    # ── SALES_DATA ────────────────────────────────────────────────────────────
    today = date.today()
    inserted_total = 0

    for menu_id in menu_ids:
        # 기존 더미 데이터 삭제 후 재삽입
        conn.execute(
            text(
                "DELETE FROM SALES_DATA "
                "WHERE store_id = :sid AND menu_id = :mid"
            ),
            {"sid": store_id, "mid": menu_id},
        )
        conn.commit()

        for i in range(DAYS_OF_DATA, 0, -1):
            sale_date = today - timedelta(days=i)
            # 요일별로 자연스러운 판매량 시뮬레이션
            dow = sale_date.weekday()
            base = 30 if dow in (4, 5, 6) else 20   # 주말 더 많이
            qty = max(1, base + random.randint(-8, 12))

            conn.execute(
                text(
                    "INSERT INTO SALES_DATA (store_id, menu_id, sales_date, quantity, is_deleted) "
                    "VALUES (:sid, :mid, :sdate, :qty, 0)"
                ),
                {"sid": store_id, "mid": menu_id, "sdate": sale_date, "qty": qty},
            )
            inserted_total += 1

        conn.commit()

    print(f"[DATA]  SALES_DATA {inserted_total}건 삽입 완료 ({DAYS_OF_DATA}일 × {len(menu_ids)}메뉴)")
    return store_id, menu_ids


# ── AI API 호출 ──────────────────────────────────────────────────────────────
def check_server():
    try:
        r = requests.get(f"{AI_BASE}/health", timeout=3)
        r.raise_for_status()
        print(f"[서버]  AI 서버 정상  {AI_BASE}")
    except Exception:
        print(f"\n[오류] AI 서버에 연결할 수 없습니다 ({AI_BASE})")
        print("       먼저 start.bat 또는 'python main.py' 로 AI 서버를 실행하세요.\n")
        sys.exit(1)


def train(store_id: int) -> dict:
    print(f"\n[학습]  POST /api/train/store/{store_id} ...")
    r = requests.post(f"{AI_BASE}/api/train/store/{store_id}", timeout=60)
    r.raise_for_status()
    return r.json()


def predict(store_id: int) -> dict:
    print(f"[예측]  POST /api/predict/store/{store_id} ...")
    r = requests.post(f"{AI_BASE}/api/predict/store/{store_id}", timeout=60)
    r.raise_for_status()
    return r.json()


def get_results(store_id: int) -> dict:
    print(f"[조회]  GET  /api/predict/store/{store_id} ...")
    r = requests.get(f"{AI_BASE}/api/predict/store/{store_id}", timeout=10)
    r.raise_for_status()
    return r.json()


# ── 결과 출력 ────────────────────────────────────────────────────────────────
def print_results(train_res: dict, pred_res: dict, result_res: dict):
    print("\n" + "=" * 60)
    print("  학습 결과")
    print("=" * 60)
    scores = train_res.get("scores", {})
    for menu_id, score in scores.items():
        print(f"  menu_id={menu_id}  모델 정확도(R²): {score}%")

    print("\n" + "=" * 60)
    print("  예측 결과 (향후 7일)")
    print("=" * 60)
    for menu in result_res.get("menus", []):
        print(f"\n  [{menu['menu_name']}]")
        print(f"  {'날짜':<12} {'예측 판매량':>10} {'신뢰도':>10}")
        print(f"  {'-'*36}")
        for p in menu.get("predictions", []):
            print(
                f"  {p['prediction_date']:<12} "
                f"{p['predicted_qty']:>8}개   "
                f"{p['confidence']:>6.1f}%"
            )
    print()


# ── main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    check_server()

    engine = get_engine()
    with engine.connect() as conn:
        store_id, menu_ids = setup_test_data(conn)

    train_res  = train(store_id)
    pred_res   = predict(store_id)
    result_res = get_results(store_id)

    print_results(train_res, pred_res, result_res)

    print(f"테스트 완료!  store_id={store_id}")
    print(f"프론트엔드에서 매장 ID {store_id} 로 예측 대시보드를 확인하세요.")
