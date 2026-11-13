"""Store Copilot (AG-8): 사용자 질문에 읽기 전용 조회로 답한다.

도구는 AGENT 계정이 아니라 **질문한 사람의 JWT** 로 호출한다. 다른 매장을 물으면 서버가 403 을 돌려주고,
그 결과를 그대로 답한다. 쓰기 도구는 없다 (FoodGuardClient 에는 쓰기 메서드가 없다).
"발주해줘"는 action=order_plan 으로 표시만 하고, 실행은 사람이 화면의 버튼을 눌러서 한다.
"""

from __future__ import annotations

import json
import os
from datetime import date, timedelta
from pathlib import Path

from fgagent.executor import WriteClient
from fgagent.runtime import loop
from fgagent.runtime.runlog import RunLog
from fgagent.runtime.tools import build_tools, run_command, to_text
from fgcli.auth import decode_claims, get_token
from fgcli.client import FoodGuardClient

NAME = "chat"
DEFAULT_MODEL = "claude-sonnet-5-5"
PROMPT = (Path(__file__).parent / "copilot.md").read_text(encoding="utf-8")
CHAT_TOOLS = ["stores", "menus", "recipe", "ingredients", "inventory", "predictions", "recommend", "orders",
              "orders-all", "sales", "today", "weekly", "weekly-all", "txns", "lots", "waste", "accuracy"]
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "action": {"type": "string", "enum": ["none", "order_plan"],
                   "description": "사용자가 발주를 요청했으면 order_plan, 아니면 none"},
    },
    "required": ["answer", "action"],
    "additionalProperties": False,
}
MAX_HISTORY_TURNS = 10
# claude -p 폴백은 도구를 쓸 수 없어(§loop) 미리 조회한 값만 보고 답한다
OWNER_CONTEXT = ["today", "weekly", "inventory", "predictions", "orders", "waste", "recommend"]
HQ_CONTEXT = ["stores", "weekly-all", "orders-all"]


def _log_client() -> WriteClient:
    """실행 기록은 AGENT 계정으로 쓴다 (사용자 JWT 로는 기록 API 를 쓸 수 없다). 계정이 없어도 답변은 막지 않는다."""
    try:
        return WriteClient(get_token("agent"))
    except (RuntimeError, OSError, SystemExit):
        return WriteClient("")


def _role(token: str) -> str | None:
    try:
        return decode_claims(token).get("role")
    except (ValueError, IndexError):
        return None


SALES_SUMMARY_DAYS = 14
TOP_MENU_DAYS = 7


def sales_summary(client: FoodGuardClient, store_id: int, today: date | None = None) -> dict:
    """일별 수량·매출과 최근 7일 메뉴별 수량. claude -p 폴백은 sales 도구를 부를 수 없고,
    원본 판매 행은 메뉴 × 일수라 MAX_ITEMS 에 잘린다 (2026-11-13 평가: '어제 매출'·'많이 팔린 메뉴'에 답하지 못함).
    매출은 서버 주간 합계와 같은 산식(수량 × 현재 메뉴 가격)이다."""
    today = today or date.today()
    start = today - timedelta(days=SALES_SUMMARY_DAYS)
    rows = client.get(f"/api/sales/{store_id}/range?start={start}&end={today}")
    if not isinstance(rows, list):
        return rows if isinstance(rows, dict) else {"error": "unavailable"}
    daily: dict[str, dict] = {}
    menus: dict[str, int] = {}
    recent_from = (today - timedelta(days=TOP_MENU_DAYS)).isoformat()
    for s in rows:
        d, menu = str(s.get("saleDate")), s.get("menu") or {}
        qty = int(s.get("quantity") or 0)
        day = daily.setdefault(d, {"date": d, "qty": 0, "revenue": 0})
        day["qty"] += qty
        day["revenue"] += qty * int(menu.get("price") or 0)
        if recent_from <= d < today.isoformat():
            menus[menu.get("menuName") or str(menu.get("id"))] = menus.get(menu.get("menuName") or str(menu.get("id")), 0) + qty
    return {
        "today": today.isoformat(), "period": f"{start}~{today}",
        "daily": [daily[k] for k in sorted(daily)],
        "menuQtyLast7Days": {"period": f"{recent_from}~{today - timedelta(days=1)}",
                             "items": sorted(({"menuName": k, "qty": v} for k, v in menus.items()), key=lambda x: -x["qty"])},
        "note": "매출 = 수량 × 현재 메뉴 가격. 판매가 없는 날은 목록에 없다.",
    }


def prefetch_context(client: FoodGuardClient, role: str | None, store_id: int | None) -> dict:
    """권한 밖 조회는 forbidden 결과가 그대로 들어간다."""
    if store_id is not None:
        ctx = {name: run_command(client, name, {"store_id": store_id}) for name in OWNER_CONTEXT}
        ctx["salesSummary"] = sales_summary(client, store_id)
        return ctx
    return {name: run_command(client, name, {}) for name in HQ_CONTEXT} if role == "HQ_ADMIN" else {}


def build_input(question: str, history: list[dict], role: str | None, store_id: int | None,
                context: dict | None = None) -> str:
    parts = [f"질문한 사람: 역할 {role}, " + (f"현재 매장 {store_id}" if store_id is not None else "지정된 매장 없음")]
    if context is not None:
        parts.append("조회 도구를 쓸 수 없습니다. 아래 조회 결과만 근거로 답하고, 여기에 없는 것은 확인할 수 없다고 답하세요.\n"
                     "<조회결과>\n" + to_text(context) + "\n</조회결과>")
    recent = history[-MAX_HISTORY_TURNS:]
    if recent:
        parts.append("이전 대화:\n" + "\n".join(f"{t['role']}: {t['content']}" for t in recent))
    parts.append(f"질문: {question}")
    return "\n\n".join(parts)


def chat(user_token: str, question: str, history: list[dict] | None = None, store_id: int | None = None,
         run_id: str | None = None) -> dict:
    client = FoodGuardClient(user_token)
    role = _role(user_token)
    model = os.getenv("AGENT_MODEL_CHAT") or DEFAULT_MODEL
    log = RunLog(_log_client(), NAME, store_id, "CHAT", run_id)
    log.start(model)

    context = None if loop.has_api_credentials() else prefetch_context(client, role, store_id)
    try:
        llm = loop.run_agent(PROMPT, build_input(question, history or [], role, store_id, context),
                             build_tools(CHAT_TOOLS), OUTPUT_SCHEMA, model, client)
    except loop.AgentError as e:
        log.finish("FAILED", {"question": question}, error=str(e))
        raise

    if context is None:
        calls = llm["toolCalls"]
    else:
        calls = [{"tool": name, "error": r.get("error") if isinstance(r, dict) else None} for name, r in context.items()]
    sources = sorted({c["tool"] for c in calls if not c.get("error")})
    denied = any(c.get("error") == "forbidden" for c in calls)
    # 질문·조회·토큰 수만 남긴다. 답변 전문과 사용자 토큰은 저장하지 않는다
    log.finish("OK", {"question": question, "toolCalls": calls}, model=llm["model"], usage=llm["usage"])
    out = llm["output"]
    return {
        "runId": log.run_id, "answer": out["answer"], "sources": sources, "denied": denied, "engine": llm["engine"],
        # 발주안은 자기 매장이 있는 점주만 만들 수 있다
        "action": "order_plan" if out["action"] == "order_plan" and store_id is not None and role == "OWNER" else "none",
    }
