"""AI 서비스 내부 키: 키를 설정하면 백엔드(키 보유)만 호출할 수 있다. /health 는 열려 있다."""

import pytest
from fastapi.testclient import TestClient

from config import settings
from main import app

client = TestClient(app)
PARSE = "/api/events/parse"  # 빈 메모는 claude 호출 전에 400 으로 끝난다


@pytest.fixture
def key(monkeypatch):
    monkeypatch.setattr(settings, "INTERNAL_API_KEY", "test-key")


def test_missing_or_wrong_key_is_rejected(key):
    assert client.post(PARSE, json={"note": " "}).status_code == 401
    assert client.post(PARSE, json={"note": " "}, headers={"X-Internal-Key": "wrong"}).status_code == 401


def test_right_key_passes(key):
    assert client.post(PARSE, json={"note": " "}, headers={"X-Internal-Key": "test-key"}).status_code == 400


def test_health_needs_no_key(key):
    assert client.get("/health").status_code == 200


def test_no_key_configured_skips_check(monkeypatch):
    monkeypatch.setattr(settings, "INTERNAL_API_KEY", "")
    assert client.post(PARSE, json={"note": " "}).status_code == 400
