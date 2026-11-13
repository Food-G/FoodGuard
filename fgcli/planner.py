"""발주 참모의 결정적(deterministic) 코어: 관찰 → 판단 → 발주안.

LLM 은 이 결과를 설명·검토만 한다. 수량은 전부 여기서, 서버와 같은 산식으로 나온다
(agent-assets/04-business-rules.md §1). 서버 `/recommend` 결과와 독립 재계산을
대조해서 어긋나면 발주안에 경고를 붙인다.

build_plan() 은 네트워크 없이 관찰 결과(dict)만 받는 순수 함수라 테스트가 쉽다.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import date, timedelta
from typing import Any

from fgcli.client import FoodGuardClient

# 판단 기준. 숫자를 바꾸면 agent-assets/04-business-rules.md 에도 적는다.
STOCKOUT_COVER_DAYS = 2.0   # 재고로 버틸 수 있는 날이 이보다 적으면 품절 위험
WASTE_COVER_RATIO = 2.0     # 재고가 예측 기간 소요량의 이 배수를 넘으면 폐기 위험
MIN_PREDICTION_DAYS = 3     # 예측이 이보다 짧게 남았으면 '오래됨'
CROSSCHECK_TOL = 0.11       # round1 누적 오차를 감안한 서버 대조 허용치
RECENT_SALES_DAYS = 14      # 이 기간에 판매 기록이 없으면 예측 근거가 오래된 것
STALE_PENDING_DAYS = 7      # 이보다 오래 처리되지 않은 진행 중 발주는 '도착할 것'으로 믿기 어렵다

PENDING_STATUSES = ("REQUESTED", "APPROVED")

# backend util/UnitConverter 와 같은 표. 기준 단위 → {레시피 단위: 계수}
UNIT_RULES = {
    "kg": {"g": 0.001, "kg": 1.0},
    "L": {"ml": 0.001, "L": 1.0},
    "개": {"개": 1.0},
}


def round1(x: float) -> float:
    # Java Math.round(x*10)/10.0 과 같은 반올림 (Python round 는 은행가 반올림)
    return math.floor(x * 10 + 0.5) / 10.0


# ── 관찰 ───────────────────────────────────────────────────────────────


class ObserveError(RuntimeError):
    pass


def _get(client: FoodGuardClient, path: str) -> Any:
    r = client.get(path)
    if isinstance(r, dict) and "error" in r:
        raise ObserveError(f"{path}: {r.get('message')}")
    return r


def observe(client: FoodGuardClient, store_id: int) -> dict:
    """기존 읽기 API 만으로 판단에 필요한 상태를 모은다."""
    menus = _get(client, f"/api/menus/{store_id}")
    end = date.today()
    start = end - timedelta(days=RECENT_SALES_DAYS)
    recent_sales = _get(client, f"/api/sales/{store_id}/range?start={start}&end={end}")
    recipes = {}
    for m in menus:
        recipes[m["id"]] = [
            {
                "ingredientId": r["ingredient"]["id"],
                "ingredientName": r["ingredient"]["name"],
                "baseUnit": r["ingredient"]["unit"],
                "qtyPerUnit": float(r["qtyPerUnit"]),
                "recipeUnit": r["unit"],
                "tolerancePct": float(r.get("tolerance") or 0),
            }
            for r in _get(client, f"/api/menu-ingredients/menu/{m['id']}")
        ]
    return {
        "storeId": store_id,
        "menus": [{"id": m["id"], "menuName": m.get("menuName")} for m in menus],
        "recipes": recipes,
        "predictions": [
            {"menuId": p["menuId"], "menuName": p.get("menuName"),
             "date": p["predictionDate"], "qty": p["predictedQty"],
             "confidence": p.get("confidence")}
            for p in _get(client, f"/api/predictions/{store_id}")
        ],
        "inventory": [
            {"ingredientId": i["ingredient"]["id"], "ingredientName": i["ingredient"]["name"],
             "unit": i.get("unit") or i["ingredient"]["unit"],
             "currentQty": float(i["currentQty"]),
             "minThreshold": float(i.get("minThreshold") or 0)}
            for i in _get(client, f"/api/inventory/{store_id}")
        ],
        "pendingOrders": [
            {"id": o["id"], "ingredientId": o["ingredient"]["id"],
             "ingredientName": o["ingredient"]["name"],
             "qty": float(o["orderedQty"]), "status": o["status"],
             "orderedAt": str(o.get("orderedAt") or "")[:10]}
            for o in _get(client, f"/api/orders/{store_id}")
            if o.get("status") in PENDING_STATUSES
        ],
        "serverRecommend": _get(client, f"/api/orders/recommend/{store_id}"),
        "recentSalesDays": len({s.get("saleDate") for s in recent_sales}),
    }


# ── 판단 + 발주안 ──────────────────────────────────────────────────────


def build_plan(obs: dict, today: date | None = None, waste_hints: dict[int, float] | None = None) -> dict:
    """waste_hints: 점주가 승인한 폐기 위험 감축 힌트 {ingredientId: 줄일 양} (AG-2)."""
    today = today or date.today()
    waste_hints = waste_hints or {}
    warnings: list[dict] = []
    stock = {i["ingredientId"]: i for i in obs["inventory"]}
    pending: dict[int, float] = {}
    for o in obs["pendingOrders"]:
        pending[o["ingredientId"]] = pending.get(o["ingredientId"], 0.0) + o["qty"]

    # 예측 신선도
    dates = sorted({p["date"] for p in obs["predictions"]})
    horizon = len(dates)
    if horizon == 0:
        freshness = "missing"
        warnings.append({"type": "prediction_missing",
                         "message": "오늘 이후 예측이 없습니다. 재예측을 먼저 실행해야 발주안을 만들 수 있습니다."})
    elif horizon < MIN_PREDICTION_DAYS:
        freshness = "stale"
        warnings.append({"type": "prediction_stale",
                         "message": f"남은 예측이 {horizon}일뿐입니다 ({dates[0]}~{dates[-1]}). 재예측을 권장합니다."})
    else:
        freshness = "fresh"

    # 레시피가 있는 메뉴(=발주량에 영향을 주는 메뉴) 중 예측이 빠진 메뉴가 있으면 재예측 대상
    # (레시피 없는 메뉴의 예측만 남아 있어도 '최신'으로 보던 문제)
    predicted = {p["menuId"] for p in obs["predictions"]}
    unpredicted = [m["id"] for m in obs["menus"]
                   if (obs["recipes"].get(m["id"]) or obs["recipes"].get(str(m["id"])))
                   and m["id"] not in predicted]
    if unpredicted and freshness == "fresh":
        freshness = "stale"
        warnings.append({"type": "prediction_partial", "menuIds": unpredicted,
                         "message": f"레시피가 있는 메뉴 {unpredicted}의 예측이 없습니다. 재예측을 권장합니다."})

    # 오래 멈춰 있는 진행 중 발주. 서버 추천도 이 수량을 '들어올 것'으로 빼고 계산하므로
    # 실제로는 안 들어오는 발주 때문에 필요한 발주가 추천에서 사라질 수 있다.
    stale = [o for o in obs["pendingOrders"]
             if o.get("orderedAt") and (today - date.fromisoformat(o["orderedAt"])).days > STALE_PENDING_DAYS]
    if stale:
        oldest = min(o["orderedAt"] for o in stale)
        # 어떤 식자재인지 적는다. 빠지면 LLM 이 엉뚱한 식자재에 연결해 설명한다 (2026-11-13 평가에서 확인)
        which = ", ".join(f"#{o['id']} {o.get('ingredientName') or o['ingredientId']}" for o in stale)
        warnings.append({
            "type": "pending_stale", "orderIds": [o["id"] for o in stale],
            "ingredientIds": sorted({o["ingredientId"] for o in stale}),
            "message": f"진행 중 발주 {len(stale)}건이 {STALE_PENDING_DAYS}일 넘게 처리되지 않았습니다 ({which}, 가장 오래된 것 {oldest}). "
                       "발주안은 이 식자재의 대기발주 수량이 들어온다고 보고 뺐으므로, 본사에 상태를 확인하거나 취소 후 다시 계획하세요.",
        })

    if obs.get("recentSalesDays") == 0:
        warnings.append({"type": "sales_stale",
                         "message": f"최근 {RECENT_SALES_DAYS}일 판매 기록이 없습니다. 예측이 오래된 판매 패턴을 이어 붙인 값이라 "
                                    "신뢰도가 낮습니다. 소량·단기 발주를 권합니다."})

    # 메뉴별 예측 합계
    menu_total: dict[int, int] = {}
    for p in obs["predictions"]:
        menu_total[p["menuId"]] = menu_total.get(p["menuId"], 0) + int(p["qty"])

    # 레시피 전개 → 식자재별 필요량 (기준 단위)
    required: dict[int, float] = {}
    names: dict[int, str] = {}
    units: dict[int, str] = {}
    drivers: dict[int, list[str]] = {}
    for menu_id, total in menu_total.items():
        recipe = obs["recipes"].get(menu_id) or obs["recipes"].get(str(menu_id)) or []
        if not recipe:
            warnings.append({"type": "recipe_missing", "menuId": menu_id,
                             "message": f"메뉴 {menu_id}는 예측이 있지만 레시피가 없어 소요량에 반영되지 않습니다."})
        for r in recipe:
            factor = UNIT_RULES.get(r["baseUnit"], {}).get(r["recipeUnit"])
            if factor is None:
                warnings.append({"type": "unit_incompatible", "ingredientId": r["ingredientId"],
                                 "message": f"{r['ingredientName']}: 레시피 {r['recipeUnit']} ↔ 식자재 {r['baseUnit']} 비호환. 이 항목은 계산에서 뺐습니다."})
                continue
            q = r["qtyPerUnit"] * total * (1 + r["tolerancePct"] / 100) * factor
            iid = r["ingredientId"]
            required[iid] = required.get(iid, 0.0) + q
            names[iid] = r["ingredientName"]
            units[iid] = r["baseUnit"]
            drivers.setdefault(iid, []).append(f"menu {menu_id} × {total}")

    # 데이터 품질
    for i in obs["inventory"]:
        if i["currentQty"] < 0:
            warnings.append({"type": "negative_stock", "ingredientId": i["ingredientId"],
                             "message": f"{i['ingredientName']} 재고가 음수({i['currentQty']}{i['unit']})입니다. 실재고 확인이 필요합니다."})

    # 식자재별 판단
    items, risks, before_hints = [], [], []
    for iid in sorted(set(required) | set(stock)):
        inv = stock.get(iid)
        req = round1(required.get(iid, 0.0))
        cur = round1(inv["currentQty"]) if inv else 0.0
        pend = round1(pending.get(iid, 0.0))
        name = names.get(iid) or (inv or {}).get("ingredientName")
        unit = units.get(iid) or (inv or {}).get("unit")
        order_qty = round1(max(0.0, req - cur - pend))
        reason = f"{horizon}일 소요 {req}{unit} − 재고 {cur} − 대기발주 {pend} = {order_qty}{unit}"
        if order_qty > 0:
            before_hints.append({"ingredientId": iid, "orderQty": order_qty})
            cut = min(order_qty, round1(waste_hints.get(iid, 0.0)))
            if cut > 0:
                order_qty = round1(order_qty - cut)
                reason += f" − 폐기 위험 감축 {cut} = {order_qty}{unit}"
                warnings.append({"type": "waste_hint_applied", "ingredientId": iid,
                                 "message": f"{name}: 승인된 폐기 위험 힌트로 {cut}{unit} 줄였습니다. "
                                            "남은 재고의 유통기한이 지난 뒤 부족할 수 있으니 확인하세요."})
        daily = req / horizon if horizon else 0.0
        cover = (cur + pend) / daily if daily > 0 else None

        own_cover = cur / daily if daily > 0 else None   # 대기발주 없이 지금 재고만으로 버틸 날

        risk = None
        if inv and inv["minThreshold"] > 0 and cur < inv["minThreshold"]:
            risk = "below_threshold"
        elif own_cover is not None and own_cover < STOCKOUT_COVER_DAYS and pend > 0                 and (cover is None or cover >= STOCKOUT_COVER_DAYS):
            risk = "awaiting_delivery"   # 대기발주가 제때 들어와야만 버틴다
        elif cover is not None and cover < STOCKOUT_COVER_DAYS:
            risk = "stockout"
        elif horizon and req > 0 and cur > req * WASTE_COVER_RATIO:
            risk = "waste"
        elif horizon and req == 0 and cur > 0:
            risk = "no_demand"
        if risk:
            risks.append({"ingredientId": iid, "ingredientName": name, "risk": risk,
                          "currentQty": cur, "requiredQty": req, "unit": unit,
                          "coverDays": None if cover is None else round1(cover)})

        if order_qty > 0:
            items.append({
                "ingredientId": iid, "ingredientName": name, "unit": unit,
                "orderQty": order_qty, "requiredQty": req, "currentStock": cur,
                "pendingQty": pend,
                "reason": reason,
                "drivers": drivers.get(iid, []),
            })

    # 서버 /recommend 는 힌트를 모르므로 힌트 적용 전 수량으로 대조한다
    crosscheck = _crosscheck(before_hints, obs.get("serverRecommend") or [])
    if not crosscheck["match"]:
        warnings.append({"type": "crosscheck_mismatch",
                         "message": "독립 재계산과 서버 /recommend 결과가 다릅니다. 발주 전 원인을 확인하세요.",
                         "diff": crosscheck["diff"]})

    plan = {
        "storeId": obs["storeId"],
        "asOf": today.isoformat(),
        "prediction": {"freshness": freshness, "days": horizon,
                       "from": dates[0] if dates else None, "to": dates[-1] if dates else None},
        "items": items,
        "risks": risks,
        "requiredByIngredient": {iid: round1(q) for iid, q in required.items()},
        "warnings": warnings,
        "crosscheck": crosscheck,
        "pendingOrderCount": len(obs["pendingOrders"]),
    }
    plan["planId"] = plan_fingerprint(plan)
    return plan


def _crosscheck(items: list[dict], server: list[dict]) -> dict:
    mine = {i["ingredientId"]: i["orderQty"] for i in items}
    theirs = {int(s["ingredientId"]): float(s["orderQty"]) for s in server}
    diff = []
    for iid in sorted(set(mine) | set(theirs)):
        a, b = mine.get(iid, 0.0), theirs.get(iid, 0.0)
        if abs(a - b) > CROSSCHECK_TOL:
            diff.append({"ingredientId": iid, "planner": a, "server": b})
    return {"match": not diff, "diff": diff}


def plan_fingerprint(plan: dict) -> str:
    """발주 수량과 그 근거가 된 상태로 만든 ID.

    승인 후 실행 직전에 다시 계산해서 ID 가 다르면(그 사이 재고·발주가 바뀌면)
    실행을 멈춘다. 사람이 본 것과 다른 발주가 나가는 것을 막는 장치다.
    """
    basis = {
        "store": plan["storeId"],
        "asOf": plan["asOf"],
        "items": [(i["ingredientId"], i["orderQty"], i["currentStock"], i["pendingQty"])
                  for i in plan["items"]],
    }
    raw = json.dumps(basis, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:8]
