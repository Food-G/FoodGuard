"""agent-service (FastAPI :8100). `python -m fgagent serve` 로 스케줄러와 함께 띄운다.

    GET  /health
    POST /run/{agent}?storeId=&trigger=   Spring 만 호출 (X-Internal-Token). 실행은 백그라운드, runId 를 바로 돌려준다.
    POST /fingerprint/{storeId}            승인 직전 발주안 ID 재계산 (Spring ProposalExecutor.ORDER_CREATE)
    POST /chat                             Copilot. Spring 만 호출하고 사용자 JWT 를 X-User-Token 으로 넘긴다.
"""

from __future__ import annotations

import logging
import secrets
import threading
import uuid

from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from fgagent import copilot
from fgagent.agents import AGENTS, order_advisor
from fgagent.executor import WriteClient
from fgcli.auth import get_token
from fgcli.planner import ObserveError
from fgagent.runtime import loop, runner
from fgcli.auth import _load_env

log = logging.getLogger(__name__)
TOKEN = _load_env().get("INTERNAL_API_TOKEN", "")  # ai-service/.env 와 같은 값
if not TOKEN:
    log.warning("INTERNAL_API_TOKEN 이 비어 있어 내부 인증 없이 동작합니다 (개발 모드).")


def verify_internal_token(x_internal_token: str | None = Header(default=None)) -> None:
    if TOKEN and not secrets.compare_digest(x_internal_token or "", TOKEN):
        raise HTTPException(status_code=401, detail="invalid internal token")


app = FastAPI(title="FoodGuard Agent Service")


@app.get("/health")
def health():
    return {"status": "ok", "agents": sorted(AGENTS)}


def _run_safely(agent: str, store_id: int, trigger: str, run_id: str) -> None:
    try:
        runner.run(agent, store_id, trigger=trigger, run_id=run_id)
    except (RuntimeError, SystemExit, OSError) as e:  # 로그인 실패·자격증명 누락 등 (RunLog 이전 단계)
        log.error("agent %s store=%s 실행 실패: %s", agent, store_id, e)


@app.post("/run/{agent}", dependencies=[Depends(verify_internal_token)])
def run(agent: str, storeId: int, trigger: str = "MANUAL"):
    if agent not in AGENTS:
        raise HTTPException(status_code=404, detail=f"unknown agent: {agent}")
    run_id = str(uuid.uuid4())
    threading.Thread(target=_run_safely, args=(agent, storeId, trigger, run_id), daemon=True).start()
    return {"status": "accepted", "runId": run_id, "agent": agent, "storeId": storeId}


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    storeId: int | None = None


@app.post("/chat", dependencies=[Depends(verify_internal_token)])
def chat(req: ChatRequest, x_user_token: str = Header(...)):
    """조회는 사용자 토큰으로 하므로 권한 검사는 Spring 이 그대로 한다. 토큰은 기록하지 않는다."""
    try:
        return copilot.chat(x_user_token, req.question, [t.model_dump() for t in req.history], req.storeId)
    except loop.AgentError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/fingerprint/{store_id}", dependencies=[Depends(verify_internal_token)])
def fingerprint(store_id: int):
    """제안 때와 같은 planner 로 지금 발주안 ID 를 계산한다 (읽기만, 재예측하지 않음)."""
    try:
        plan = order_advisor.plan_for(WriteClient(get_token("agent")), store_id)
    except (ObserveError, RuntimeError, SystemExit) as e:
        raise HTTPException(status_code=503, detail=f"발주안을 계산하지 못했습니다: {e}")
    return {"storeId": store_id, "planId": plan["planId"]}
