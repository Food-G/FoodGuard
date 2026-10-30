"""제안 제출 → Spring /api/agent/proposals. 실행은 사람이 승인한 뒤 Spring 이 한다 (R5)."""

from __future__ import annotations

from fgagent.executor import WriteClient


def submit(client: WriteClient, run_id: str, agent: str, store_id: int, proposal: dict) -> dict:
    """proposal: {"type", "payload", "rationale", "fingerprint"?, "expiresAt"?}. 결과를 dict 로 돌려준다."""
    status, body = client.post("/api/agent/proposals", {
        "runId": run_id, "agent": agent, "storeId": store_id, **proposal,
    })
    ok = status == 200 and isinstance(body, dict) and body.get("id") is not None
    return {"type": proposal["type"], "ok": ok, "proposalId": body.get("id") if ok else None,
            "error": None if ok else f"{status}: {str(body)[:200]}"}
