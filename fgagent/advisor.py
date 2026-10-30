"""Claude Code 헤드리스 호출 (`claude -p`).

API 키를 따로 쓰지 않고, 이 PC 에 로그인된 Claude 계정으로 돈다.
도구는 읽기 전용 `python -m fgcli *` 와 Read 만 허용한다:
- --tools Bash,Read          : 쓸 수 있는 도구 종류 자체를 제한
- --allowedTools ...         : Bash 는 fgcli 명령만
- --permission-mode dontAsk  : 허용 목록 밖은 묻지 않고 거부
- --setting-sources project  : settings.local.json 의 curl 등 넓은 허용을 끌어오지 않음
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROMPT = (Path(__file__).parent / "order_advisor.md").read_text(encoding="utf-8")

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ingredientId": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["approve", "reduce", "hold"]},
                    "suggestedQty": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["ingredientId", "verdict", "suggestedQty", "reason"],
            },
        },
        "concerns": {"type": "array", "items": {"type": "string"}},
        "recommendation": {"type": "string", "enum": ["execute", "revise", "wait"]},
    },
    "required": ["summary", "items", "concerns", "recommendation"],
}


class AdvisorError(RuntimeError):
    pass


def review(plan: dict, model: str | None = None, timeout: int = 600) -> dict:
    exe = shutil.which("claude")
    if not exe:
        raise AdvisorError("claude CLI 를 찾을 수 없습니다. Claude Code 를 설치하고 로그인하세요.")

    cmd = [
        exe, "-p",
        "--output-format", "json",
        "--json-schema", json.dumps(SCHEMA),
        "--append-system-prompt", PROMPT,
        "--permission-mode", "dontAsk",
        "--setting-sources", "project",
        "--no-session-persistence",
        "--tools", "Bash,Read",
        "--allowedTools", "Bash(python -m fgcli *)", "Read",
    ]
    if model:
        cmd += ["--model", model]

    # 프롬프트는 stdin 으로 넘긴다 (--allowedTools 가 가변 인자라 위치 인자를 삼킨다)
    prompt = ("다음 발주안을 검토해 주세요.\n\n```json\n"
              + json.dumps(plan, ensure_ascii=False, indent=2) + "\n```")
    try:
        p = subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                           encoding="utf-8", cwd=ROOT, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise AdvisorError(f"Claude 검토가 {timeout}초 안에 끝나지 않았습니다.")

    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError:
        raise AdvisorError(f"Claude 응답을 읽지 못했습니다: {(p.stderr or p.stdout)[:300]}")
    if out.get("is_error") or "structured_output" not in out:
        raise AdvisorError(f"Claude 검토 실패: {str(out.get('result'))[:300]}")

    result = out["structured_output"]
    result["_meta"] = {"turns": out.get("num_turns"),
                       "denied": out.get("permission_denials") or []}
    return result
