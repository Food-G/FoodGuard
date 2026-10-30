"""오프라인 시간순 백테스트 (I-06, I-07).

DB 없이 메뉴 하나의 판매 이력 DataFrame(ds, y)만으로 실행한다.
예측 시점(origin)을 7일씩 옮기며, 그 시점 이전 데이터로만 DemandPredictor를 학습하고 다음 7일을 예측해
실제 판매와 비교한다. 비교 기준(베이스라인)은 "지난주 같은 요일"과 "학습 기간 요일 평균" 두 가지.

지표
- WAPE: 절대오차 합 / 실제 판매 합 (%)
- MASE: 평균 절대오차 / 첫 학습 구간에서 "지난주 같은 요일" 예측의 평균 절대오차 (1보다 작으면 그 기준보다 나음)
- 충족률: 실제 판매 ≤ 추천 발주량인 날의 비율 (분위수 목표 60%와 비교)

날씨는 넣지 않는다(학습·예측 모두 계절 평균 기본값). 실제 판매가 없는 날짜는 평가에서 뺀다.

사용 예 (ai-service 폴더에서): venv\\Scripts\\python.exe -m evaluation.backtest
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from ml.demand_predictor import DemandPredictor


def rolling_backtest(
    df: pd.DataFrame, min_train: int = 28, horizon: int = 7, step: int = 7
) -> pd.DataFrame:
    """예측 시점마다 학습 → horizon일 예측. 반환: 예측 대상일별 실제값·모델·베이스라인 한 행씩."""
    df = df[["ds", "y"]].copy()
    df["ds"] = pd.to_datetime(df["ds"]).dt.date
    df = df.sort_values("ds").reset_index(drop=True)
    actual = dict(zip(df["ds"], df["y"].astype(float)))

    rows = []
    first, last = df["ds"].iloc[0], df["ds"].iloc[-1]
    train_end = first + timedelta(days=min_train - 1)
    while train_end + timedelta(days=1) <= last:
        train = df[df["ds"] <= train_end]
        predictor = DemandPredictor(store_id=0, menu_id=0)
        predictor.fit(train)
        preds = predictor.predict(days=horizon, base_date=train_end)

        train_dow = pd.Series(train["y"].values, index=[d.weekday() for d in train["ds"]]).groupby(level=0).mean()
        for h, p in enumerate(preds, start=1):
            target = p["date"]
            if target not in actual:
                continue
            rows.append({
                "train_end": train_end,
                "target": target,
                "horizon": h,
                "actual": actual[target],
                "model": float(p["predicted_qty"]),
                "recommended": float(p["recommended_order_qty"]),
                "naive_last_week": actual.get(target - timedelta(days=7), np.nan),
                "dow_mean": float(train_dow.get(target.weekday(), train["y"].mean())),
            })
        train_end += timedelta(days=step)
    return pd.DataFrame(rows)


def summarize(results: pd.DataFrame, df: pd.DataFrame, min_train: int = 28) -> pd.DataFrame:
    """방법별 WAPE·MASE 표와 추천량 충족률."""
    hist = df.sort_values("ds")["y"].astype(float).values[:min_train]
    scale = np.mean(np.abs(hist[7:] - hist[:-7])) if len(hist) > 7 else np.nan

    table = []
    for name, col in (("FoodGuard 모델", "model"), ("지난주 같은 요일", "naive_last_week"), ("요일 평균", "dow_mean")):
        r = results.dropna(subset=[col])
        err = np.abs(r[col] - r["actual"])
        table.append({
            "방법": name,
            "WAPE(%)": round(err.sum() / max(r["actual"].sum(), 1e-9) * 100, 1),
            "MASE": round(err.mean() / scale, 2) if scale and scale > 0 else np.nan,
            "평가 일수": len(r),
        })
    out = pd.DataFrame(table)
    out.attrs["충족률(%)"] = round((results["actual"] <= results["recommended"]).mean() * 100, 1)
    return out


def _synthetic(days: int = 120, seed: int = 0) -> pd.DataFrame:
    """요일 패턴 + 10% 노이즈 예시 데이터 (월~일)."""
    rng = np.random.default_rng(seed)
    pattern = [20, 22, 25, 28, 45, 60, 35]
    start = date(2026, 5, 4)
    ds = [start + timedelta(days=i) for i in range(days)]
    y = [max(0, round(pattern[d.weekday()] * rng.normal(1, 0.1))) for d in ds]
    return pd.DataFrame({"ds": ds, "y": y})


if __name__ == "__main__":
    data = _synthetic()
    res = rolling_backtest(data)
    summary = summarize(res, data)
    print(f"합성 데이터 {len(data)}일, 예측 시점 {res['train_end'].nunique()}개, 평가 {len(res)}일")
    print(summary.to_string(index=False))
    print(f"추천 발주량 충족률: {summary.attrs['충족률(%)']}% (목표 60%)")
