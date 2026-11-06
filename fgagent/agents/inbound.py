"""입고 추적 에이전트 (AG-7): 매시 진행 중 발주의 지연을 찾아 본사·점주에게 알린다.

규칙과 문구가 전부 결정적이라 LLM 을 쓰지 않는다. 모든 에이전트에 LLM 이 필요한 것은 아니다.
직접 쓰기는 알림뿐이고 (§4.3), 같은 문구는 서버가 24시간 안에 다시 만들지 않는다.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

from fgagent.agents.schema import COMMON_OUTPUT_SCHEMA
from fgcli.planner import ObserveError, _get, build_plan, observe as observe_store

NAME = "inbound"
DEFAULT_MODEL = "claude-haiku-5-5"   # needs_llm 이 항상 False 라 호출되지 않는다
ALLOWED_TOOLS: list[str] = []
PROMPT = ""
OUTPUT_SCHEMA = COMMON_OUTPUT_SCHEMA

SLA_REQUESTED_H = int(os.getenv("INBOUND_SLA_REQUESTED_HOURS", "24"))
SLA_SHIPPING_H = int(os.getenv("INBOUND_SLA_SHIPPING_HOURS", "48"))
SLA_DELIVERY_H = int(os.getenv("INBOUND_SLA_DELIVERY_HOURS", "12"))
TOKEN_VALID_H = 48          # 배달 토큰은 승인 후 48시간 (DeliveryController)
TOKEN_WARN_H = 12
STOCKOUT_RISKS = ("stockout", "below_threshold", "awaiting_delivery")
MAX_NAMES = 3
MAX_IDS = 5

KIND_LABEL = {"approval": "승인 지연", "shipping": "출고 지연", "delivery": "배송 미완료"}
AUDIENCE = {"approval": ("HQ",), "shipping": ("HQ", "OWNER"), "delivery": ("OWNER",)}
HQ_ACTION = {"approval": "발주 관리에서 처리하세요.", "shipping": "발송 상태를 확인하세요."}
OWNER_ACTION = {"shipping": "본사에 확인하세요.", "delivery": "도착했으면 검수 완료 처리하세요."}


def _at(value) -> datetime | None:
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def classify(order: dict, now: datetime) -> dict | None:
    """발주 1건의 지연 판정. 시각이 비어 있으면 그 앞 단계 시각으로 본다 (실제보다 일찍 알릴 수는 있어도 놓치지 않게)."""
    status = order["status"]
    ordered, approved, updated = _at(order.get("orderedAt")), _at(order.get("approvedAt")), _at(order.get("updatedAt"))
    if status == "REQUESTED":
        kind, since, sla = "approval", ordered, SLA_REQUESTED_H
    elif status in ("APPROVED", "HQ_SENT"):
        kind, since, sla = "shipping", approved or ordered, SLA_SHIPPING_H
    elif status == "DRIVER_RECEIVED":
        kind, since, sla = "delivery", updated or approved or ordered, SLA_DELIVERY_H
    else:
        return None
    if since is None or now - since <= timedelta(hours=sla):
        return None
    delay = {"orderId": order["id"], "kind": kind, "status": status, "storeName": (order.get("store") or {}).get("storeName"),
             "ingredientId": order["ingredient"]["id"], "ingredientName": order["ingredient"]["name"]}
    if kind == "delivery" and approved:
        left = approved + timedelta(hours=TOKEN_VALID_H) - now
        delay["token"] = "expired" if left <= timedelta(0) else "expiring" if left <= timedelta(hours=TOKEN_WARN_H) else "valid"
    return delay


def find_delays(orders: list[dict], now: datetime) -> list[dict]:
    return [d for o in orders if (d := classify(o, now))]


def observe(client, store_id: int) -> dict:
    now = datetime.now()
    orders = _get(client, f"/api/orders/{store_id}")
    risky, risk_available = [], True
    if find_delays(orders, now):
        try:
            risky = [r["ingredientId"] for r in build_plan(observe_store(client, store_id))["risks"]
                     if r["risk"] in STOCKOUT_RISKS]
        except ObserveError:
            risk_available = False  # 지연 알림은 위험 판단 없이도 보낸다
    return {"storeId": store_id, "now": now.isoformat(), "orders": orders, "riskyIngredients": risky, "riskAvailable": risk_available}


def decide(obs: dict) -> dict:
    delays = find_delays(obs["orders"], datetime.fromisoformat(obs["now"]))
    for d in delays:
        d["severity"] = "high" if d["ingredientId"] in obs["riskyIngredients"] else "medium"
    return {"delays": delays, "riskAvailable": obs["riskAvailable"]}


def needs_llm(decision: dict) -> bool:
    return False


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    return []  # 데이터를 바꾸지 않는다. 알림만 보낸다


def _message(kind: str, rows: list[dict], audience: str) -> str:
    """시간 수처럼 매시 바뀌는 값을 넣지 않는다. 지연 목록이 그대로면 문구도 같아야 서버가 중복을 거른다."""
    rows = sorted(rows, key=lambda d: d["orderId"])
    names = ", ".join(d["ingredientName"] for d in rows[:MAX_NAMES]) + (f" 외 {len(rows) - MAX_NAMES}건" if len(rows) > MAX_NAMES else "")
    ids = ",".join(f"#{d['orderId']}" for d in rows[:MAX_IDS]) + ("…" if len(rows) > MAX_IDS else "")
    urgent = "[품절 위험] " if any(d["severity"] == "high" for d in rows) else ""
    if audience == "HQ":
        return f"[입고 추적] {urgent}{rows[0]['storeName']} {KIND_LABEL[kind]} {len(rows)}건: {names} ({ids}). {HQ_ACTION[kind]}"
    tail = OWNER_ACTION[kind]
    tokens = {d.get("token") for d in rows}
    if "expired" in tokens:
        tail += " 기사 링크가 만료된 건이 있어 점주 검수로 완료해야 합니다."
    elif "expiring" in tokens:
        tail += " 기사 링크가 곧 만료됩니다."
    return f"[입고 추적] {urgent}{KIND_LABEL[kind]} {len(rows)}건: {names} ({ids}). {tail}"


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    """종류·수신자별로 묶는다. 발주마다 보내면 쌓여 있던 지연이 첫 실행에 수십 건으로 쏟아진다."""
    out = []
    for kind in KIND_LABEL:
        rows = [d for d in decision["delays"] if d["kind"] == kind]
        if rows:
            out += [{"type": "ORDER", "audience": a, "message": _message(kind, rows, a)} for a in AUDIENCE[kind]]
    return out


def delay_key(orders: list[dict], now: datetime) -> frozenset:
    """지연 상태 비교용 (같으면 다시 실행할 필요가 없다)."""
    return frozenset((d["orderId"], d["kind"], d.get("token")) for d in find_delays(orders, now))
