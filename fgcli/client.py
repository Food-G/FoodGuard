"""FoodGuard REST API 클라이언트 (읽기 전용).

CLI 는 읽기 커맨드만 제공한다. 쓰기 메서드를 아예 두지 않는 것이 곧 안전 경계다.
발주 생성·상태 변경 같은 쓰기는 사람이 웹 UI 에서 한다.

권한 검사는 서버가 한다. 이 클라이언트는 사용자 계정의 JWT 로 호출하므로
백엔드의 역할 검사(@PreAuthorize)와 매장 소유권 검사(StoreAccessGuard)를
그대로 물려받는다. 403 은 예외로 던지지 않고 구조화된 결과로 돌려주어,
에이전트가 우회를 시도하는 대신 사용자에게 그대로 보고하게 한다.
"""

from __future__ import annotations

import os
from typing import Any

import requests

API_BASE = os.getenv("FOODGUARD_API", "http://localhost:8080")
AI_BASE = os.getenv("FOODGUARD_AI", "http://localhost:8000")


def login(email: str, password: str, timeout: int = 15) -> str:
    """로그인해서 JWT 를 받는다. 응답은 JSON 이 아니라 토큰 문자열 본문이다."""
    r = requests.post(
        f"{API_BASE}/api/auth/login",
        json={"email": email, "password": password},
        timeout=timeout,
    )
    if r.status_code != 200:
        raise RuntimeError(f"로그인 실패 ({r.status_code}): {r.text.strip()}")
    return r.text.strip()


class FoodGuardClient:
    def __init__(self, token: str, timeout: int = 30):
        self.token = token
        self.timeout = timeout

    def get(self, path: str, base: str = API_BASE) -> Any:
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            r = requests.get(f"{base}{path}", headers=headers, timeout=self.timeout)
        except requests.RequestException as e:
            return {"error": "network", "message": str(e),
                    "hint": "서버가 실행 중인지 확인하세요 (백엔드 :8080, AI 서비스 :8000)"}

        if r.status_code == 403:
            # 우회 방법을 알려주지 않는다. 여기에 "--as hq 로 바꿔보라"고 적으면
            # 점주 권한 에이전트가 그대로 따라 해 권한 경계를 넘는다.
            return {"error": "forbidden", "status": 403,
                    "message": "이 매장 또는 기능에 접근할 권한이 없습니다. "
                               "본인 소유 매장이 아니거나 본사 전용 기능입니다.",
                    "action": "우회하지 말고 사용자에게 권한이 없다고 보고하세요."}
        if r.status_code == 401:
            return {"error": "unauthorized", "status": 401,
                    "message": "인증에 실패했습니다. 토큰이 만료됐을 수 있습니다."}
        if r.status_code >= 400:
            return {"error": "http_error", "status": r.status_code,
                    "message": r.text.strip()[:500]}

        if "application/json" in r.headers.get("content-type", ""):
            return r.json()
        return {"text": r.text.strip()}
