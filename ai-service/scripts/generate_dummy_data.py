"""
더미 판매 데이터 생성 스크립트.

사용법 (ai-service 폴더에서):
  python -m scripts.generate_dummy_data              # DB의 모든 매장/메뉴에 60일치 생성
  python -m scripts.generate_dummy_data --days 90    # 90일치 생성
  python -m scripts.generate_dummy_data --store 1    # 특정 매장만
  python -m scripts.generate_dummy_data --dry-run    # DB에 저장하지 않고 미리보기만
"""

import argparse
import random
import sys
from datetime import date, timedelta

sys.stdout.reconfigure(encoding="utf-8")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from config import settings

# 요일별 판매 배율 (0=월 ~ 6=일)
DOW_MULTIPLIER = [0.8, 0.85, 0.9, 1.0, 1.2, 1.4, 1.3]

BASE_QTY = (10, 30)


def generate_sales_for_menu(
    store_id: int,
    menu_id: int,
    days: int,
    end_date: date,
) -> list[dict]:
    base = random.randint(*BASE_QTY)
    rows = []

    for i in range(days, 0, -1):
        target = end_date - timedelta(days=i)
        dow = target.weekday()
        qty = max(0, round(base * DOW_MULTIPLIER[dow] * random.uniform(0.9, 1.1)))
        rows.append({
            "store_id": store_id,
            "menu_id": menu_id,
            "sales_date": target,
            "quantity": qty,
        })

    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=60, help="생성할 과거 일수 (기본 60)")
    parser.add_argument("--store", type=int, default=None, help="특정 store_id만 처리")
    parser.add_argument("--dry-run", action="store_true", help="DB에 저장하지 않고 출력만")
    args = parser.parse_args()

    connect_args = {"ssl": {"ssl_ca": None}} if settings.DB_SSL else {}
    engine = create_engine(settings.DB_URL, connect_args=connect_args)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 대상 매장 조회
        if args.store:
            stores = db.execute(
                text("SELECT store_id, store_name FROM STORE WHERE store_id = :sid AND is_active = 1"),
                {"sid": args.store},
            ).fetchall()
        else:
            stores = db.execute(
                text("SELECT store_id, store_name FROM STORE WHERE is_active = 1")
            ).fetchall()

        if not stores:
            print("활성화된 매장이 없습니다.")
            return

        end_date = date.today() - timedelta(days=1)  # 어제까지
        total_inserted = 0

        for store_id, store_name in stores:
            menus = db.execute(
                text(
                    "SELECT menu_id, menu_name, category FROM MENU "
                    "WHERE store_id = :sid AND is_active = 1"
                ),
                {"sid": store_id},
            ).fetchall()

            if not menus:
                print(f"  [{store_name}] 활성 메뉴 없음, 건너뜀")
                continue

            print(f"\n[{store_name}] (store_id={store_id}) - 메뉴 {len(menus)}개, {args.days}일치 생성")

            for menu_id, menu_name, _ in menus:
                # 이미 데이터가 있는 날짜 조회 (중복 방지)
                existing = db.execute(
                    text(
                        "SELECT sales_date FROM SALES_DATA "
                        "WHERE store_id = :sid AND menu_id = :mid AND is_deleted = 0"
                    ),
                    {"sid": store_id, "mid": menu_id},
                ).fetchall()
                existing_dates = {r[0] for r in existing}

                rows = generate_sales_for_menu(store_id, menu_id, args.days, end_date)
                rows = [r for r in rows if r["sales_date"] not in existing_dates]

                if not rows:
                    print(f"  {menu_name}: 이미 데이터 있음, 건너뜀")
                    continue

                print(f"  {menu_name}: {len(rows)}일치 삽입 예정")

                if not args.dry_run:
                    for r in rows:
                        db.execute(
                            text(
                                "INSERT INTO SALES_DATA "
                                "(store_id, menu_id, sales_date, quantity, is_deleted) "
                                "VALUES (:sid, :mid, :date, :qty, 0)"
                            ),
                            {
                                "sid": r["store_id"],
                                "mid": r["menu_id"],
                                "date": r["sales_date"],
                                "qty": r["quantity"],
                            },
                        )
                    total_inserted += len(rows)

        if args.dry_run:
            print("\n[dry-run] DB에 저장하지 않았습니다.")
        else:
            db.commit()
            print(f"\n완료: 총 {total_inserted}개 행 삽입")

    except Exception as e:
        db.rollback()
        print(f"오류 발생: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
