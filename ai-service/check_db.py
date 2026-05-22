"""DB 현황 확인 스크립트"""
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, text
from config import settings

engine = create_engine(settings.DB_URL, connect_args={"ssl": {"ca": None}} if settings.DB_SSL else {})

with engine.connect() as conn:
    # jihwan 유저 확인
    rows = conn.execute(text("SELECT user_id, email, user_name, role, store_id FROM USER WHERE email LIKE '%jihwan%'")).fetchall()
    print("=== JIHWAN 유저 ===")
    for r in rows:
        print(dict(r._mapping))

    if not rows:
        print("유저 없음")
        sys.exit(1)

    user_ids = [r.user_id for r in rows]

    # 매장 확인
    rows2 = conn.execute(text(f"SELECT * FROM STORE WHERE hq_user_id IN ({','.join(map(str, user_ids))}) OR store_id IN (SELECT store_id FROM USER WHERE user_id IN ({','.join(map(str, user_ids))}))")).fetchall()
    print("\n=== 매장 ===")
    store_ids = []
    for r in rows2:
        print(dict(r._mapping))
        store_ids.append(r.store_id)

    if not store_ids:
        print("매장 없음")
        sys.exit(1)

    # 메뉴 확인
    rows3 = conn.execute(text(f"SELECT menu_id, store_id, menu_name, category, price, is_active FROM MENU WHERE store_id IN ({','.join(map(str, store_ids))})")).fetchall()
    print("\n=== 메뉴 ===")
    for r in rows3:
        print(dict(r._mapping))

    # 판매데이터 요약
    for sid in store_ids:
        rows4 = conn.execute(text(f"""
            SELECT menu_id, COUNT(*) as cnt, MIN(sales_date) as min_date, MAX(sales_date) as max_date
            FROM SALES_DATA WHERE store_id={sid} AND is_deleted=0
            GROUP BY menu_id
        """)).fetchall()
        print(f"\n=== SALES_DATA (store_id={sid}) ===")
        for r in rows4:
            print(dict(r._mapping))

    # ORDER_REQUEST 확인
    rows5 = conn.execute(text(f"SELECT status, COUNT(*) as cnt FROM ORDER_REQUEST WHERE store_id IN ({','.join(map(str, store_ids))}) GROUP BY status")).fetchall()
    print("\n=== ORDER_REQUEST 현황 ===")
    for r in rows5:
        print(dict(r._mapping))

    # INGREDIENT 확인
    rows6 = conn.execute(text("SELECT ingredient_id, ingredient_name, unit FROM INGREDIENT LIMIT 20")).fetchall()
    print("\n=== INGREDIENT (샘플) ===")
    for r in rows6:
        print(dict(r._mapping))
