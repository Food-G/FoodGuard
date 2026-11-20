"""기부 매칭 에이전트 (AG-3): 폐기 위험 에이전트가 기부 후보를 내면 이어서 실행된다.

후보와 수량은 AG-2 산출값을 그대로 쓰고, 기관 후보는 서버가 지역·카테고리로 거른다.
LLM 은 후보 중 추천 1곳과 요청 메시지 초안만 쓴다. 메시지는 점주가 직접 보낸다 (외부 발송 없음).
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from fgagent.agents import waste_guard
from fgcli.planner import _get

NAME = "donation"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["waste", "lots", "inventory"]
PROMPT = (Path(__file__).parent.parent / "donation_matcher.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "3~5문장, 결론 먼저"},
        "matches": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ingredientId": {"type": "integer"},
                    "orgId": {"type": "integer"},
                    "reason": {"type": "string"},
                    "draftMessage": {"type": "string"},
                },
                "required": ["ingredientId", "orgId", "reason", "draftMessage"],
                "additionalProperties": False,
            },
        },
        "concerns": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "matches", "concerns"],
    "additionalProperties": False,
}

MIN_DAYS_LEFT = 1
# 상온 보관이 확실한 카테고리만 뺀다. 나머지는 콜드체인 확인을 강제한다 (식품 안전, LLM 과 무관하게 코드가 붙인다).
AMBIENT_CATEGORIES = {"빵류"}
COLD_CHAIN_CONCERN = "냉장·냉동 식자재일 수 있습니다. 운반 중 온도(콜드체인) 유지가 가능한지 기관과 확인하세요."


def observe(client, store_id: int) -> dict:
    candidates = waste_guard.decide(waste_guard.observe(client, store_id))["donationCandidates"]
    pending = _get(client, f"/api/agent/proposals?storeId={store_id}&status=PENDING&type=DONATION_CREATE")
    planned = [d for d in _get(client, f"/api/donations/store/{store_id}") if d["status"] == "PLANNED"]
    orgs = {}
    for c in candidates:
        if c["category"] not in orgs:
            orgs[c["category"]] = _get(client, f"/api/donation-orgs?storeId={store_id}&category={quote(c['category'])}")
    return {
        "storeId": store_id,
        "candidates": candidates,
        "orgsByCategory": orgs,
        "busyIngredientIds": sorted({p["payload"]["ingredientId"] for p in pending}
                                    | {d["ingredientId"] for d in planned}),
    }


def decide(obs: dict) -> dict:
    matches, unmatched = [], []
    for c in obs["candidates"]:
        # 이미 제안했거나 기부 예정인 식자재는 매일 다시 제안하지 않는다
        if c["ingredientId"] in obs["busyIngredientIds"] or c["daysUntilExpiry"] < MIN_DAYS_LEFT:
            continue
        orgs = [{"orgId": o["id"], "orgName": o["orgName"], "orgType": o["orgType"], "region": o["region"]}
                for o in obs["orgsByCategory"].get(c["category"], [])]
        if not orgs:
            unmatched.append(c["ingredientName"])
            continue
        matches.append({**c, "orgs": orgs,
                        "concerns": [] if c["category"] in AMBIENT_CATEGORIES else [COLD_CHAIN_CONCERN]})
    return {"matches": matches, "unmatched": unmatched}


def _draft(m: dict, org: dict) -> str:
    return (f"안녕하세요, {org['orgName']} 담당자님. 저희 매장에서 {m['ingredientName']} {m['quantity']}{m['unit']}를 "
            f"기부하려고 합니다. 유통기한은 {m['daysUntilExpiry']}일 남았습니다. 수령 가능 여부와 일정을 알려 주시면 감사하겠습니다.")


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    verdicts = {v["ingredientId"]: v for v in (llm or {}).get("matches", [])}
    proposals = []
    for m in decision["matches"]:
        v = verdicts.get(m["ingredientId"], {})
        # LLM 은 후보 안에서만 고를 수 있다. 목록에 없는 기관을 말하면 첫 후보로 돌아간다
        org = next((o for o in m["orgs"] if o["orgId"] == v.get("orgId")), m["orgs"][0])
        chosen = v.get("orgId") == org["orgId"]
        proposals.append({
            "type": "DONATION_CREATE",
            "payload": {
                "ingredientId": m["ingredientId"], "ingredientName": m["ingredientName"], "unit": m["unit"],
                "quantity": m["quantity"], "daysUntilExpiry": m["daysUntilExpiry"],
                "orgId": org["orgId"], "orgName": org["orgName"], "orgType": org["orgType"],
                "donationType": "INGREDIENT",
                "concerns": m["concerns"] + (llm or {}).get("concerns", []),
                "draftMessage": (v.get("draftMessage") if chosen else None) or _draft(m, org),
            },
            "rationale": (v["reason"] if chosen else
                          f"{m['ingredientName']} {m['quantity']}{m['unit']}를 같은 지역의 {org['orgName']}에 기부하는 안입니다."),
        })
    return proposals
