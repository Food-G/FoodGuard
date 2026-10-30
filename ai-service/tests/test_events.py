"""점주 특이사항 → claude 배율 → XGBoost 피처(event_lift) 경로 검증 (실제 CLI 는 부르지 않는다)."""

from datetime import timedelta

import pytest
from fastapi import HTTPException

import routers.events as events_router
from backtest import synthetic_event_series
from ml.demand_predictor import DemandPredictor
from routers.events import ParseEventRequest, parse_event
from services.claude_cli import ClaudeCliError


def test_without_events_feature_set_is_unchanged():
    series, _ = synthetic_event_series()
    assert "event_lift" not in DemandPredictor().fit(series).feature_cols


def test_learned_event_feature_raises_forecast_on_upcoming_event_day():
    series, events = synthetic_event_series()
    dates = sorted(next(iter(series.values()))["ds"])
    origin = dates[149]
    past = {k: df[df["ds"] <= origin] for k, df in series.items()}
    # 다음 7일 안에 배율이 큰 특이사항이 있는 매장·날짜
    sid, day = next((s, d) for s, ev in events.items() for d, lift in ev.items()
                    if origin < d <= origin + timedelta(days=7) and lift >= 1.4)
    mid = next(m for s, m in series if s == sid)

    with_events = DemandPredictor().fit(past, events=events)
    without = DemandPredictor().fit(past)
    assert "event_lift" in with_events.feature_cols
    pred = lambda m: next(p["predicted_qty"] for p in m.predict(sid, mid, start_date=origin) if p["date"] == day)
    assert pred(with_events) > pred(without) * 1.15


def test_parse_clamps_lift_and_maps_cli_errors(monkeypatch):
    monkeypatch.setattr(events_router, "run_structured",
                        lambda *a: {"eventType": "RESERVATION", "lift": 9.0, "reason": "r"})
    assert parse_event(ParseEventRequest(note="단체 예약 500명"))["lift"] == 3.0

    def fail(*a):
        raise ClaudeCliError("x")
    monkeypatch.setattr(events_router, "run_structured", fail)
    with pytest.raises(HTTPException) as e:
        parse_event(ParseEventRequest(note="축제"))
    assert e.value.status_code == 503

    with pytest.raises(HTTPException):
        parse_event(ParseEventRequest(note="  "))
