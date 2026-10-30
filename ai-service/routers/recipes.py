"""
레시피 입력 보조: 메뉴명 → 이 매장 식자재 중 들어갈 것과 메뉴 1개당 사용량 초안.
저장하지 않는다. 점주가 확인·수정한 항목만 백엔드 기존 등록 API(/api/menu-ingredients)로 저장한다.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_cli import ClaudeCliError, run_structured

router = APIRouter()

MISSING_UNITS = ["g", "ml", "개"]

SYSTEM_PROMPT = """너는 음식점 점주가 메뉴 레시피(메뉴 1개에 들어가는 식자재와 사용량)를 입력하는 것을 돕는다.
입력은 메뉴명·분류와 이 매장에 등록된 식자재 목록(ingredientId, name, unit)이다. 이미 연결된 식자재 이름은 linked 에 있다.
- items: 식자재 목록 중 이 메뉴 1개(1인분)에 들어가는 것만 골라 ingredientId 와 qtyPerUnit(그 식자재 unit 기준 숫자)을 적는다.
  일반적인 한국 음식점 1인분 기준으로 추정하고, 들어가는지 확실하지 않은 식자재는 넣지 않는다
- missing: 이 메뉴의 주재료인데 식자재 목록에도 linked 에도 없는 것만 name, qtyPerUnit, unit(g·ml·개)으로 적는다. 양념·물 같은 소량 재료는 뺀다
- reason 은 항목마다 짧은 한 구절 (예: "밥 한 공기")
- 점주가 확인한 뒤 저장하므로 지어내지 말고, 모르면 비워 둔다"""

SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "ingredientId": {"type": "integer"},
                    "qtyPerUnit": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["ingredientId", "qtyPerUnit", "reason"],
                "additionalProperties": False,
            },
        },
        "missing": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "qtyPerUnit": {"type": "number"},
                    "unit": {"type": "string", "enum": MISSING_UNITS},
                },
                "required": ["name", "qtyPerUnit", "unit"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["items", "missing"],
    "additionalProperties": False,
}


class Candidate(BaseModel):
    ingredientId: int
    name: str
    unit: str  # 레시피 단위 (kg→g, L→ml, 그 외 개). 백엔드 UnitUtils.toRecipeUnit


class RecipeDraftRequest(BaseModel):
    menuName: str
    category: Optional[str] = None
    ingredients: list[Candidate]
    linked: list[str] = []


@router.post("/draft")
def draft_recipe(req: RecipeDraftRequest):
    if not req.menuName.strip():
        raise HTTPException(status_code=400, detail="메뉴명이 비어 있습니다.")
    try:
        result = run_structured(SYSTEM_PROMPT, req.model_dump_json(), SCHEMA)
    except ClaudeCliError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # 목록에 없는 식자재·중복·0 이하는 버린다. qty_per_unit 은 소수 둘째 자리까지 저장된다
    known = {c.ingredientId for c in req.ingredients}
    items, seen = [], set()
    for i in result.get("items", []):
        iid, qty = i.get("ingredientId"), float(i.get("qtyPerUnit", 0))
        if iid in known and iid not in seen and qty > 0:
            seen.add(iid)
            items.append({"ingredientId": iid, "qtyPerUnit": round(qty, 2), "reason": i.get("reason", "")})
    missing = [m for m in result.get("missing", [])
               if m.get("unit") in MISSING_UNITS and float(m.get("qtyPerUnit", 0)) > 0]
    return {"items": items, "missing": missing}
