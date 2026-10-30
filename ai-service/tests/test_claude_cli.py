"""claude CLI 래퍼와 발주 근거 설명 라우터 — 실제 CLI 를 부르지 않고 subprocess 를 가짜로 바꿔 검증."""

import json
import subprocess

import pytest
from fastapi import HTTPException

import services.claude_cli as cli
from routers.explain import ExplainOrderRequest, explain_order


class _Proc:
    def __init__(self, stdout: dict):
        self.stdout = json.dumps(stdout, ensure_ascii=False).encode("utf-8")
        self.stderr = b""


def _fake_run(response=None, exc=None, calls=None):
    def run(cmd, **kwargs):
        if calls is not None:
            calls.append((cmd, kwargs))
        if exc:
            raise exc
        return _Proc(response)
    return run


def test_runs_without_tools_and_returns_structured_output(monkeypatch):
    calls = []
    monkeypatch.setattr(cli.subprocess, "run", _fake_run({"is_error": False, "structured_output": {"a": 1}}, calls=calls))
    assert cli.run_structured("시스템", "입력 한글", {"type": "object"}) == {"a": 1}
    cmd, kwargs = calls[0]
    assert cmd[cmd.index("--tools") + 1] == ""          # 도구 없음
    assert "--system-prompt" in cmd and "--json-schema" in cmd
    assert kwargs["input"] == "입력 한글".encode("utf-8")


@pytest.mark.parametrize("response, exc", [
    ({"is_error": True, "result": "Not logged in"}, None),
    ({"is_error": False, "result": "text only"}, None),          # structured_output 없음
    (None, subprocess.TimeoutExpired("claude", 50)),
    (None, FileNotFoundError()),
])
def test_cli_failures_become_claude_cli_error(monkeypatch, response, exc):
    monkeypatch.setattr(cli.subprocess, "run", _fake_run(response, exc))
    with pytest.raises(cli.ClaudeCliError):
        cli.run_structured("s", "u", {})


def test_explain_drops_unknown_ingredients_and_maps_errors_to_503(monkeypatch):
    import routers.explain as explain
    monkeypatch.setattr(explain, "run_structured", lambda *a: {
        "summary": "요약", "items": [{"ingredientId": 1, "explanation": "ok"}, {"ingredientId": 99, "explanation": "지어냄"}]})
    result = explain_order(ExplainOrderRequest(items=[{"ingredientId": 1}]))
    assert [i["ingredientId"] for i in result["items"]] == [1]

    def fail(*a):
        raise cli.ClaudeCliError("x")
    monkeypatch.setattr(explain, "run_structured", fail)
    with pytest.raises(HTTPException) as e:
        explain_order(ExplainOrderRequest(items=[{"ingredientId": 1}]))
    assert e.value.status_code == 503

    # 발주할 게 없으면 CLI 를 부르지 않는다
    assert explain_order(ExplainOrderRequest(items=[]))["items"] == []
