"""내부 서비스 인증: 백엔드가 보내는 공유 키 (X-Internal-Key) 검사."""

import secrets

from fastapi import Header, HTTPException

from config import settings


def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    if settings.INTERNAL_API_KEY and not secrets.compare_digest(x_internal_key, settings.INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid internal key")
