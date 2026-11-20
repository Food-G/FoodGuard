"""본사 발주 심사 에이전트 (AG-4): 승인 대기 발주마다 이상점수를 매겨 본사 발주 목록에 표시한다.

점수와 권고는 결정적 산식이 정하고, LLM 은 근거를 관리자용으로 설명만 한다. 승인·거절은 관리자가 기존 버튼으로 한다.
결과는 승인함이 아니라 AdminOrders 화면에 병합된다 (ORDER_FLAG 제안, 실행할 동작 없음).

트리거는 5분 폴링이다 (runtime/scheduler). 자동 발주는 한 번에 여러 건을 만들어 이벤트 방식이면 건마다 실행되고,
agent-service 가 꺼져 있는 동안 생긴 발주를 놓친다. 폴링은 매장별로 묶어 처리하고 놓친 발주도 다음에 잡는다.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

from fgcli.planner import _get, build_plan, observe as observe_store

NAME = "hq_review"
DEFAULT_MODEL = "claude-opus-5-5"
ALLOWED_TOOLS = ["orders", "predictions", "inventory", "recipe"]
PROMPT = (Path(__file__).parent.parent / "hq_review.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "결론 먼저, 2~3문장"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"orderId": {"type": "integer"},
                               "explanation": {"type": "string", "description": "관리자용 2~3문장"}},
                "required": ["orderId", "explanation"],
                "additionalProperties": False,
            },
        },
        "concerns": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "items", "concerns"],
    "additionalProperties": False,
}

REJECT_SCORE = 60
REVIEW_SCORE = 30
HISTORY_DAYS = 28
DUP_HOURS = 24
HORIZON_DAYS = 7
PENDING_STATUSES = ("REQUESTED", "APPROVED")
EXCLUDED_FROM_HISTORY = ("CANCELLED", "REJECTED")


def fetch_flags(client, store_id: int) -> list[dict]:
    return [p for p in _get(client, f"/api/agent/proposals?storeId={store_id}&type=ORDER_FLAG") if p["agent"] == NAME]


def unreviewed(orders: list[dict], flags: list[dict]) -> list[dict]:
    """아직 심사하지 않은 승인 대기 발주. 만료된 제안도 심사한 것으로 친다 (결과를 화면에 계속 쓴다)."""
    done = {p["payload"]["orderId"] for p in flags}
    return [o for o in orders if o["status"] == "REQUESTED" and o["id"] not in done]


def observe(client, store_id: int) -> dict:
    orders = _get(client, f"/api/orders/{store_id}")
    targets = unreviewed(orders, fetch_flags(client, store_id))
    if not targets:
        return {"storeId": store_id, "targets": [], "orders": orders}

    store_obs = observe_store(client, store_id)
    plan = build_plan(store_obs)
    waste = client.get(f"/api/waste-prediction/{store_id}")
    return {
        "storeId": store_id, "targets": targets, "orders": orders,
        "stock": {i["ingredientId"]: i["currentQty"] for i in store_obs["inventory"]},
        "requiredByIngredient": plan["requiredByIngredient"], "predictionDays": plan["prediction"]["days"],
        # 004 적용 전이면 폐기 예측이 없다. 이 항목만 빼고 심사한다
        "wasteHigh": [r["ingredientId"] for r in waste if r["riskLevel"] == "HIGH"] if isinstance(waste, list) else [],
        "wasteAvailable": isinstance(waste, list),
    }


def _ordered_at(o: dict) -> datetime | None:
    try:
        return datetime.fromisoformat(str(o.get("orderedAt")))
    except ValueError:
        return None


def score_order(order: dict, obs: dict) -> dict:
    """이상점수 0~100. 점수는 휴리스틱이며 확률이 아니다 (R6). 계산할 근거가 없는 항목은 점수를 주지 않는다."""
    iid = order["ingredient"]["id"]
    qty = float(order["orderedQty"])
    unit = order["ingredient"].get("unit") or ""
    flags: list[dict] = []
    at = _ordered_at(order)
    others = [o for o in obs["orders"] if o["ingredient"]["id"] == iid and o["id"] != order["id"]]

    days = obs["predictionDays"]
    required = obs["requiredByIngredient"].get(iid, 0.0) / days * HORIZON_DAYS if days else None
    if required is not None:
        if required <= 0:
            flags.append({"code": "no_demand", "points": 45, "detail": f"예측 기간 소요량이 없는데 {qty}{unit}를 발주했습니다."})
        else:
            ratio = qty / required
            if ratio > 2:
                flags.append({"code": "ratio_plan", "points": 45, "detail": f"발주량이 7일 소요량({required:.1f}{unit})의 {ratio:.1f}배입니다."})
            elif ratio > 1.5:
                flags.append({"code": "ratio_plan", "points": 30, "detail": f"발주량이 7일 소요량({required:.1f}{unit})의 {ratio:.1f}배입니다."})

    if at:
        since = at - timedelta(days=HISTORY_DAYS)
        past = [float(o["orderedQty"]) for o in others if o["status"] not in EXCLUDED_FROM_HISTORY
                and (t := _ordered_at(o)) and since <= t < at]
        if past and qty / (sum(past) / len(past)) > 2:
            flags.append({"code": "ratio_hist", "points": 25,
                          "detail": f"최근 4주 평균 발주량({sum(past) / len(past):.1f}{unit})의 {qty / (sum(past) / len(past)):.1f}배입니다."})

    if required:
        # 심사 중인 발주 자신은 뺀다. 포함하면 정상 발주도 자기 수량 때문에 재고 충분으로 잡힌다
        pending = sum(float(o["orderedQty"]) for o in others if o["status"] in PENDING_STATUSES)
        cover = (obs["stock"].get(iid, 0.0) + pending) / required
        if cover > 1.2:
            flags.append({"code": "stock_cover", "points": 20,
                          "detail": f"이 발주 없이도 재고와 대기발주로 7일 소요량의 {cover:.1f}배가 있습니다."})

    if at and any(o["status"] == "REQUESTED" and (t := _ordered_at(o)) and abs(t - at) <= timedelta(hours=DUP_HOURS)
                  for o in others):
        flags.append({"code": "duplicate", "points": 15, "detail": f"{DUP_HOURS}시간 안에 같은 식자재의 승인 대기 발주가 또 있습니다."})

    if iid in obs["wasteHigh"]:
        flags.append({"code": "waste_link", "points": 15, "detail": "폐기 위험이 높은 식자재입니다."})

    score = min(100, sum(f["points"] for f in flags))
    return {"orderId": order["id"], "ingredientId": iid, "ingredientName": order["ingredient"].get("name"),
            "unit": unit, "orderedQty": qty, "score": score, "flags": flags,
            "recommendation": "reject" if score >= REJECT_SCORE else "review" if score >= REVIEW_SCORE else "approve"}


def decide(obs: dict) -> dict:
    warnings = []
    if not obs["targets"]:
        return {"reviews": [], "warnings": warnings}
    if not obs["wasteAvailable"]:
        warnings.append("폐기 예측을 조회하지 못해 폐기 위험 항목은 점수에 넣지 않았습니다.")
    if not obs["predictionDays"]:
        warnings.append("예측이 없어 소요량 대비 항목은 점수에 넣지 않았습니다.")
    return {"reviews": [score_order(o, obs) for o in obs["targets"]], "warnings": warnings}


def needs_llm(decision: dict) -> bool:
    """전부 승인 권고면 설명할 것이 없다."""
    return any(r["recommendation"] != "approve" for r in decision["reviews"])


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    explanations = {i["orderId"]: i["explanation"] for i in (llm or {}).get("items", [])}
    return [{
        "type": "ORDER_FLAG",
        "payload": {**r, "warnings": decision["warnings"]},
        # 점수·권고는 산식 그대로이고, 설명이 없으면 산식 근거를 그대로 보여준다
        "rationale": explanations.get(r["orderId"]) or " ".join(f["detail"] for f in r["flags"]) or "이상 신호가 없습니다.",
    } for r in decision["reviews"]]
