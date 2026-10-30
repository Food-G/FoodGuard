"""agent-service (FastAPI :8100). `python -m fgagent serve` 로 스케줄러와 함께 띄운다.

    GET  /health
    POST /run/{agent}?storeId=&trigger=   Spring 만 호출 (X-Internal-Token). 실행은 백그라운드, runId 를 바로 돌려준다.
    POST /fingerprint/{storeId}            승인 직전 발주안 ID 재계산 (Spring ProposalExecutor.ORDER_CREATE)
"""

from __future__ import annotations

import logging
import secrets
import threading
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException

from fgagent.agents import AGENTS, order_advisor
from fgagent.executor import WriteClient
from fgcli.auth import get_token
from fgcli.planner import ObserveError
from fgagent.runtime import runner
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


@app.post("/fingerprint/{store_id}", dependencies=[Depends(verify_internal_token)])
def fingerprint(store_id: int):
    """제안 때와 같은 planner 로 지금 발주안 ID 를 계산한다 (읽기만, 재예측하지 않음)."""
    try:
        plan = order_advisor.plan_for(WriteClient(get_token("agent")), store_id)
    except (ObserveError, RuntimeError, SystemExit) as e:
        raise HTTPException(status_code=503, detail=f"발주안을 계산하지 못했습니다: {e}")
    return {"storeId": store_id, "planId": plan["planId"]}
