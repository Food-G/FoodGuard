"""예측 정확도 평가: PREDICTION_LOG × 실제 판매(SALES_DATA).

지표
- MAE   : 평균 절대 오차 (개)
- WAPE  : Σ|오차| / Σ실제  — 0 판매일에도 정의되는 주 지표
- MAPE  : 실제 > 0 인 날만의 평균 |오차|/실제 (참고용, 판매가 적은 날에 크게 튄다)
- bias  : Σ(예측-실제) / Σ실제  — +면 과대예측(폐기 위험), -면 과소예측(품절 위험)
- 기준선: 지난주 같은 요일 판매량을 그대로 예측값으로 쓴 경우. skill = 1 - WAPE_모델/WAPE_기준선
  (skill > 0 이어야 모델이 '그냥 지난주만큼'보다 낫다는 뜻)
"""

from __future__ import annotations

from datetime import timedelta

import pandas as pd
from sqlalchemy import bindparam, text
from sqlalchemy.orm import Session


def _actuals(db: Session, store_ids: list[int]) -> pd.DataFrame:
    rows = db.execute(
        text(
            "SELECT store_id, menu_id, sales_date, SUM(quantity) "
            "FROM SALES_DATA WHERE is_deleted = 0 AND store_id IN :sids "
            "GROUP BY store_id, menu_id, sales_date"
        ).bindparams(bindparam("sids", expanding=True)),
        {"sids": list(store_ids)},
    ).fetchall()
    return pd.DataFrame(rows, columns=["store_id", "menu_id", "date", "actual"]).astype(
        {"actual": float})


def latest_run_id(db: Session, source: str, store_id: int | None = None) -> str | None:
    """매장을 지정하면 그 매장이 포함된 실행 중에서 고른다.

    한계: 백테스트의 predicted_at 은 실행 시각이 아니라 기준일이고 TiDB 의 log_id 는 단조 증가가 아니라서,
    같은 매장을 여러 번 백테스트했을 때 '가장 최근 실행'을 정확히 고르지 못할 수 있다
    (실행 시각 컬럼이 생기기 전까지는 run_id 를 직접 지정하는 것이 확실하다).
    """
    q = "SELECT run_id FROM PREDICTION_LOG WHERE source = :src"
    params: dict = {"src": source}
    if store_id is not None:
        q += " AND store_id = :sid"
        params["sid"] = store_id
    return db.execute(text(q + " ORDER BY predicted_at DESC, log_id DESC LIMIT 1"), params).scalar()


def _metrics(g: pd.DataFrame) -> dict:
    err = g["pred"] - g["actual"]
    total = g["actual"].sum()
    pos = g[g["actual"] > 0]
    out = {
        "n": int(len(g)),
        "mae": round(float(err.abs().mean()), 2),
        "wape": round(float(err.abs().sum() / total), 4) if total else None,
        "mape": round(float(((pos["pred"] - pos["actual"]).abs() / pos["actual"]).mean()), 4)
        if len(pos) else None,
        "bias": round(float(err.sum() / total), 4) if total else None,
    }
    b = g.dropna(subset=["baseline"])
    if len(b) and b["actual"].sum():
        b_wape = float((b["baseline"] - b["actual"]).abs().sum() / b["actual"].sum())
        m_wape = float((b["pred"] - b["actual"]).abs().sum() / b["actual"].sum())
        out["baseline_wape"] = round(b_wape, 4)
        out["skill"] = round(1 - m_wape / b_wape, 4) if b_wape else None
        out["n_with_baseline"] = int(len(b))
    return out


def evaluate(db: Session, source: str = "backtest", run_id: str | None = None,
             store_id: int | None = None) -> dict:
    run_id = run_id or latest_run_id(db, source, store_id)
    if run_id is None:
        return {"error": "no_log", "message": f"source={source} 예측 이력이 없습니다."}

    q = ("SELECT store_id, menu_id, target_date, horizon_days, predicted_qty, model_version "
         "FROM PREDICTION_LOG WHERE run_id = :run")
    params: dict = {"run": run_id}
    if store_id is not None:
        q += " AND store_id = :sid"
        params["sid"] = store_id
    log = pd.DataFrame(db.execute(text(q), params).fetchall(),
                       columns=["store_id", "menu_id", "date", "horizon", "pred", "model_version"])
    if log.empty:
        return {"error": "no_log", "message": "조건에 맞는 예측 이력이 없습니다.", "runId": run_id}

    act = _actuals(db, sorted(log["store_id"].unique().tolist()))
    df = log.merge(act, on=["store_id", "menu_id", "date"], how="inner")
    if df.empty:
        return {"error": "no_actuals", "runId": run_id, "logged": int(len(log)),
                "message": "아직 실제 판매가 쌓이지 않은 예측뿐입니다 (예측 대상일이 지나야 평가할 수 있음)."}

    # 기준선: 같은 메뉴의 7일 전 실제 판매
    prev = act.assign(date=act["date"] + timedelta(days=7)).rename(columns={"actual": "baseline"})
    df = df.merge(prev, on=["store_id", "menu_id", "date"], how="left")
    df["pred"] = df["pred"].astype(float)

    return {
        "runId": run_id,
        "source": source,
        "modelVersion": sorted(df["model_version"].dropna().unique().tolist()),
        "period": {"from": str(df["date"].min()), "to": str(df["date"].max())},
        "stores": int(df["store_id"].nunique()),
        "menus": int(df[["store_id", "menu_id"]].drop_duplicates().shape[0]),
        "logged": int(len(log)),
        "overall": _metrics(df),
        "byHorizon": {int(h): _metrics(g) for h, g in df.groupby("horizon")},
        "byStore": {int(s): _metrics(g) for s, g in df.groupby("store_id")},
    }
