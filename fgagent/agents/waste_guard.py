"""폐기 위험 에이전트 (AG-2): 매일 09:00 버려질 식자재의 대응 후보를 승인함에 올린다.

폐기량은 Spring WastePredictionService(화면과 같은 산식)가, 대응 후보는 여기 decide 가 정한다.
LLM 은 무엇을 먼저 할지 설명만 한다.

기부는 후보만 decision 에 남긴다 — 실행은 AG-3(DONATION_CREATE) 에서 붙인다.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from fgagent.agents.schema import COMMON_OUTPUT_SCHEMA
from fgcli.planner import UNIT_RULES, _get

NAME = "waste"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["inventory", "predictions", "recipe", "sales", "weekly", "waste", "txns"]
PROMPT = (Path(__file__).parent.parent / "waste_guard.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = COMMON_OUTPUT_SCHEMA

RISKY = ("HIGH", "MEDIUM")
TOP_MENUS = 2
DONATION_RATIO = 0.8
RECENT_SALES_DAYS = 7
# 기부 가능 카테고리 (허용 목록). 카테고리가 비어 있거나 육류·수산물처럼 목록에 없으면 기부 후보에서 뺀다 (식품 안전).
DONATABLE_CATEGORIES = {"채소류", "빵류", "유제품"}


def observe(client, store_id: int) -> dict:
    today = date.today()
    rows = _get(client, f"/api/waste-prediction/{store_id}")
    menus = _get(client, f"/api/menus/{store_id}")
    start = today - timedelta(days=RECENT_SALES_DAYS)
    sales = _get(client, f"/api/sales/{store_id}/range?start={start}&end={today}")
    predictions = _get(client, f"/api/predictions/{store_id}")

    menu_qty: dict[int, float] = {}
    # 예측이 있으면 앞으로의 수량, 없으면 최근 판매량으로 메뉴 사용량을 잰다
    for p in predictions:
        menu_qty[p["menuId"]] = menu_qty.get(p["menuId"], 0) + p["predictedQty"]
    if not menu_qty:
        for s in sales:
            menu_qty[s["menu"]["id"]] = menu_qty.get(s["menu"]["id"], 0) + s["quantity"]

    recipes = {}
    if any(r["riskLevel"] in RISKY for r in rows):
        recipes = {m["id"]: _get(client, f"/api/menu-ingredients/menu/{m['id']}") for m in menus}
    return {
        "storeId": store_id,
        "asOf": today.isoformat(),
        "rows": rows,
        "summary": _get(client, f"/api/waste-prediction/{store_id}/summary"),
        "menus": [{"id": m["id"], "menuName": m.get("menuName")} for m in menus],
        "recipes": recipes,
        "menuQty": menu_qty,
    }


def _top_menus(obs: dict, ingredient_id: int) -> list[str]:
    """그 식자재를 기준 단위로 가장 많이 쓰는 메뉴 (앞으로의 수량 × 레시피)."""
    usage = []
    for m in obs["menus"]:
        for r in obs["recipes"].get(m["id"], []):
            ing = r["ingredient"]
            factor = UNIT_RULES.get(ing["unit"], {}).get(r["unit"])
            if ing["id"] == ingredient_id and factor is not None:
                usage.append((float(r["qtyPerUnit"]) * factor * obs["menuQty"].get(m["id"], 0), m["menuName"]))
    return [name for _, name in sorted(usage, key=lambda u: u[0], reverse=True)[:TOP_MENUS]]


def decide(obs: dict) -> dict:
    discounts, reductions, donations, disposals = [], [], [], []
    for row in obs["rows"]:
        if row["riskLevel"] not in RISKY:
            continue
        base = {"ingredientId": row["ingredientId"], "ingredientName": row["ingredientName"], "unit": row["unit"]}
        expired = row["expiredQty"]
        # 이미 만료된 양은 팔거나 기부할 수 없고, 앞으로 쓸 재고도 아니므로 감축 근거에서도 뺀다
        usable_waste = round(row["wastePrediction"] - expired, 2)
        if usable_waste > 0:
            menus = _top_menus(obs, row["ingredientId"])
            if menus:
                discounts.append({**base, "wastePrediction": usable_waste, "daysUntilExpiry": row["daysUntilExpiry"],
                                  "riskLevel": row["riskLevel"], "menus": ", ".join(menus)})
            reductions.append({**base, "reduceQty": usable_waste})
            if row["daysUntilExpiry"] >= 1 and row.get("category") in DONATABLE_CATEGORIES:
                donations.append({**base, "category": row["category"], "daysUntilExpiry": row["daysUntilExpiry"],
                                  "quantity": round(usable_waste * DONATION_RATIO, 2)})
        if expired > 0:
            disposals.append({**base, "qty": expired, "reason": "EXPIRED"})
    return {
        "asOf": obs["asOf"],
        "summary": obs["summary"],
        "high": [r["ingredientName"] for r in obs["rows"] if r["riskLevel"] == "HIGH"],
        "discounts": discounts,
        "reductions": reductions,
        "donationCandidates": donations,
        "disposalCandidates": disposals,
    }


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    proposals = []
    if decision["discounts"]:
        proposals.append({
            "type": "DISCOUNT_SUGGEST",
            "payload": {"asOf": decision["asOf"], "items": decision["discounts"],
                        "concerns": (llm or {}).get("concerns", [])},
            "rationale": llm["summary"] if llm else
            f"폐기 위험 {len(decision['discounts'])}개 식자재를 많이 쓰는 메뉴입니다. 판촉·추천을 검토하세요 (Claude 검토 없음).",
        })
    if decision["reductions"]:
        valid_until = date.fromisoformat(decision["asOf"]) + timedelta(days=1)
        proposals.append({
            "type": "ORDER_REDUCE",
            "payload": {"asOf": decision["asOf"], "validUntil": valid_until.isoformat(), "items": decision["reductions"]},
            "rationale": (llm["summary"] if llm else
                          f"폐기 위험 {len(decision['reductions'])}개 식자재의 다음 발주를 줄입니다 (Claude 검토 없음).")
            + f" 승인하면 {valid_until}까지 만드는 발주안에 반영됩니다.",
        })
    if decision["disposalCandidates"]:
        proposals.append({
            "type": "WASTE_RECORD",
            "payload": {"asOf": decision["asOf"], "items": decision["disposalCandidates"]},
            "rationale": f"유통기한이 지난 {len(decision['disposalCandidates'])}개 식자재입니다. "
                         "매장에서 실제로 폐기한 뒤 승인하면 폐기 기록을 남기고 재고에서 차감합니다.",
        })
    return proposals


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    """고위험 품목 알림 (에이전트 직접 쓰기 허용). 같은 내용은 서버가 24h 안에 다시 만들지 않는다."""
    high = decision["high"]
    if not high:
        return []
    names = ", ".join(high[:3]) + (f" 외 {len(high) - 3}개" if len(high) > 3 else "")
    return [{"type": "WASTE", "message": f"[폐기 위험] {decision['asOf']} 고위험 {len(high)}건: {names}. 폐기 예측 화면과 AI 승인함을 확인하세요."}]
