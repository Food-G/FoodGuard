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


def _run(extra_args: list[str], system_prompt: str, stdin: str, schema: dict) -> subprocess.CompletedProcess:
    cmd = [
        settings.CLAUDE_CLI, "-p",
        *extra_args,
        "--tools", "",
        "--system-prompt", system_prompt,
        "--json-schema", json.dumps(schema, ensure_ascii=False),
        "--no-session-persistence",
    ]
    try:
        return subprocess.run(
            cmd, input=stdin.encode("utf-8"), capture_output=True,
            timeout=TIMEOUT_SECONDS, cwd=tempfile.gettempdir(),
        )
    except FileNotFoundError as e:
        raise ClaudeCliError(f"claude CLI 를 찾을 수 없습니다 (CLAUDE_CLI={settings.CLAUDE_CLI})") from e
    except subprocess.TimeoutExpired as e:
        raise ClaudeCliError(f"claude CLI 응답이 {TIMEOUT_SECONDS}초 안에 오지 않았습니다") from e


def _structured_output(out: dict) -> dict:
    if out.get("is_error") or "structured_output" not in out:
        # 로그인 안 됨 등은 result 에 이유가 온다
        raise ClaudeCliError(f"claude CLI 오류: {str(out.get('result'))[:200]}")
    return out["structured_output"]


def run_structured(system_prompt: str, user_input: str, schema: dict) -> dict:
    proc = _run(["--output-format", "json"], system_prompt, user_input, schema)
    try:
        out = json.loads(proc.stdout.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ClaudeCliError(f"claude CLI 출력 해석 실패: {proc.stderr.decode('utf-8', 'replace')[:200]}") from e
    return _structured_output(out)


def run_structured_image(system_prompt: str, user_input: str, image_base64: str, media_type: str, schema: dict) -> dict:
    """이미지 입력은 stream-json 으로만 넘길 수 있다. 출력의 마지막 result 줄을 쓴다."""
    message = {"type": "user", "message": {"role": "user", "content": [
        {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
        {"type": "text", "text": user_input},
    ]}}
    proc = _run(
        ["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"],
        system_prompt, json.dumps(message, ensure_ascii=False) + "\n", schema,
    )
    try:
        lines = [json.loads(line) for line in proc.stdout.decode("utf-8").splitlines() if line.strip()]
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise ClaudeCliError(f"claude CLI 출력 해석 실패: {proc.stderr.decode('utf-8', 'replace')[:200]}") from e
    results = [o for o in lines if o.get("type") == "result"]
    if not results:
        raise ClaudeCliError(f"claude CLI 출력 해석 실패: {proc.stderr.decode('utf-8', 'replace')[:200]}")
    return _structured_output(results[-1])
