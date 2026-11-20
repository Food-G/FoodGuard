"""자격증명 로드 + 토큰 캐시.

JWT 유효기간이 1시간(jwt.expiration=3600000ms)이라 매 호출마다 재로그인하면
느리다. 역할별로 토큰을 임시 디렉터리에 캐시하고 만료 전에 갱신한다.
저장소를 더럽히지 않도록 캐시는 OS 임시 디렉터리에 둔다.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
import time
from pathlib import Path

from fgcli.client import login

# 서버 만료는 60분. 경계에서 실패하지 않도록 55분으로 잡는다.
TOKEN_TTL_SEC = 55 * 60

CACHE_DIR = Path(tempfile.gettempdir()) / "foodguard-cli"

# 자격증명은 ai-service/.env 에 둔다 (.gitignore:18 로 이미 제외됨)
ENV_PATH = Path(__file__).resolve().parent.parent / "ai-service" / ".env"

ROLES = {
    "owner": ("FOODGUARD_OWNER_EMAIL", "FOODGUARD_OWNER_PASSWORD"),
    "hq": ("FOODGUARD_HQ_EMAIL", "FOODGUARD_HQ_PASSWORD"),
    # 에이전트 서비스 계정 (ROLE_AGENT): 전 매장 조회 + 제안·실행기록 쓰기만 (DEV_ROADMAP AG-0)
    "agent": ("FOODGUARD_AGENT_EMAIL", "FOODGUARD_AGENT_PASSWORD"),
}


def _load_env() -> dict[str, str]:
    """ai-service/.env 를 읽는다. 실제 환경변수가 우선한다."""
    values: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip()
    values.update({k: v for k, v in os.environ.items() if k.startswith("FOODGUARD_")})
    return values


def credentials(role: str) -> tuple[str, str]:
    if role not in ROLES:
        raise SystemExit(f"알 수 없는 역할: {role} (owner, hq, agent)")
    email_key, pw_key = ROLES[role]
    env = _load_env()
    email, password = env.get(email_key), env.get(pw_key)
    if not email or not password:
        raise SystemExit(
            f"{email_key} / {pw_key} 가 설정되지 않았습니다.\n"
            f"{ENV_PATH} 에 아래 4줄을 추가하세요 (이 파일은 git 에서 제외됩니다):\n"
            "  FOODGUARD_OWNER_EMAIL=...\n  FOODGUARD_OWNER_PASSWORD=...\n"
            "  FOODGUARD_HQ_EMAIL=...\n  FOODGUARD_HQ_PASSWORD=..."
        )
    return email, password


def get_token(role: str, force_refresh: bool = False) -> str:
    """역할별 JWT 를 반환한다. 캐시가 유효하면 재사용한다."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE_DIR / f"{role}.json"

    if not force_refresh and cache_file.exists():
        try:
            cached = json.loads(cache_file.read_text(encoding="utf-8"))
            if time.time() < cached.get("expires_at", 0):
                return cached["token"]
        except (json.JSONDecodeError, KeyError):
            pass  # 캐시가 깨졌으면 그냥 새로 받는다

    email, password = credentials(role)
    token = login(email, password)
    cache_file.write_text(
        json.dumps({"token": token, "expires_at": time.time() + TOKEN_TTL_SEC}),
        encoding="utf-8",
    )
    return token


def decode_claims(token: str) -> dict:
    """JWT 페이로드를 디코드한다. 서명 검증은 하지 않는다(서버가 한다)."""
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)  # base64 패딩 복원
    return json.loads(base64.urlsafe_b64decode(payload))
