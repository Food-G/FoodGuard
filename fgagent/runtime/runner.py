"""에이전트 1회 실행: observe(결정적 조회) → decide(결정적 산식) → LLM 설명 → 제안 제출.

에이전트 모듈(fgagent/agents/<name>.py)이 갖출 것:
    NAME, ALLOWED_TOOLS, PROMPT, OUTPUT_SCHEMA, DEFAULT_MODEL
    observe(client, store_id) -> dict
    decide(obs) -> dict
    to_proposals(decision, llm_output | None) -> list[{"type", "payload", "rationale", ...}]
    notifications(decision, llm_output | None) -> list[{"type", "message"}]   (선택, 에이전트 직접 쓰기 허용)
"""

from __future__ import annotations

import json
import os

from fgagent.agents import AGENTS
from fgagent.executor import WriteClient
from fgagent.runtime import loop, proposals
from fgagent.runtime.runlog import RunLog
from fgagent.runtime.tools import build_tools
from fgcli.auth import get_token


def model_for(agent) -> str:
    return os.getenv(f"AGENT_MODEL_{agent.NAME.upper()}") or agent.DEFAULT_MODEL


def run(name: str, store_id: int, trigger: str = "MANUAL", use_llm: bool = True,
        run_id: str | None = None) -> dict:
    agent = AGENTS[name]
    client = WriteClient(get_token("agent"))
    model = model_for(agent)
    log = RunLog(client, name, store_id, trigger, run_id)
    log.start(model if use_llm else None)

    llm: dict | None = None
    try:
        obs = agent.observe(client, store_id)
        decision = agent.decide(obs)
        if use_llm:
            user_input = ("다음은 결정적 코드가 조회·계산한 결과입니다. 수량을 새로 계산하지 말고 검토·설명하세요.\n\n```json\n"
                          + json.dumps({"storeId": store_id, "decision": decision}, ensure_ascii=False,
                                       indent=2, default=str) + "\n```")
            llm = loop.run_agent(agent.PROMPT, user_input, build_tools(agent.ALLOWED_TOOLS, store_id),
                                 agent.OUTPUT_SCHEMA, model, client)
        llm_out = llm["output"] if llm else None
        submitted = [proposals.submit(client, log.run_id, name, store_id, p)
                     for p in agent.to_proposals(decision, llm_out)]
        notified = [proposals.notify(client, store_id, n)
                    for n in (agent.notifications(decision, llm_out) if hasattr(agent, "notifications") else [])]
        result = {"decision": decision, "llm": llm, "proposals": submitted, "notifications": notified}
        status = "OK" if all(p["ok"] for p in submitted + notified) else "FAILED"
        path = log.finish(status, result, model=llm["model"] if llm else None,
                          usage=llm["usage"] if llm else None,
                          error=None if status == "OK" else "제안·알림 제출 실패가 있습니다.")
    except (loop.AgentError, RuntimeError, OSError) as e:
        path = log.finish("FAILED", {"llm": llm}, error=str(e))
    return {**log.record, "file": str(path)}
