import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from config import settings

engine = create_engine(settings.DB_URL, connect_args={"ssl": {"ca": None}} if settings.DB_SSL else {})
STORE_ID = 60004
MENUS = [(60001, "bulgogi"), (180001, "chicken"), (180002, "bibimbap")]

with engine.connect() as conn:
    print("=== SALES_DATA ===")
    for mid, name in MENUS:
        r = conn.execute(text(
            f"SELECT COUNT(*) as cnt, MIN(sales_date) as mn, MAX(sales_date) as mx "
            f"FROM SALES_DATA WHERE store_id={STORE_ID} AND menu_id={mid} AND is_deleted=0"
        )).fetchone()
        rf = "RF-OK(>=30)" if r.cnt >= 30 else f"INSUFFICIENT({r.cnt})"
        print(f"  menu {mid} ({name}): {r.cnt} rows [{r.mn}~{r.mx}] -> {rf}")

    print()
    print("=== ORDER_REQUEST ===")
    rows = conn.execute(text(
        f"SELECT status, COUNT(*) as cnt FROM ORDER_REQUEST WHERE store_id={STORE_ID} GROUP BY status"
    )).fetchall()
    for r in rows:
        print(f"  {r.status}: {r.cnt}")

    print()
    print("=== DELIVERY TOKENS (APPROVED, test with GET /api/delivery/<token>) ===")
    rows2 = conn.execute(text(
        f"SELECT order_id, ordered_qty, delivery_token FROM ORDER_REQUEST "
        f"WHERE store_id={STORE_ID} AND status='APPROVED'"
    )).fetchall()
    for r in rows2:
        print(f"  order_id={r.order_id}  qty={r.ordered_qty}  token={r.delivery_token}")
