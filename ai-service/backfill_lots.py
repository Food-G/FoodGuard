"""기존 재고 → 입고 로트 1개씩 일회성 이관 (DEV_ROADMAP D-3).

    python backfill_lots.py           # 미리보기만 (DB 를 바꾸지 않음)
    python backfill_lots.py --apply   # 로트가 하나도 없는 (매장, 식자재) 재고만 이관

순서: 004_inventory_lot.sql 적용 → seed_shelf_life.py --apply → 이 스크립트 → 백엔드 재시작.

재고가 0 보다 큰 행마다 로트 1개 (received_qty = remaining_qty = current_qty):
  received_at = INVENTORY.updated_at → registered_at → 지금
  expiry_date = INVENTORY.expiry_date (이미 값이 있는 행) → received_at 날짜 + 보관일수 → NULL
이미 로트가 있는 (매장, 식자재)는 건너뛰므로 다시 실행해도 중복되지 않는다.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta

from sqlalchemy import text

from database import SessionLocal


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="DB 에 반영 (없으면 미리보기)")
    a = ap.parse_args()

    db = SessionLocal()
    try:
        try:
            db.execute(text("SELECT 1 FROM INVENTORY_LOT WHERE 1 = 0"))
        except Exception:
            sys.exit("INVENTORY_LOT 테이블이 없습니다. migrations/004_inventory_lot.sql 을 먼저 적용하세요.")
        rows = db.execute(text("""
            SELECT i.store_id, i.ingredient_id, g.ingredient_name, i.current_qty, i.unit,
                   COALESCE(i.updated_at, i.registered_at) AS received_at, i.expiry_date, g.shelf_life_days
            FROM INVENTORY i JOIN INGREDIENT g ON g.ingredient_id = i.ingredient_id
            WHERE i.current_qty > 0
              AND NOT EXISTS (SELECT 1 FROM INVENTORY_LOT l
                              WHERE l.store_id = i.store_id AND l.ingredient_id = i.ingredient_id)
            ORDER BY i.store_id, g.ingredient_name
        """)).fetchall()
        now = datetime.now()
        plan = []
        for sid, iid, name, qty, unit, received, inv_expiry, shelf in rows:
            received = received or now
            if inv_expiry is not None:
                expiry, basis = inv_expiry, "기존 expiry_date"
            elif shelf is not None:
                expiry, basis = received.date() + timedelta(days=shelf), f"입고일+{shelf}일"
            else:
                expiry, basis = None, "보관일수 없음"
            plan.append((sid, iid, qty, received, expiry))
            past = "  ⚠ 이미 지남" if expiry is not None and expiry < now.date() else ""
            print(f"매장 {sid}  {name:<8} {qty}{unit:<3}  입고 {received:%Y-%m-%d}  유통기한 {expiry} ({basis}){past}")
        print(f"\n이관할 로트: {len(plan)}개")
        if not a.apply:
            print("미리보기입니다. 확인 후 --apply 로 실행하세요.")
            return
        for sid, iid, qty, received, expiry in plan:
            db.execute(text(
                "INSERT INTO INVENTORY_LOT (store_id, ingredient_id, order_id, received_qty, remaining_qty, "
                "received_at, expiry_date) VALUES (:s, :i, NULL, :q, :q, :r, :e)"),
                {"s": sid, "i": iid, "q": qty, "r": received, "e": expiry})
        db.commit()
        print("반영했습니다. 백엔드를 재시작하면 로트 관리가 시작됩니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
