"""
더미 데이터 삽입 스크립트
- store_id=60004 (jihwan@gmail.com)
- SALES_DATA: 2026-05-21까지 채우기 (menu_id=60001,180001,180002)
- ORDER_REQUEST: REQUESTED/APPROVED(배달토큰)/DONE 상태 더미
"""
import sys
import random
import uuid
from datetime import date, timedelta, datetime

sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from config import settings

random.seed(42)
engine = create_engine(settings.DB_URL, connect_args={"ssl": {"ca": None}} if settings.DB_SSL else {})

STORE_ID = 60004
MENUS = [
    {"menu_id": 60001,  "name": "불고기덮밥",     "base_qty": 45, "std": 10},
    {"menu_id": 180001, "name": "치킨까스",        "base_qty": 30, "std": 8},
    {"menu_id": 180002, "name": "스페이스비빔밥",  "base_qty": 25, "std": 7},
]
TARGET_END = date(2026, 5, 21)


def sales_qty(menu_id, d):
    """요일/계절 반영 현실적 판매량 생성"""
    m = next(m for m in MENUS if m["menu_id"] == menu_id)
    base = m["base_qty"]
    # 금/토 피크 (+20%), 일/월 저조 (-15%)
    dow = d.weekday()
    if dow in (4, 5):
        base = int(base * 1.2)
    elif dow in (6, 0):
        base = int(base * 0.85)
    qty = int(random.gauss(base, m["std"]))
    return max(5, qty)


with engine.connect() as conn:
    # ── 1. 기존 판매 날짜 조회 ───────────────────────────────────────────────
    existing = {}
    for m in MENUS:
        rows = conn.execute(text(
            f"SELECT sales_date FROM SALES_DATA "
            f"WHERE store_id={STORE_ID} AND menu_id={m['menu_id']} AND is_deleted=0"
        )).fetchall()
        existing[m["menu_id"]] = {r.sales_date for r in rows}

    # ── 2. 삽입할 날짜 범위 결정 ─────────────────────────────────────────────
    # menu_id=60001: 최신 2026-05-13 → 5/14~5/21
    # menu_id=180001,180002: 23개(2026-04-21~2026-05-13) → 3/15부터 역사+5/14~5/21
    date_ranges = {
        60001:  (date(2026, 5, 14), TARGET_END),
        180001: (date(2026, 3, 15), TARGET_END),
        180002: (date(2026, 3, 15), TARGET_END),
    }

    insert_count = 0
    for m in MENUS:
        mid = m["menu_id"]
        start, end = date_ranges[mid]
        d = start
        rows_to_insert = []
        while d <= end:
            if d not in existing[mid]:
                qty = sales_qty(mid, d)
                rows_to_insert.append({
                    "store_id": STORE_ID,
                    "menu_id": mid,
                    "sales_date": d.isoformat(),
                    "quantity": qty,
                })
            d += timedelta(days=1)

        if rows_to_insert:
            conn.execute(text(
                "INSERT INTO SALES_DATA (store_id, menu_id, sales_date, quantity, is_deleted) "
                "VALUES (:store_id, :menu_id, :sales_date, :quantity, 0)"
            ), rows_to_insert)
            insert_count += len(rows_to_insert)
            print(f"  [SALES] menu_id={mid} ({m['name']}): {len(rows_to_insert)}건 삽입")
        else:
            print(f"  [SALES] menu_id={mid} ({m['name']}): 이미 완료")

    # ── 3. INGREDIENT 조회 (store 메뉴 연결된 식자재) ─────────────────────────
    ing_rows = conn.execute(text("""
        SELECT DISTINCT i.ingredient_id, i.ingredient_name, i.unit
        FROM INGREDIENT i
        JOIN MENU_INGREDIENT mi ON i.ingredient_id = mi.ingredient_id
        JOIN MENU m ON mi.menu_id = m.menu_id
        WHERE m.store_id = :sid AND m.is_active = 1
        LIMIT 10
    """), {"sid": STORE_ID}).fetchall()

    if not ing_rows:
        # INGREDIENT 직접 조회 (메뉴-식자재 연결 없는 경우)
        ing_rows = conn.execute(text(
            "SELECT ingredient_id, ingredient_name, unit FROM INGREDIENT LIMIT 6"
        )).fetchall()

    ingredients = [{"id": r.ingredient_id, "name": r.ingredient_name, "unit": r.unit}
                   for r in ing_rows]
    print(f"\n  [INFO] 사용할 식자재 {len(ingredients)}개: {[i['name'] for i in ingredients]}")

    # ── 4. ORDER_REQUEST 더미 삽입 ───────────────────────────────────────────
    now = datetime.now()
    orders = []

    # REQUESTED: 3건 (오늘 발주 요청, 아직 처리 전)
    for i, ing in enumerate(ingredients[:3]):
        qty = round(random.uniform(5.0, 20.0), 1)
        orders.append({
            "store_id": STORE_ID,
            "ingredient_id": ing["id"],
            "status": "REQUESTED",
            "ordered_qty": qty,
            "ordered_at": (now - timedelta(hours=random.randint(1, 6))).strftime("%Y-%m-%d %H:%M:%S"),
            "approved_at": None,
            "delivery_token": None,
        })

    # APPROVED: 2건 (승인 완료, 배달 중 → delivery_token 있음)
    for i, ing in enumerate(ingredients[3:5] if len(ingredients) >= 5 else ingredients[:2]):
        qty = round(random.uniform(10.0, 30.0), 1)
        token = uuid.uuid4().hex  # 32자 hex
        orders.append({
            "store_id": STORE_ID,
            "ingredient_id": ing["id"],
            "status": "APPROVED",
            "ordered_qty": qty,
            "ordered_at": (now - timedelta(days=1, hours=random.randint(1, 4))).strftime("%Y-%m-%d %H:%M:%S"),
            "approved_at": (now - timedelta(hours=random.randint(2, 8))).strftime("%Y-%m-%d %H:%M:%S"),
            "delivery_token": token,
        })
        print(f"  [DELIVERY] APPROVED 주문 → 배달 토큰: {token}")

    # DONE: 3건 (과거 완료된 발주)
    for i, ing in enumerate(ingredients[:3]):
        qty = round(random.uniform(8.0, 25.0), 1)
        orders.append({
            "store_id": STORE_ID,
            "ingredient_id": ing["id"],
            "status": "DONE",
            "ordered_qty": qty,
            "ordered_at": (now - timedelta(days=random.randint(3, 10))).strftime("%Y-%m-%d %H:%M:%S"),
            "approved_at": (now - timedelta(days=random.randint(2, 8))).strftime("%Y-%m-%d %H:%M:%S"),
            "delivery_token": uuid.uuid4().hex,
        })

    conn.execute(text("""
        INSERT INTO ORDER_REQUEST
            (store_id, ingredient_id, status, ordered_qty, ordered_at, approved_at, delivery_token)
        VALUES
            (:store_id, :ingredient_id, :status, :ordered_qty, :ordered_at, :approved_at, :delivery_token)
    """), orders)
    print(f"\n  [ORDER] ORDER_REQUEST {len(orders)}건 삽입 (REQUESTED 3 / APPROVED 2 / DONE 3)")

    conn.commit()

# ── 5. 결과 검증 ─────────────────────────────────────────────────────────────
print("\n=== 삽입 결과 검증 ===")
with engine.connect() as conn:
    for m in MENUS:
        row = conn.execute(text(
            f"SELECT COUNT(*) as cnt, MIN(sales_date) as min_d, MAX(sales_date) as max_d "
            f"FROM SALES_DATA WHERE store_id={STORE_ID} AND menu_id={m['menu_id']} AND is_deleted=0"
        )).fetchone()
        rf_ok = "✓ RF가능" if row.cnt >= 30 else f"✗ 부족({row.cnt}개)"
        print(f"  menu_id={m['menu_id']} ({m['name']}): {row.cnt}건 [{row.min_d}~{row.max_d}] {rf_ok}")

    rows = conn.execute(text(
        f"SELECT status, COUNT(*) as cnt FROM ORDER_REQUEST "
        f"WHERE store_id={STORE_ID} GROUP BY status"
    )).fetchall()
    print("\n  ORDER_REQUEST 상태별 현황:")
    for r in rows:
        print(f"    {r.status}: {r.cnt}건")

    # 배달 토큰 출력 (테스트용)
    rows2 = conn.execute(text(
        f"SELECT order_id, ingredient_id, ordered_qty, delivery_token "
        f"FROM ORDER_REQUEST WHERE store_id={STORE_ID} AND status='APPROVED'"
    )).fetchall()
    print("\n  [배달 테스트용 토큰]")
    for r in rows2:
        print(f"    order_id={r.order_id}, ingredient_id={r.ingredient_id}, "
              f"qty={r.ordered_qty} → 토큰: {r.delivery_token}")
        print(f"    GET /api/delivery/{r.delivery_token}")

print("\n완료!")
