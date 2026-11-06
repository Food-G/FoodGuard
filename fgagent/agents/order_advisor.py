"""발주 참모 (AG-1): 매일 08:00 발주안을 만들어 웹 승인함에 올린다.

수량은 fgcli/planner.py(서버 /recommend 와 같은 산식)가 정하고, LLM 은 줄이거나 보류하자는
검토만 한다 (advisor.apply_review — 늘리는 제안은 무시). 승인 시 Spring 이 같은 planner 로
fingerprint(planId)를 다시 계산해 다르면 STALE 로 멈춘다.
"""

from __future__ import annotations

from datetime import date

from fgagent import advisor, executor
from fgcli.planner import _get, build_plan, observe as observe_store

NAME = "order_advisor"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["predictions", "recipe", "inventory", "orders", "sales", "weekly"]
PROMPT = advisor.PROMPT
OUTPUT_SCHEMA = advisor.SCHEMA


def waste_hints(client, store_id: int, today: date | None = None) -> dict[int, float]:
    """점주가 승인한 폐기 위험 감축 힌트 중 아직 유효한 것. 매일 다시 계산되는 값이라 합산하지 않고 최댓값을 쓴다."""
    today = today or date.today()
    hints: dict[int, float] = {}
    for p in _get(client, f"/api/agent/proposals?storeId={store_id}&status=EXECUTED&type=ORDER_REDUCE"):
        if p["payload"]["validUntil"] >= today.isoformat():
            for it in p["payload"]["items"]:
                hints[it["ingredientId"]] = max(hints.get(it["ingredientId"], 0.0), it["reduceQty"])
    return hints


def plan_for(client, store_id: int) -> dict:
    return build_plan(observe_store(client, store_id), waste_hints=waste_hints(client, store_id))


def refresh_if_stale(client: executor.WriteClient, store_id: int, plan: dict) -> tuple[dict, dict | None]:
    """예측이 없거나 오래됐으면 재예측(에이전트 직접 쓰기 허용, 매장당 하루 3회) 후 다시 계획한다."""
    if plan["prediction"]["freshness"] == "fresh":
        return plan, None
    ok, msg = executor.trigger_prediction(client, store_id)
    return (plan_for(client, store_id) if ok else plan), {"ok": ok, "message": msg}


def observe(client: executor.WriteClient, store_id: int) -> dict:
    plan, trigger = refresh_if_stale(client, store_id, plan_for(client, store_id))
    return {"plan": plan, "trigger": trigger}


def decide(obs: dict) -> dict:
    # 결정적 판단은 planner 가 이미 끝냈다 (발주량·위험·경고·서버 대조)
    return obs


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    plan = decision["plan"]
    if not plan["items"] or (llm and llm["recommendation"] == "wait"):
        return []
    approved = advisor.apply_review(plan["items"], llm) if llm else plan["items"]
    if not approved:
        return []
    verdicts = {r["ingredientId"]: r for r in (llm or {}).get("items", [])}
    planned = {i["ingredientId"]: i["orderQty"] for i in plan["items"]}
    items = [{
        "ingredientId": it["ingredientId"], "ingredientName": it["ingredientName"], "unit": it["unit"],
        "requiredQty": it["requiredQty"], "currentStock": it["currentStock"], "pendingQty": it["pendingQty"],
        "planQty": planned[it["ingredientId"]], "orderQty": it["orderQty"],
        "verdict": verdicts.get(it["ingredientId"], {}).get("verdict", "approve"),
        "reason": verdicts.get(it["ingredientId"], {}).get("reason", it["reason"]),
    } for it in approved]
    held = [i["ingredientName"] for i in plan["items"] if i["ingredientId"] not in {a["ingredientId"] for a in approved}]
    return [{
        "type": "ORDER_CREATE",
        "fingerprint": plan["planId"],
        "payload": {
            "planId": plan["planId"],
            "asOf": plan["asOf"],
            "items": items,
            "held": held,
            "risks": [{"risk": r["risk"], "ingredientName": r["ingredientName"]} for r in plan["risks"]],
            "warnings": [w["message"] for w in plan["warnings"]],
            "concerns": (llm or {}).get("concerns", []),
            "recommendation": (llm or {}).get("recommendation"),
        },
        "rationale": llm["summary"] if llm else
        f"발주안 {len(items)}건 (planner 산식, Claude 검토 없음). 위험 {len(plan['risks'])}건, 경고 {len(plan['warnings'])}건.",
    }]


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    """발주 보류 권고는 제안 대신 알림으로 남긴다 (에이전트 직접 쓰기 허용, 24h 중복 금지)."""
    if llm and llm["recommendation"] == "wait" and (decision["plan"]["items"] or decision["plan"]["risks"]):
        # 문구를 고정해야 24h 중복 금지가 동작한다 (이유는 실행 기록의 LLM 요약에 있다)
        return [{"type": "ORDER", "message": f"[발주 참모] {decision['plan']['asOf']} 발주 보류를 권합니다. "
                                             "AI 승인함 실행 기록에서 이유를 확인하세요."}]
    return []
