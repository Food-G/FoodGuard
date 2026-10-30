"""
claude CLI 헤드리스 호출 (`claude -p`). 시제품 단계라 API 대신 로그인된 Claude Code CLI 를 쓴다.

- 도구 없음(--tools ""): 파일·명령을 건드리지 않고 넘겨준 데이터로 글만 쓴다
- 짧은 시스템 프롬프트로 교체(--system-prompt): 기본 Claude Code 프롬프트(약 2.5만 토큰)를 싣지 않아 호출당 비용이 1/30 수준
- 구조화 출력(--json-schema): 응답의 structured_output 을 그대로 쓴다
- 임시 폴더에서 실행: 프로젝트 CLAUDE.md 같은 작업 폴더 문맥이 섞이지 않게
"""

from __future__ import annotations

import json
import subprocess
import tempfile

from config import settings

TIMEOUT_SECONDS = 50  # 백엔드 → AI 서비스 읽기 타임아웃(60초)보다 짧게


class ClaudeCliError(RuntimeError):
    pass


def run_structured(system_prompt: str, user_input: str, schema: dict) -> dict:
    cmd = [
        settings.CLAUDE_CLI, "-p",
        "--output-format", "json",
        "--tools", "",
        "--system-prompt", system_prompt,
        "--json-schema", json.dumps(schema, ensure_ascii=False),
        "--no-session-persistence",
    ]
    try:
        proc = subprocess.run(
            cmd, input=user_input.encode("utf-8"), capture_output=True,
            timeout=TIMEOUT_SECONDS, cwd=tempfile.gettempdir(),
        )
    except FileNotFoundError as e:
        raise ClaudeCliError(f"claude CLI 를 찾을 수 없습니다 (CLAUDE_CLI={settings.CLAUDE_CLI})") from e
    except subprocess.TimeoutExpired as e:
        raise ClaudeCliError(f"claude CLI 응답이 {TIMEOUT_SECONDS}초 안에 오지 않았습니다") from e

    try:
        out = json.loads(proc.stdout.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ClaudeCliError(f"claude CLI 출력 해석 실패: {proc.stderr.decode('utf-8', 'replace')[:200]}") from e
    if out.get("is_error") or "structured_output" not in out:
        # 로그인 안 됨 등은 result 에 이유가 온다
        raise ClaudeCliError(f"claude CLI 오류: {str(out.get('result'))[:200]}")
    return out["structured_output"]
