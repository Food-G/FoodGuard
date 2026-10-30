"""
모델 비교 실험 (backtest.py --compare) — 계획서의 예측 모델 구성(LSTM·XGBoost·Prophet)을 같은 백테스트 조건에서 비교한다.
운영 서비스에는 쓰지 않는다. 설치: pip install -r requirements-experiment.txt

- Prophet: 메뉴마다 따로 학습 (요일 계절성 + 한국 공휴일, 연 계절성은 이력이 3~4개월이라 끔)
- LSTM: 전체 매장×메뉴를 함께 학습하는 글로벌 모델 (XGBoost 와 같은 cross-learning 조건).
  입력은 최근 28일 달력의 (판매량 / 구간 평균, 영업 여부, 요일), 출력은 다음 7일 비율을 한 번에 (direct).
  손실은 XGBoost 와 같은 L1. 휴무일·품절일 정답은 손실에서 뺀다
두 모델 모두 날씨는 넣지 않는다 (backtest.py 와 같은 이유).
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import numpy as np
import pandas as pd
import torch
from prophet import Prophet
from torch import nn

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

SeriesKey = tuple[int, int]
WINDOW = 28
HORIZON = 7


def prophet_forecast(train: pd.DataFrame, targets: list[date]) -> dict[date, float]:
    """메뉴 하나의 이력으로 Prophet 을 학습해 targets 날짜를 예측. 품절일은 정답으로 쓰지 않는다."""
    if "sold_out" in train.columns:
        train = train[train["sold_out"] == 0]
    m = Prophet(weekly_seasonality=True, yearly_seasonality=False, daily_seasonality=False)
    m.add_country_holidays(country_name="KR")
    m.fit(pd.DataFrame({"ds": pd.to_datetime(train["ds"]), "y": train["y"].astype(float)}))
    fc = m.predict(pd.DataFrame({"ds": pd.to_datetime(targets)}))
    return {t: max(0.0, float(v)) for t, v in zip(targets, fc["yhat"])}


class _Net(nn.Module):
    def __init__(self, hidden: int = 32):
        super().__init__()
        self.lstm = nn.LSTM(input_size=9, hidden_size=hidden, batch_first=True)
        self.head = nn.Linear(hidden, HORIZON)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.head(out[:, -1])


def _calendar(df: pd.DataFrame, end: date) -> tuple[list[date], np.ndarray, np.ndarray]:
    """첫 판매일 ~ end 의 달력: (날짜, 판매량(없으면 nan), 정답으로 쓸 수 있는지(영업일이고 품절 아님))."""
    days = [df["ds"].iloc[0] + timedelta(days=i) for i in range((end - df["ds"].iloc[0]).days + 1)]
    y = dict(zip(df["ds"], df["y"].astype(float)))
    sold_out = set(df.loc[df["sold_out"] == 1, "ds"]) if "sold_out" in df.columns else set()
    values = np.array([y.get(d, np.nan) for d in days])
    usable = np.array([d in y and d not in sold_out for d in days])
    return days, values, usable


def _window(days: list[date], values: np.ndarray, e: int) -> tuple[np.ndarray, float]:
    """e 번째 날로 끝나는 WINDOW 일 입력 (판매량/구간 평균, 영업 여부, 요일 one-hot)과 구간 평균(scale)."""
    v = values[e - WINDOW + 1: e + 1]
    observed = ~np.isnan(v)
    scale = float(np.nanmean(v)) + 1.0 if observed.any() else 1.0
    x = np.zeros((WINDOW, 9), dtype=np.float32)
    x[:, 0] = np.where(observed, np.nan_to_num(v) / scale, 0.0)
    x[:, 1] = observed
    for j, d in enumerate(days[e - WINDOW + 1: e + 1]):
        x[j, 2 + d.weekday()] = 1.0
    return x, scale


class LSTMForecaster:
    def __init__(self, epochs: int = 150, seed: int = 42):
        self.epochs = epochs
        self.seed = seed
        self.net: _Net | None = None
        self._series: dict[SeriesKey, pd.DataFrame] = {}
        self._end: date | None = None

    def fit(self, series: dict[SeriesKey, pd.DataFrame], end: date) -> "LSTMForecaster":
        """series: end 까지의 이력. 각 시계열에서 미래 7일이 end 안에 있는 모든 창을 학습 샘플로 쓴다."""
        self._series, self._end = series, end
        xs, ys, masks = [], [], []
        for df in series.values():
            days, values, usable = _calendar(df, end)
            for e in range(WINDOW - 1, len(days) - HORIZON):
                x, scale = _window(days, values, e)
                fut = slice(e + 1, e + 1 + HORIZON)
                xs.append(x)
                ys.append(np.nan_to_num(values[fut]) / scale)
                masks.append(usable[fut])
        torch.manual_seed(self.seed)
        self.net = _Net()
        if not xs:
            return self
        X = torch.tensor(np.stack(xs))
        Y = torch.tensor(np.stack(ys), dtype=torch.float32)
        M = torch.tensor(np.stack(masks), dtype=torch.float32)
        opt = torch.optim.Adam(self.net.parameters(), lr=0.01)
        for _ in range(self.epochs):
            opt.zero_grad()
            loss = ((self.net(X) - Y).abs() * M).sum() / M.sum().clamp(min=1)
            loss.backward()
            opt.step()
        return self

    def predict(self, key: SeriesKey, targets: list[date]) -> dict[date, float]:
        """end 다음 날부터 7일 중 targets 날짜의 예측. 이력이 WINDOW 일보다 짧으면 앞을 결측으로 채운다."""
        df = self._series[key]
        days, values, _ = _calendar(df, self._end)
        pad = max(0, WINDOW - len(days))
        days = [days[0] - timedelta(days=pad - i) for i in range(pad)] + days
        values = np.concatenate([np.full(pad, np.nan), values])
        x, scale = _window(days, values, len(days) - 1)
        with torch.no_grad():
            out = self.net(torch.tensor(x[None]))[0].numpy() * scale
        return {t: max(0.0, float(out[(t - self._end).days - 1])) for t in targets}
