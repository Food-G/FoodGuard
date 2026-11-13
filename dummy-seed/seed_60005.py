"""FoodGuard 본점(60005) 에이전트 평가용 더미 데이터 시드.

    ai-service/venv/Scripts/python.exe dummy-seed/seed_60005.py           # 미리보기 (DB 안 바꿈)
    ai-service/venv/Scripts/python.exe dummy-seed/seed_60005.py --apply   # 반영

넣는 것
  - 판매 2년치 (2024-11-13 ~ 어제, 기존 판매가 있는 날은 건너뜀): 요일·월·공휴일·실제 서울 날씨·추세·노이즈
  - 현재 재고·로트·재고 원장 30일·발주 이력 120일·폐기 기록 60일
  - 정답을 아는 시나리오 (ground_truth.json): 품절/임계치 미만/입고 대기/폐기 위험/만료/음수 재고/
    원장 불일치/정체 발주/입고 지연
바꾸는 것 (manifest.json 에 이전 값 저장, cleanup_60005.py 로 복원)
  - 매장 지역 '미지정' → '서울' (주소가 서울 마포구)
  - 식자재 60001~60020 의 비어 있는 카테고리·보관일수·리드타임
  - 60005 의 재고 수량·최소 재고
  - 6월에 멈춰 있던 진행 중 발주 → CANCELLED (현재 시나리오를 깨끗하게)
"""
from __future__ import annotations

import argparse
import math
import random
from datetime import date, datetime, time, timedelta

import holidays
import requests

from common import MANIFEST, STORE, TRUTH, connect, dump, ingredient_need, recipes

TODAY = date.today()
NOW = datetime.now().replace(microsecond=0)
START = date(2024, 11, 13)
END = TODAY - timedelta(days=1)
SEOUL = (37.5665, 126.9780)
rng = random.Random(20261113)

# 요일(월~일), 월 배율
DOW = [0.88, 0.92, 0.95, 1.00, 1.18, 1.32, 1.12]
MONTH = {1: 0.97, 2: 0.93, 3: 0.98, 4: 1.0, 5: 1.03, 6: 1.0, 7: 0.98, 8: 0.95, 9: 1.0, 10: 1.02, 11: 1.0, 12: 1.06}
STEW = {150002, 150005, 150009, 120001}   # 추울수록 잘 팔림
COLD_NOODLE = {150007}                    # 더울수록 잘 팔림
BBQ = {150006}                            # 금·토 추가
NOISE_SIGMA = 0.11
TREND_PER_YEAR = 0.06

# 식자재 마스터 보강 (비어 있을 때만). 보관일수는 ai-service/seed_shelf_life.py 표를 따른다
MASTER = {
    60001: ("육류", 5, 2), 60002: ("육류", 5, 2), 60003: ("곡류", None, 3), 60004: ("반찬류", 30, 2),
    60005: ("장류", 180, 3), 60006: ("장류", 180, 3), 60007: ("두부류", 7, 1), 60008: ("면류", None, 3),
    60009: ("떡류", 7, 1), 60010: ("수산가공", 7, 2), 60011: ("면류", 30, 2), 60012: ("채소류", 14, 1),
    60013: ("채소류", 7, 1), 60014: ("채소류", 14, 1), 60015: ("난류", 21, 1), 60016: ("장류", 180, 3),
    60017: ("장류", 365, 3), 60018: ("채소류", 5, 1), 60019: ("채소류", 3, 1), 60020: ("채소류", 5, 1),
}

# 시나리오 (재고 = 하루 소요량 × days). 나머지 식자재는 4.5일분
STOCK_DAYS = {
    60001: 0.8,   # 소고기: 품절 위험
    60003: 1.2,   # 쌀: 품절 위험
    60015: 1.5,   # 계란: 품절 위험
    60007: 1.5,   # 두부: 임계치 미만 (최소 3일분)
    60014: 1.0,   # 마늘: 입고 대기 (5일분 승인 대기 발주)
    60020: 18.0,  # 시금치: 과잉 + 2일 뒤 만료 로트 → 폐기 HIGH, 기부 후보
    60019: 17.0,  # 콩나물: 과잉 + 1일 뒤 만료 로트 → 폐기 HIGH, 기부 후보
    60013: 10.0,  # 대파: 5일 뒤 만료 로트 과잉 → 폐기 MEDIUM, 기부 후보
    60008: 4.5,   # 당면: 최소 재고 0 (임계치 미설정)
}
NORMAL_DAYS = 4.5
NEGATIVE = {60010: -3.0}             # 어묵: 음수 재고
MIN_DAYS = {60007: 3.0, 60010: 2.0}  # 그 밖에는 0.5일분
THRESHOLD_UNSET = {60008}
LEDGER_BROKEN = {60016: 0.7}         # 참기름: 원장 마지막 잔량이 재고와 0.7L 어긋남


def fetch_weather() -> dict[date, tuple[float, float, float]]:
    """Open-Meteo 과거 관측 (ai-service 와 같은 소스). 없는 날은 1년 전 같은 날로 채운다."""
    r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=60, params={
        "latitude": SEOUL[0], "longitude": SEOUL[1], "start_date": str(START - timedelta(days=366)),
        "end_date": str(END), "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "Asia/Seoul"})
    r.raise_for_status()
    d = r.json()["daily"]
    out = {}
    for ds, tmax, tmin, pr in zip(d["time"], d["temperature_2m_max"], d["temperature_2m_min"], d["precipitation_sum"]):
        if tmax is not None:
            out[date.fromisoformat(ds)] = (tmax, tmin, pr or 0.0)
    filled = 0
    day = START
    while day <= END:
        if day not in out:
            out[day] = out.get(day - timedelta(days=364)) or out.get(day - timedelta(days=365)) or (15.0, 8.0, 0.0)
            filled += 1
        day += timedelta(days=1)
    print(f"날씨: {len(out)}일, 관측 없는 {filled}일은 1년 전 값으로 채움")
    return out


def demand(menu_id: int, base: float, day: date, wx, kr) -> int:
    tmax, _, pr = wx[day]
    f = base * DOW[day.weekday()] * MONTH[day.month]
    f *= 1 + TREND_PER_YEAR * ((day - START).days / 365)
    if menu_id in STEW:
        f *= math.exp(-0.018 * (tmax - 15))
    elif menu_id in COLD_NOODLE:
        f *= min(2.4, max(0.3, math.exp(0.05 * (tmax - 20))))
    if menu_id in BBQ and day.weekday() in (4, 5):
        f *= 1.12
    if pr >= 10:
        f *= 0.82
    elif pr >= 3:
        f *= 0.92
    name = kr.get(day)
    if name:
        f *= 0.45 if ("설날" in name or "추석" in name or "Lunar" in name or "Chuseok" in name) else 0.62
    f *= math.exp(rng.gauss(0, NOISE_SIGMA))
    return max(0, round(f))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    apply = ap.parse_args().apply
    if apply and MANIFEST.exists():
        raise SystemExit(f"이미 시드했습니다 ({MANIFEST}). 다시 하려면 cleanup_60005.py 를 먼저 실행하세요.")

    conn = connect()
    c = conn.cursor()
    q = lambda sql, *a: (c.execute(sql, a), c.fetchall())[1]
    manifest: dict = {"seededAt": NOW, "store": STORE, "before": {}, "inserted": {}}

    # ── 0. 이전 값 ─────────────────────────────────────────────────
    manifest["before"]["store"] = q("SELECT region FROM STORE WHERE store_id=%s", STORE)[0]
    manifest["before"]["ingredients"] = q(
        "SELECT ingredient_id, category, shelf_life_days, lead_time_days FROM ingredient WHERE ingredient_id BETWEEN 60001 AND 60020")
    manifest["before"]["inventory"] = q(
        "SELECT inventory_id, ingredient_id, current_qty, min_threshold, expiry_date, updated_at FROM inventory WHERE store_id=%s", STORE)
    stale_orders = q("SELECT order_id, status FROM order_request WHERE store_id=%s AND status IN "
                     "('REQUESTED','APPROVED','HQ_SENT','DRIVER_RECEIVED')", STORE)
    manifest["before"]["orders"] = stale_orders
    print(f"6월에 멈춘 진행 중 발주 {len(stale_orders)}건 → CANCELLED")

    menus = q("SELECT menu_id, menu_name, price FROM menu WHERE store_id=%s AND is_active=1", STORE)
    rec = recipes(c)
    avg = {r["menu_id"]: float(r["a"]) for r in q(
        "SELECT menu_id, AVG(quantity) a FROM sales_data WHERE store_id=%s AND is_deleted=0 GROUP BY menu_id", STORE)}
    base = {m["menu_id"]: (avg.get(m["menu_id"], 26.0)) / 1.04 for m in menus}
    existing = {(r["menu_id"], r["sales_date"]) for r in q(
        "SELECT DISTINCT menu_id, sales_date FROM sales_data WHERE store_id=%s AND is_deleted=0", STORE)}

    # ── 1. 판매 ────────────────────────────────────────────────────
    wx = fetch_weather()
    kr = holidays.country_holidays("KR", years=range(2024, 2028))
    price = {m["menu_id"]: m["price"] for m in menus}
    sales_rows, by_day = [], {}
    day = START
    while day <= END:
        for m in menus:
            mid = m["menu_id"]
            qty = demand(mid, base[mid], day, wx, kr)
            by_day.setdefault(day, {})[mid] = qty
            if (mid, day) not in existing:
                ts = datetime.combine(day, time(21, 30))
                sales_rows.append((qty, day, ts, mid, STORE, ts, price[mid]))
        day += timedelta(days=1)
    print(f"판매 행: {len(sales_rows)}건 ({START} ~ {END}, 메뉴 {len(menus)}개)")

    # 최근 14일 실제 판매(기존 + 생성)로 하루 소요량
    recent = {}
    for d in (END - timedelta(days=i) for i in range(14)):
        for mid, qty in by_day[d].items():
            recent[mid] = recent.get(mid, 0) + qty / 14
    daily = ingredient_need(recent, rec)

    inv = {r["ingredient_id"]: r for r in manifest["before"]["inventory"]}
    ing_rows = q("SELECT ingredient_id, ingredient_name, unit FROM ingredient")
    units = {r["ingredient_id"]: r["unit"] for r in ing_rows}
    names = {r["ingredient_id"]: r["ingredient_name"] for r in ing_rows}

    def amount(iid: int, days: float) -> float:
        v = daily.get(iid, 0) * days
        return float(round(v)) if units[iid] == "개" else round(v, 2)

    # ── 2. 재고 시나리오 ───────────────────────────────────────────
    stock, mins = {}, {}
    for iid in inv:
        stock[iid] = NEGATIVE.get(iid, amount(iid, STOCK_DAYS.get(iid, NORMAL_DAYS)))
        mins[iid] = 0.0 if iid in THRESHOLD_UNSET else max(amount(iid, MIN_DAYS.get(iid, 0.5)), 0.5)

    # ── 3. 로트 (유통기한 관리 식자재만, 합계 = 재고) ────────────────
    shelf = {iid: v[1] for iid, v in MASTER.items()}
    lots = []

    def lot(iid, qty, received_days_ago, expiry_in, received_qty=None):
        rcv = datetime.combine(TODAY - timedelta(days=received_days_ago), time(9, 0))
        lots.append((STORE, iid, None, round(received_qty or qty, 3), round(qty, 3), rcv, TODAY + timedelta(days=expiry_in)))

    for iid, cur in stock.items():
        s = shelf.get(iid)
        if not s or cur <= 0:
            continue
        d1 = daily.get(iid, 0)
        if iid == 60020:      # 시금치: 13일분이 2일 뒤 만료
            lot(iid, amount(iid, 13), 3, 2, amount(iid, 14)); lot(iid, cur - amount(iid, 13), 0, s)
        elif iid == 60019:    # 콩나물: 12일분이 1일 뒤 만료
            lot(iid, amount(iid, 12), 2, 1, amount(iid, 13)); lot(iid, cur - amount(iid, 12), 0, s)
        elif iid == 60013:    # 대파: 8일분이 5일 뒤 만료
            lot(iid, amount(iid, 8), 2, 5, amount(iid, 9)); lot(iid, cur - amount(iid, 8), 0, s)
        elif iid == 60002:    # 돼지고기: 재고의 40% 가 어제 만료
            expired = round(cur * 0.40, 2)
            lot(iid, expired, s + 1, -1); lot(iid, cur - expired, 1, s - 1)
        else:                 # 정상: 40% 는 2일 전 입고, 60% 는 오늘 입고
            older = round(cur * 0.4, 2) if units[iid] != "개" else float(round(cur * 0.4))
            if older > 0 and min(s, 30) - 2 > 0:
                lot(iid, older, 2, s - 2)
            lot(iid, cur - older if older > 0 else cur, 0, s)

    # ── 4. 재고 원장 30일 (마지막 잔량 = 재고, 참기름만 어긋나게) ───
    txns = []
    for iid, cur in stock.items():
        events = []  # (ts, delta, reason, ref_type)
        for i in range(30, 0, -1):
            d = TODAY - timedelta(days=i)
            used = ingredient_need(by_day.get(d, {}), rec).get(iid, 0)
            if used > 0:
                events.append((datetime.combine(d, time(22, 0)), -round(used, 3), "SALE", "SALES_DATA"))
            if i % 3 == 0:
                events.append((datetime.combine(d, time(8, 30)), round(daily.get(iid, 0) * 3.2, 3), "ORDER_DONE", "ORDER"))
        events.sort()
        final = cur + LEDGER_BROKEN.get(iid, 0.0)
        qty = final - sum(e[1] for e in events)
        for ts, delta, reason, ref in events:
            qty += delta
            txns.append((STORE, iid, delta, reason, ref, None, round(qty, 3), ts, None))

    # ── 5. 발주 이력 120일 + 폐기 기록 60일 ─────────────────────────
    orders, wastes = [], []
    for iid in inv:
        d1 = daily.get(iid, 0)
        if d1 <= 0:
            continue
        i = 120
        while i > 4:
            at = datetime.combine(TODAY - timedelta(days=i), time(10, rng.randint(0, 59)))
            qty = round(d1 * 3.5 * rng.uniform(0.8, 1.2), 2) if units[iid] != "개" else float(round(d1 * 3.5 * rng.uniform(0.8, 1.2)))
            roll = rng.random()
            status = "DONE" if roll < 0.92 else "REJECTED" if roll < 0.96 else "CANCELLED"
            appr = at + timedelta(hours=rng.uniform(1, 6)) if status == "DONE" else None
            orders.append(dict(store_id=STORE, ingredient_id=iid, status=status, ordered_qty=qty, ordered_at=at,
                               approved_at=appr, hq_sent_at=appr and appr + timedelta(hours=rng.uniform(2, 10)),
                               driver_received_at=appr and appr + timedelta(hours=rng.uniform(12, 24)),
                               owner_received_at=appr and appr + timedelta(hours=rng.uniform(26, 40)),
                               updated_at=(appr + timedelta(hours=40)) if appr else at + timedelta(hours=3)))
            i -= rng.choice((3, 3, 4, 4, 5))
    for i in range(60, 0, -1):
        if rng.random() < 0.35:
            iid = rng.choice([60013, 60019, 60020, 60012, 60007, 60009])
            wq = round(daily.get(iid, 1) * rng.uniform(0.2, 0.8), 2) if units[iid] != "개" else float(max(1, round(daily.get(iid, 1) * rng.uniform(0.2, 0.8))))
            wastes.append((datetime.combine(TODAY - timedelta(days=i), time(23, 0)), rng.choice(["EXPIRED", "EXPIRED", "DAMAGED", "OVERPREP"]),
                           TODAY - timedelta(days=i), wq, iid, STORE, names[iid], units[iid]))

    # ── 6. 정답을 아는 진행 중 발주 (입고 추적·감사·발주 참모) ─────
    def planted(iid, status, hours_ago, qty_days, approved_hours_ago=None, updated_hours_ago=None, label=None):
        at = NOW - timedelta(hours=hours_ago)
        appr = NOW - timedelta(hours=approved_hours_ago) if approved_hours_ago is not None else None
        upd = NOW - timedelta(hours=updated_hours_ago) if updated_hours_ago is not None else (appr or at)
        qty = amount(iid, qty_days)
        orders.append(dict(store_id=STORE, ingredient_id=iid, status=status, ordered_qty=qty, ordered_at=at, approved_at=appr,
                           hq_sent_at=appr if status in ("HQ_SENT", "DRIVER_RECEIVED") else None,
                           driver_received_at=upd if status == "DRIVER_RECEIVED" else None, owner_received_at=None,
                           updated_at=upd, _label=label))

    planted(60014, "REQUESTED", 3, 5.0, label="awaiting_delivery_source")             # 마늘: 입고 대기 근거
    planted(60017, "REQUESTED", 30, 3.0, label="delay_approval")                       # 간장: 승인 지연 30h
    planted(60017, "REQUESTED", 240, 3.0, label="delay_approval+stuck")                # 간장: 10일 정체 (감사)
    planted(60006, "APPROVED", 70, 3.0, approved_hours_ago=60, label="delay_shipping")  # 고추장: 출고 지연
    planted(60005, "HQ_SENT", 80, 3.0, approved_hours_ago=72, label="delay_shipping")   # 된장: 출고 지연
    planted(60004, "DRIVER_RECEIVED", 50, 3.0, approved_hours_ago=40, updated_hours_ago=20,
            label="delay_delivery_token_expiring")                                     # 배추김치: 배송 미완료, 링크 8h 남음
    planted(60009, "APPROVED", 12, 3.0, approved_hours_ago=10, label="ontime")          # 떡볶이떡: 정상
    planted(60011, "DRIVER_RECEIVED", 20, 3.0, approved_hours_ago=18, updated_hours_ago=3, label="ontime")  # 냉면사리: 정상
    planted(60012, "HQ_SENT", 24, 3.0, approved_hours_ago=20, label="ontime")           # 양파: 정상
    planted(60016, "REQUESTED", 2, 2.0, label="ontime")                                 # 참기름: 정상 (2h)

    print(f"재고 {len(stock)}종, 로트 {len(lots)}개, 원장 {len(txns)}행, 발주 {len(orders)}건, 폐기 기록 {len(wastes)}건")
    for iid in sorted(stock):
        print(f"  {iid}: 재고 {stock[iid]:>8} / 하루 {daily.get(iid, 0):6.2f} / 최소 {mins[iid]}")

    truth = {
        "asOf": TODAY, "dailyNeed": daily,
        "plannedStockDays": {**{str(k): v for k, v in STOCK_DAYS.items()}, "default": NORMAL_DAYS},
        "order_advisor": {"stockout": [60001, 60003, 60015], "below_threshold": [60007, 60010],
                          "awaiting_delivery": [60014], "waste": [60020, 60019], "mustNotOrder": [60020, 60019, 60013]},
        "waste": {"HIGH": [60020, 60019, 60002], "MEDIUM": [60013], "donation": [60020, 60019, 60013], "disposal": [60002]},
        "audit": {"expected": ["negative_stock", "threshold_unset", "menu_no_recipe", "order_stuck",
                               "ledger_mismatch", "duplicate_name"],
                  "notExpected": ["recipe_unit", "region_fallback", "sales_gap"],
                  "items": {"negative_stock": ["어묵"], "threshold_unset": ["당면"], "menu_no_recipe": ["김 밥"],
                            "ledger_mismatch": ["참기름"], "duplicate_name": ["양파"]}},
        "echo": {"lowStock": sorted(i for i in stock if mins[i] > 0 and stock[i] < mins[i])},
    }
    if not apply:
        print("\n미리보기입니다. --apply 로 반영하세요.")
        return

    # ── 반영 ──────────────────────────────────────────────────────
    ins = manifest["inserted"]
    c.execute("UPDATE STORE SET region='서울' WHERE store_id=%s", (STORE,))
    for iid, (cat, life, lead) in MASTER.items():
        c.execute("UPDATE ingredient SET category=IF(category IS NULL OR category='', %s, category), "
                  "shelf_life_days=IFNULL(shelf_life_days, %s), lead_time_days=IFNULL(lead_time_days, %s) "
                  "WHERE ingredient_id=%s", (cat, life, lead, iid))
    if stale_orders:
        c.execute(f"UPDATE order_request SET status='CANCELLED' WHERE order_id IN ({','.join(str(o['order_id']) for o in stale_orders)})")
    for iid in stock:
        c.execute("UPDATE inventory SET current_qty=%s, min_threshold=%s, updated_at=%s WHERE store_id=%s AND ingredient_id=%s",
                  (stock[iid], mins[iid], NOW, STORE, iid))
    conn.commit()
    dump(MANIFEST, manifest)  # 이후 단계가 실패해도 되돌릴 수 있게 단계마다 저장
    print("매장·식자재·재고 갱신")

    def insert_ids(table, id_col, cols, rows, extra=""):
        """TiDB 자동 증가 ID 는 단조 증가가 보장되지 않는다 → 넣기 전후 이 매장 ID 집합의 차이로 잡는다."""
        before = {r[id_col] for r in q(f"SELECT {id_col} FROM {table} WHERE store_id=%s", STORE)}
        for i in range(0, len(rows), 1000):
            c.executemany(f"INSERT INTO {table} ({','.join(cols)}{extra and ', ' + extra[0]}) "
                          f"VALUES ({','.join(['%s'] * len(cols))}{extra and ', ' + extra[1]})", rows[i:i + 1000])
            conn.commit()
        ins[table] = sorted({r[id_col] for r in q(f"SELECT {id_col} FROM {table} WHERE store_id=%s", STORE)} - before)
        dump(MANIFEST, manifest)
        return ins[table]

    ins["sales_data"] = insert_ids("sales_data", "sales_id",
                                   ("quantity", "sales_date", "created_at", "menu_id", "store_id", "updated_at", "unit_price"),
                                   sales_rows, extra=("is_deleted", "0"))
    print(f"판매 {len(ins['sales_data'])}건 입력")

    ins["inventory_lot"] = insert_ids("INVENTORY_LOT", "lot_id",
                                      ("store_id", "ingredient_id", "order_id", "received_qty", "remaining_qty", "received_at", "expiry_date"), lots)
    ins["inventory_txn"] = insert_ids("INVENTORY_TXN", "txn_id",
                                      ("store_id", "ingredient_id", "delta_qty", "reason", "ref_type", "ref_id", "qty_after", "created_at", "created_by"), txns)
    ins["waste_record"] = insert_ids("waste_record", "waste_id",
                                     ("created_at", "reason", "waste_date", "waste_qty", "ingredient_id", "store_id", "ingredient_name", "unit"), wastes)
    ocols = ("store_id", "ingredient_id", "status", "ordered_qty", "ordered_at", "approved_at", "hq_sent_at",
             "driver_received_at", "owner_received_at", "updated_at")
    ins["order_request"] = insert_ids("order_request", "order_id", ocols, [tuple(o[k] for k in ocols) for o in orders])
    print(f"로트 {len(ins['inventory_lot'])}, 원장 {len(ins['inventory_txn'])}, 폐기 {len(ins['waste_record'])}, 발주 {len(ins['order_request'])}")

    # 심어 둔 진행 중 발주의 ID ↔ 라벨
    planted_rows = [o for o in orders if o.get("_label")]
    ids = q("SELECT order_id, ingredient_id, status, ordered_at FROM order_request WHERE store_id=%s AND status IN "
            "('REQUESTED','APPROVED','HQ_SENT','DRIVER_RECEIVED') ORDER BY order_id", STORE)
    labels = {}
    for o in planted_rows:
        hit = next(r for r in ids if r["ingredient_id"] == o["ingredient_id"] and r["status"] == o["status"]
                   and abs((r["ordered_at"] - o["ordered_at"]).total_seconds()) < 2 and r["order_id"] not in labels)
        labels[hit["order_id"]] = o["_label"]
    truth["inbound"] = {str(k): v for k, v in labels.items()}
    dump(TRUTH, truth)
    dump(MANIFEST, manifest)
    print(f"완료. manifest: {MANIFEST}\n정답표: {TRUTH}")


if __name__ == "__main__":
    main()
