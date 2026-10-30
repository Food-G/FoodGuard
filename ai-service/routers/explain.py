"""발주 추천 근거 설명 — 숫자는 백엔드 recommend() 가 정하고, 여기서는 그 근거를 문장으로만 쓴다."""

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_cli import ClaudeCliError, run_structured

router = APIRouter()

SYSTEM_PROMPT = """너는 프랜차이즈 가맹점 점주에게 AI 추천 발주량의 근거를 설명한다.
입력은 식자재별 추천 발주 계산 데이터(JSON)다. 계산은 이미 끝났고 너는 설명만 한다.
- 입력에 있는 숫자만 쓰고, 숫자를 새로 계산하거나 바꾸거나 다른 발주량을 권하지 않는다
- 식자재마다 한두 문장, 존댓말로: 어떤 메뉴 수요 때문에 필요한지, 며칠분을 책임지는지(보관기한·입고 주기 때문에 줄었다면 그 이유),
  현재 재고·진행 중 발주를 뺀 결과인지, 안전재고가 얼마나 더해졌는지(recommendedQty 와 pointQty 차이) 중 중요한 것만
- summary 는 이번 발주 전체를 두세 문장으로: 가장 큰 항목과 주의할 점(보관기한이 짧은 식자재 등)
- 입력에 없는 사실(날씨, 이벤트 등)은 지어내지 않는다"""

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ingredientId": {"type": "integer"},
                    "explanation": {"type": "string"},
                },
                "required": ["ingredientId", "explanation"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "items"],
    "additionalProperties": False,
}


class ExplainOrderRequest(BaseModel):
    storeName: Optional[str] = None
    items: list[dict[str, Any]]


@router.post("/order")
def explain_order(req: ExplainOrderRequest):
    if not req.items:
        return {"summary": "지금은 발주가 필요한 식자재가 없습니다.", "items": []}
    user_input = json.dumps({"storeName": req.storeName, "items": req.items}, ensure_ascii=False)
    try:
        result = run_structured(SYSTEM_PROMPT, user_input, SCHEMA)
    except ClaudeCliError as e:
        raise HTTPException(status_code=503, detail=str(e))
    # 입력에 없는 식자재 설명은 버린다
    known = {item.get("ingredientId") for item in req.items}
    result["items"] = [i for i in result.get("items", []) if i.get("ingredientId") in known]
    return result
