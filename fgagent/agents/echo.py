"""더미 에이전트 (AG-0.4): 런타임 한 바퀴 검증용.

재고 조회 → 임계치 미만 식자재 n개 요약 → ORDER_FLAG 제안 1건 (승인해도 아무것도 바꾸지 않는다).
"""

from __future__ import annotations

from fgagent.agents.schema import COMMON_OUTPUT_SCHEMA
from fgcli.__main__ import trim_inventory
from fgcli.client import FoodGuardClient

NAME = "echo"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["inventory"]
OUTPUT_SCHEMA = COMMON_OUTPUT_SCHEMA
PROMPT = """당신은 FoodGuard 매장의 재고 점검 보조입니다.
입력의 decision 은 결정적 코드가 계산한 결과입니다. 숫자와 품목을 바꾸지 말고, 점주가 읽을 한국어로
무엇이 부족한지와 먼저 확인할 품목을 요약하세요. 필요하면 inventory 도구로 재고를 다시 볼 수 있습니다.
도구가 forbidden 을 돌려주면 우회하지 말고 concerns 에 그대로 적으세요."""


def observe(client: FoodGuardClient, store_id: int) -> dict:
    inv = client.get(f"/api/inventory/{store_id}")
    if not isinstance(inv, list):
        raise RuntimeError(f"재고 조회 실패: {inv}")
    return {"inventory": [trim_inventory(i) for i in inv]}


def decide(obs: dict) -> dict:
    low = [i for i in obs["inventory"] if i["belowThreshold"]]
    return {"inventoryCount": len(obs["inventory"]), "lowStockCount": len(low), "lowStock": low}


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    if not decision["lowStockCount"]:
        return []
    summary = llm["summary"] if llm else f"임계치 미만 식자재 {decision['lowStockCount']}개가 있습니다."
    return [{
        "type": "ORDER_FLAG",
        "payload": {
            "lowStockCount": decision["lowStockCount"],
            "items": [{"ingredientId": i["ingredientId"], "ingredientName": i["ingredientName"],
                       "currentQty": i["currentQty"], "minThreshold": i["minThreshold"], "unit": i["unit"]}
                      for i in decision["lowStock"]],
        },
        "rationale": summary,
    }]
