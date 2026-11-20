import logging

import requests

from services import weather_service

KEY = "SECRETkey123+/="


def _forbidden(url, params=None, timeout=None):
    r = requests.models.Response()
    r.status_code = 403
    r.reason = "Forbidden"
    r.url = url.replace(KEY, requests.utils.quote(KEY, safe="")) + "&pageNo=1"
    return r


def test_mid_term_failure_log_hides_service_key(monkeypatch, caplog):
    monkeypatch.setattr(weather_service.requests, "get", _forbidden)
    with caplog.at_level(logging.WARNING):
        df = weather_service._fetch_mid_term("11B00000", "11B10101", KEY)
    assert df.empty
    assert "403" in caplog.text
    assert KEY not in caplog.text
    assert requests.utils.quote(KEY, safe="") not in caplog.text
    assert "serviceKey=***" in caplog.text


def test_short_term_failure_log_hides_service_key(monkeypatch, caplog):
    monkeypatch.setattr(weather_service.requests, "get", _forbidden)
    with caplog.at_level(logging.WARNING):
        df = weather_service._fetch_short_term(60, 127, KEY)
    assert df.empty
    assert requests.utils.quote(KEY, safe="") not in caplog.text
    assert "serviceKey=***" in caplog.text
