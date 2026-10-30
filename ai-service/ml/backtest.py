"""워크포워드 백테스트: 과거 기준일마다 '그날까지의 데이터로만' 학습 → 다음 7일 예측 → PREDICTION_LOG(source=backtest).

    python -m ml.backtest                 # 전 매장
    python -m ml.backtest --store 60006   # 한 매장
    python -m ml.backtest --no-weather    # 날씨 피처 없이

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


def run(store_ids: list[int] | None, cutoffs: int, min_train: int, use_weather: bool) -> str:
    db = SessionLocal()
    run_id = str(uuid.uuid4())
    try:
        if not store_ids:
            store_ids = [r[0] for r in db.execute(text(
                "SELECT DISTINCT store_id FROM SALES_DATA WHERE is_deleted = 0")).fetchall()]
        for sid in store_ids:
            weather = None
            if use_weather:
                start = db.execute(text("SELECT MIN(sales_date) FROM SALES_DATA "
                                        "WHERE store_id = :s AND is_deleted = 0"), {"s": sid}).scalar()
                if start:
                    lat, lon = get_coords(get_store_region(db, sid))
                    db.commit()  # 외부 API 를 기다리는 동안 트랜잭션을 열어 두지 않는다
                    w = fetch_historical_weather(lat, lon, start, datetime.now().date())
                    weather = w if not w.empty else None

            menus = get_active_menus(db, sid)
            sales_by_menu = {m["menu_id"]: get_sales_data(db, sid, m["menu_id"]) for m in menus}
            # 학습 동안 트랜잭션을 열어 두면 TiDB 가 연결을 끊으므로, 읽기를 끝내고 계산한 뒤 한 번에 쓴다
            db.commit()

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
            print(f"store {sid}: 메뉴 {len(menus)}개, 예측 {n_rows}건 기록", flush=True)
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
    a = ap.parse_args()

    run_id = run(a.store, a.cutoffs, a.min_train, not a.no_weather)
    db = SessionLocal()
    try:
        print(json.dumps(evaluate(db, source="backtest", run_id=run_id), ensure_ascii=False, indent=2))
    finally:
        db.close()


if __name__ == "__main__":
    main()
