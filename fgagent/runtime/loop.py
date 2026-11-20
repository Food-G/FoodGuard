"""Claude tool-use 루프 (공통).

- ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN 이 있으면 Claude API (Anthropic Python SDK) 로
  읽기 도구를 쓰며 돌고, 최종 답은 output_config 의 JSON 스키마로 받는다.
- 없으면 이 PC 의 `claude -p` 로 폴백한다. 폴백은 도구 없이 user_input(관찰 결과 포함)만 보고
  답한다 — CLI 에 fgcli 를 허용하면 `--as hq` 같은 권한 전환을 막을 수 없기 때문이다.

LLM 은 수량을 계산하지 않는다 (R4). 이 루프의 출력은 설명·우선순위뿐이고,
제안 payload 는 각 에이전트의 결정적 코드가 만든다.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

from fgcli.client import FoodGuardClient
from fgagent.runtime.tools import Tool, to_text

ROOT = Path(__file__).resolve().parents[2]


class AgentError(RuntimeError):
    pass


def has_api_credentials() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN"))


def run_agent(system_prompt: str, user_input: str, tools: list[Tool], output_schema: dict,
              model: str, client: FoodGuardClient, max_turns: int = 8) -> dict:
    """{"output": dict, "engine": "api"|"cli", "model", "usage": {...}, "toolCalls": [...]}"""
    if has_api_credentials():
        return _run_api(system_prompt, user_input, tools, output_schema, model, client, max_turns)
    return _run_cli(system_prompt, user_input, output_schema, model)


def _missing_keys(out: object, schema: dict) -> list[str]:
    if not isinstance(out, dict):
        return ["(object 아님)"]
    return [k for k in schema.get("required", []) if k not in out]


def _run_api(system_prompt: str, user_input: str, tools: list[Tool], output_schema: dict,
             model: str, client: FoodGuardClient, max_turns: int) -> dict:
    import anthropic  # agent-service 에서만 필요 (CI 의 planner 테스트는 설치하지 않음)

    api = anthropic.Anthropic()
    by_name = {t.name: t for t in tools}
    messages: list = [{"role": "user", "content": user_input}]
    usage = {"inputTokens": 0, "outputTokens": 0}
    calls: list[dict] = []
    retried = False

    for _ in range(max_turns):
        kwargs: dict = {}
        if tools:
            kwargs["tools"] = [t.spec for t in tools]
        try:
            resp = api.beta.messages.create(
                model=model,
                max_tokens=16000,
                system=system_prompt,
                messages=messages,
                output_config={"format": {"type": "json_schema", "schema": output_schema}},
                # 안전 분류기가 거절하면 서버가 다른 모델로 이어서 답한다
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                **kwargs,
            )
        except anthropic.RateLimitError as e:
            raise AgentError(f"Claude API 요청 한도 초과: {e.message}")
        except anthropic.APIStatusError as e:
            raise AgentError(f"Claude API 오류 ({e.status_code}): {e.message}")
        except anthropic.APIConnectionError:
            raise AgentError("Claude API 에 연결하지 못했습니다.")

        usage["inputTokens"] += resp.usage.input_tokens
        usage["outputTokens"] += resp.usage.output_tokens

        if resp.stop_reason == "refusal":
            raise AgentError("Claude 가 요청을 거절했습니다.")
        if resp.stop_reason == "max_tokens":
            raise AgentError("응답이 max_tokens 에서 잘렸습니다.")

        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason == "pause_turn":
            continue

        if resp.stop_reason == "tool_use":
            results = []
            for block in resp.content:
                if block.type != "tool_use":
                    continue
                tool = by_name.get(block.name)
                result = tool.run(client, dict(block.input)) if tool else {"error": "unknown_tool"}
                # forbidden 등 오류도 그대로 돌려준다 — 우회하지 않고 보고하게 한다
                calls.append({"tool": block.name, "input": dict(block.input),
                              "error": result.get("error") if isinstance(result, dict) else None})
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": to_text(result),
                                **({"is_error": True} if isinstance(result, dict) and "error" in result else {})})
            messages.append({"role": "user", "content": results})
            continue

        text = next((b.text for b in resp.content if b.type == "text"), "")
        try:
            out = json.loads(text)
        except json.JSONDecodeError:
            out = None
        missing = _missing_keys(out, output_schema)
        if not missing:
            return {"output": out, "engine": "api", "model": resp.model, "usage": usage, "toolCalls": calls}
        if retried:
            raise AgentError(f"출력이 스키마와 맞지 않습니다 (누락: {missing})")
        retried = True
        messages.append({"role": "user", "content":
                         f"출력이 스키마와 맞지 않습니다 (누락: {missing}). 스키마에 맞는 JSON 만 다시 답하세요."})

    raise AgentError(f"{max_turns}턴 안에 끝나지 않았습니다.")


def _run_cli(system_prompt: str, user_input: str, output_schema: dict, model: str | None,
             timeout: int = 600) -> dict:
    exe = shutil.which("claude")
    if not exe:
        raise AgentError("ANTHROPIC_API_KEY 가 없고 claude CLI 도 없습니다.")
    cmd = [exe, "-p", "--output-format", "json", "--json-schema", json.dumps(output_schema),
           "--append-system-prompt", system_prompt, "--permission-mode", "dontAsk",
           "--setting-sources", "project", "--no-session-persistence", "--tools", ""]
    if model:
        cmd += ["--model", model]
    try:
        p = subprocess.run(cmd, input=user_input, capture_output=True, text=True,
                           encoding="utf-8", cwd=ROOT, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise AgentError(f"claude -p 가 {timeout}초 안에 끝나지 않았습니다.")
    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError:
        raise AgentError(f"claude -p 응답을 읽지 못했습니다: {(p.stderr or p.stdout)[:300]}")
    if out.get("is_error") or "structured_output" not in out:
        raise AgentError(f"claude -p 실패: {str(out.get('result'))[:300]}")
    u = out.get("usage") or {}
    return {"output": out["structured_output"], "engine": "cli", "model": model,
            "usage": {"inputTokens": u.get("input_tokens"), "outputTokens": u.get("output_tokens")},
            "toolCalls": []}
