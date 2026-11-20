"""seed_60005.py 가 넣은 더미 데이터를 지우고 바꾼 값을 되돌린다.

    ai-service/venv/Scripts/python.exe dummy-seed/cleanup_60005.py           # 미리보기
    ai-service/venv/Scripts/python.exe dummy-seed/cleanup_60005.py --apply

평가 중 에이전트가 만든 제안·실행 기록·알림, 평가용으로 넣은 심사 발주(eval 단계)는
--with-agent-output 을 주면 함께 지운다 (manifest 의 seededAt 이후 60005 것만).
"""
from __future__ import annotations

import argparse

from common import MANIFEST, STORE, TRUTH, connect, load

ID_COL = {"sales_data": "sales_id", "inventory_lot": "lot_id", "inventory_txn": "txn_id",
          "waste_record": "waste_id", "order_request": "order_id"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--with-agent-output", action="store_true")
    a = ap.parse_args()
    m = load(MANIFEST)
    conn = connect()
    c = conn.cursor()

    tables: dict[str, set[int]] = {}
    for key, ids in m["inserted"].items():
        tables.setdefault(key.lower(), set()).update(ids)
    for t, ids in tables.items():
        print(f"{t}: {len(ids)}행 삭제")
    print(f"매장 지역 → {m['before']['store']['region']}, 식자재 {len(m['before']['ingredients'])}개·재고 {len(m['before']['inventory'])}행·"
          f"발주 상태 {len(m['before']['orders'])}건 복원")
    if a.with_agent_output:
        for t in ("AGENT_PROPOSAL", "AGENT_RUN", "notification"):
            c.execute(f"SELECT COUNT(*) n FROM {t} WHERE store_id=%s AND created_at >= %s"
                      if t != "AGENT_RUN" else f"SELECT COUNT(*) n FROM {t} WHERE store_id=%s AND started_at >= %s",
                      (STORE, m["seededAt"]))
            print(f"{t}: 시드 이후 {c.fetchone()['n']}행 삭제")
    if not a.apply:
        print("미리보기입니다. --apply 로 실행하세요.")
        return

    for t in ("inventory_txn", "inventory_lot", "waste_record", "order_request", "sales_data"):
        ids = sorted(tables.get(t, ()))
        for i in range(0, len(ids), 1000):
            chunk = ids[i:i + 1000]
            c.execute(f"DELETE FROM {t} WHERE store_id=%s AND {ID_COL[t]} IN ({','.join(map(str, chunk))})", (STORE,))
        conn.commit()
    c.execute("UPDATE STORE SET region=%s WHERE store_id=%s", (m["before"]["store"]["region"], STORE))
    for r in m["before"]["ingredients"]:
        c.execute("UPDATE ingredient SET category=%s, shelf_life_days=%s, lead_time_days=%s WHERE ingredient_id=%s",
                  (r["category"], r["shelf_life_days"], r["lead_time_days"], r["ingredient_id"]))
    for r in m["before"]["inventory"]:
        c.execute("UPDATE inventory SET current_qty=%s, min_threshold=%s, expiry_date=%s, updated_at=%s WHERE inventory_id=%s",
                  (r["current_qty"], r["min_threshold"], r["expiry_date"], r["updated_at"], r["inventory_id"]))
    for r in m["before"]["orders"]:
        c.execute("UPDATE order_request SET status=%s WHERE order_id=%s", (r["status"], r["order_id"]))
    if a.with_agent_output:
        c.execute("DELETE FROM AGENT_PROPOSAL WHERE store_id=%s AND created_at >= %s", (STORE, m["seededAt"]))
        c.execute("DELETE FROM AGENT_RUN WHERE store_id=%s AND started_at >= %s", (STORE, m["seededAt"]))
        c.execute("DELETE FROM notification WHERE store_id=%s AND created_at >= %s", (STORE, m["seededAt"]))
    conn.commit()
    MANIFEST.rename(MANIFEST.with_suffix(".cleaned.json"))
    if TRUTH.exists():
        TRUTH.rename(TRUTH.with_suffix(".cleaned.json"))
    print("되돌렸습니다.")


if __name__ == "__main__":
    main()
