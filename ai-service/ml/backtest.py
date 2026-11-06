"""워크포워드 백테스트: 과거 기준일마다 '그날까지의 데이터로만' 학습 → 다음 7일 예측 → PREDICTION_LOG(source=backtest).

    python -m ml.backtest                 # 전 매장
    python -m ml.backtest --store 60006   # 한 매장
    python -m ml.backtest --no-weather    # 날씨 피처 없이
    python -m ml.backtest --store 60006 --compare --window 90   # 학습 정책 비교 (전체 이력 vs 최근 90일, 기록 안 함)

- 기준일은 메뉴의 마지막 판매일에서 7일씩 거슬러 --cutoffs 개.
- 학습 데이터가 --min-train 일보다 적은 기준일은 건너뛴다.
- 모델 파일(trained_models)은 저장하지 않는다. 서비스 모델에 영향 없음.
- 날씨: 학습은 과거 관측값, 예측 구간도 '실제 관측 날씨'를 예보로 쓴다.
  실서비스(예보 오차가 있음)보다 낙관적인 조건이다.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, time, timedelta

from sqlalchemy import text

from database import SessionLocal
from ml.demand_predictor import DemandPredictor
from services.accuracy_service import evaluate
from services.data_service import (
    get_active_menus, get_sales_data, get_store_region, insert_prediction_log,
)
from services.prediction_service import MODEL_VERSION
from services.weather_service import fetch_historical_weather, get_coords

COMPARE_CUTOFFS = 4  # 정책 비교는 fit 을 두 배로 하므로 기준일을 줄인다


def _store_weather(db, sid: int):
    start = db.execute(text("SELECT MIN(sales_date) FROM SALES_DATA "
                            "WHERE store_id = :s AND is_deleted = 0"), {"s": sid}).scalar()
    if not start:
        return None
    lat, lon = get_coords(get_store_region(db, sid))
    db.commit()  # 외부 API 를 기다리는 동안 트랜잭션을 열어 두지 않는다
    w = fetch_historical_weather(lat, lon, start, datetime.now().date())
    return w if not w.empty else None


def load_store_inputs(db, sid: int, use_weather: bool = True) -> tuple:
    """(날씨, {menu_id: 판매 이력}). 학습 동안 트랜잭션을 열어 두면 TiDB 가 연결을 끊으므로 읽기를 여기서 끝낸다."""
    weather = _store_weather(db, sid) if use_weather else None
    menus = get_active_menus(db, sid)
    sales_by_menu = {m["menu_id"]: get_sales_data(db, sid, m["menu_id"]) for m in menus}
    db.commit()
    return weather, sales_by_menu


def compare_policies(store_id: int, sales_by_menu: dict, weather, champion_window: int | None,
                     challenger_window: int | None, cutoffs: int = COMPARE_CUTOFFS,
                     min_train: int = 28) -> dict:
    """같은 기준일·메뉴·날짜로 두 학습 정책의 WAPE 를 잰다. PREDICTION_LOG 에 쓰지 않는다
    (쓰면 정확도 조회의 '최신 백테스트'가 챌린저 실행으로 바뀐다)."""
    err = {"champion": 0.0, "challenger": 0.0}
    by_cutoff: dict[int, list[float]] = {}  # 기준일별 [챔피언 오차, 챌린저 오차] — 우연히 한 번 맞은 것과 구분한다
    total, n = 0.0, 0
    for menu_id, sales in sales_by_menu.items():
        if sales.empty:
            continue
        actual = dict(zip(sales["ds"], sales["y"]))
        last = max(sales["ds"])
        for k in range(cutoffs, 0, -1):
            cutoff = last - timedelta(days=7 * k)
            train = sales[sales["ds"] <= cutoff]
            if len(train) < min_train:
                continue
            preds = {}
            for name, window in (("champion", champion_window), ("challenger", challenger_window)):
                p = DemandPredictor(store_id, menu_id, train_window_days=window)
                p.fit(train, weather_df=weather, compute_score=False)
                preds[name] = p.predict(days=7, forecast_df=weather, as_of=cutoff)
            slot = by_cutoff.setdefault(k, [0.0, 0.0])
            for i, (name, rows) in enumerate(preds.items()):
                e = sum(abs(r["predicted_qty"] - actual[r["date"]]) for r in rows if r["date"] in actual)
                err[name] += e
                slot[i] += e
            total += sum(actual[r["date"]] for r in preds["champion"] if r["date"] in actual)
            n += sum(1 for r in preds["champion"] if r["date"] in actual)
    wape = (lambda e: round(float(e / total), 4) if total else None)
    return {"n": n, "championWape": wape(err["champion"]), "challengerWape": wape(err["challenger"]),
            "cutoffs": len(by_cutoff), "challengerWins": sum(1 for a, b in by_cutoff.values() if b < a),
            "championWindowDays": champion_window, "challengerWindowDays": challenger_window}


def run(store_ids: list[int] | None, cutoffs: int, min_train: int, use_weather: bool) -> str:
    db = SessionLocal()
    run_id = str(uuid.uuid4())
    try:
        if not store_ids:
            store_ids = [r[0] for r in db.execute(text(
                "SELECT DISTINCT store_id FROM SALES_DATA WHERE is_deleted = 0")).fetchall()]
        for sid in store_ids:
            # 읽기를 끝내고 계산한 뒤 한 번에 쓴다
            weather, sales_by_menu = load_store_inputs(db, sid, use_weather)

            batches = []
            for menu_id, sales in sales_by_menu.items():
                if sales.empty:
                    continue
                last = max(sales["ds"])
                for k in range(cutoffs, 0, -1):
                    cutoff = last - timedelta(days=7 * k)
                    train = sales[sales["ds"] <= cutoff]
                    if len(train) < min_train:
                        continue
                    p = DemandPredictor(sid, menu_id)
                    p.fit(train, weather_df=weather)
                    batches.append((menu_id, cutoff, p.predict(days=7, forecast_df=weather, as_of=cutoff)))

            version = MODEL_VERSION + ("" if weather is not None else "-noweather")
            for menu_id, cutoff, preds in batches:
                insert_prediction_log(
                    db, sid, menu_id, preds, version, source="backtest",
                    predicted_at=datetime.combine(cutoff, time(23, 59, 59)), run_id=run_id,
                )
            db.commit()
            n_rows = sum(len(b[2]) for b in batches)
            print(f"store {sid}: 메뉴 {len(sales_by_menu)}개, 예측 {n_rows}건 기록", flush=True)
        return run_id
    finally:
        db.close()


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(prog="python -m ml.backtest")
    ap.add_argument("--store", type=int, action="append", help="매장 ID (여러 번 가능, 생략 시 전체)")
    ap.add_argument("--cutoffs", type=int, default=6, help="기준일 개수 (7일 간격)")
    ap.add_argument("--min-train", type=int, default=28, help="최소 학습 일수")
    ap.add_argument("--no-weather", action="store_true")
    ap.add_argument("--compare", action="store_true", help="전체 이력 vs 최근 --window 일 학습 비교 (기록하지 않음, --store 필요)")
    ap.add_argument("--window", type=int, default=90, help="--compare 의 학습 일수")
    a = ap.parse_args()

    if a.compare:
        if not a.store:
            ap.error("--compare 에는 --store 가 필요합니다.")
        db = SessionLocal()
        try:
            for sid in a.store:
                weather, sales_by_menu = load_store_inputs(db, sid, not a.no_weather)
                result = compare_policies(sid, sales_by_menu, weather, None, a.window, a.cutoffs, a.min_train)
                print(json.dumps({"storeId": sid, **result}, ensure_ascii=False, indent=2))
        finally:
            db.close()
        return

    run_id = run(a.store, a.cutoffs, a.min_train, not a.no_weather)
    db = SessionLocal()
    try:
        print(json.dumps(evaluate(db, source="backtest", run_id=run_id), ensure_ascii=False, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
