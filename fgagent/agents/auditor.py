"""데이터 품질 감사 에이전트 (AG-6): 매일 06:30 매장별로 이상 데이터를 찾아 승인함 정보 카드와 알림으로 알린다.

점검·건수·심각도는 결정적 코드가 정하고, LLM 은 요약과 "누가 무엇을 하면 되는지" 한 줄 조치만 쓴다.
코드 원인 추적은 개발용 서브에이전트(.claude/agents/foodguard-auditor.md)의 몫이다.
GET 만 쓰고 DB 에 직접 접근하지 않는다. 조회에 실패한 점검은 '이상 없음'이 아니라 not_checked 로 남긴다.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from fgcli.planner import UNIT_RULES

NAME = "audit"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["inventory", "menus", "recipe", "orders", "sales", "ingredients", "txns"]
PROMPT = (Path(__file__).parent.parent / "auditor.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "3~5문장, 결론 먼저"},
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"code": {"type": "string"}, "action": {"type": "string", "description": "누가 무엇을 하면 되는지 한 줄"}},
                "required": ["code", "action"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "actions"],
    "additionalProperties": False,
}

STUCK_ORDER_DAYS = 7
STUCK_STATUSES = ("REQUESTED", "APPROVED", "HQ_SENT")
SALES_GAP_DAYS = 7
LEDGER_TOLERANCE = 0.011  # 재고 소수 둘째 자리 반올림 오차
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


# ── 점검 (obs 의 값이 None 이면 그 조회가 실패한 것) ───────────────────


def _finding(code: str, severity: str, title: str, items: list, action: str) -> dict | None:
    return {"code": code, "severity": severity, "title": f"{title} {len(items)}건", "count": len(items),
            "items": items, "action": action} if items else None


def check_negative_stock(inventory: list[dict]) -> dict | None:
    # 판매 차감이 재고를 넘으면 음수가 되는 것은 설계된 동작이라 심각으로 보지 않는다
    return _finding("negative_stock", "medium", "음수 재고",
                    [f"{i['ingredient']['name']} {i['currentQty']}{i['unit']}" for i in inventory if float(i["currentQty"]) < 0],
                    "점주: 실재고를 세어 재고를 맞추고, 입고 등록이 빠졌는지 확인")


def check_threshold(inventory: list[dict]) -> dict | None:
    return _finding("threshold_unset", "low", "재고 임계치 미설정",
                    [i["ingredient"]["name"] for i in inventory if not float(i.get("minThreshold") or 0)],
                    "점주: 최소 재고를 설정해야 부족 알림이 동작합니다")


def check_menu_without_recipe(menus: list[dict], recipes: dict) -> dict | None:
    return _finding("menu_no_recipe", "high", "레시피 없는 활성 메뉴",
                    [m["menuName"] for m in menus if not recipes.get(m["id"])],
                    "점주: 레시피를 등록하세요. 없으면 판매해도 재고가 줄지 않고 발주 추천에서 빠집니다")


def check_recipe_units(menus: list[dict], recipes: dict) -> dict | None:
    items = []
    for m in menus:
        for r in recipes.get(m["id"]) or []:
            base, unit = r["ingredient"]["unit"], r["unit"]
            if unit not in UNIT_RULES.get(base, {}):
                items.append(f"{m['menuName']}: {r['ingredient']['name']} 레시피 {unit} ↔ 식자재 {base}")
    return _finding("recipe_unit", "high", "레시피 단위 비호환", items,
                    "본사: 레시피 단위를 고치세요. 재고·발주량이 크게 어긋날 수 있습니다")


def stuck_orders(orders: list[dict], today: date, days: int = STUCK_ORDER_DAYS) -> list[dict]:
    """같은 상태에 오래 머문 진행 중 발주. 발주 시각 기준이다 (상태 변경 시각은 기록되지 않는다)."""
    return [o for o in orders if o["status"] in STUCK_STATUSES and o.get("orderedAt")
            and (today - date.fromisoformat(str(o["orderedAt"])[:10])).days > days]


def check_stuck_orders(orders: list[dict], today: date) -> dict | None:
    return _finding("order_stuck", "medium", f"{STUCK_ORDER_DAYS}일 넘게 진행 중인 발주",
                    [f"#{o['id']} {o['ingredient']['name']} {o['status']} ({str(o['orderedAt'])[:10]})"
                     for o in stuck_orders(orders, today)],
                    "본사: 진행 상태를 확인하고 처리하세요. 발주 추천은 이 수량이 들어온다고 보고 계산합니다")


def check_region(status: dict) -> dict | None:
    return _finding("region_fallback", "medium", "날씨 좌표를 찾지 못한 매장 지역",
                    [status["region"] or "(비어 있음)"] if status["coordsFallback"] else [],
                    "본사: 매장 지역에 시·도를 넣으세요. 지금은 서울 날씨로 학습·예측합니다")


def check_sales_gap(sales: list[dict]) -> dict | None:
    return _finding("sales_gap", "medium", f"최근 {SALES_GAP_DAYS}일 판매 없는 매장",
                    [] if sales else [f"최근 {SALES_GAP_DAYS}일 판매 기록 0건"],
                    "점주: 판매 등록을 확인하세요. 예측이 오래된 패턴을 이어 붙인 값이 됩니다")


def check_ledger(inventory: list[dict], txns: list[dict]) -> dict | None:
    """원장과 재고의 어긋남. 합계로는 볼 수 없다: 원장은 003 적용 후부터 쌓여 그 전 재고가 합계에 없다.
    대신 최신 행의 qty_after 와 현재 재고, 연속된 행의 이어짐을 본다."""
    current = {i["ingredient"]["id"]: (float(i["currentQty"]), i["ingredient"]["name"]) for i in inventory}
    by_ingredient: dict[int, list[dict]] = {}
    for t in reversed(txns):  # 응답은 최신순
        if t.get("qtyAfter") is not None:
            by_ingredient.setdefault(t["ingredientId"], []).append(t)
    items = []
    for iid, rows in sorted(by_ingredient.items()):
        qty, name = current.get(iid, (0.0, f"식자재 {iid}"))
        if abs(float(rows[-1]["qtyAfter"]) - qty) > LEDGER_TOLERANCE:
            items.append(f"{name}: 원장 {rows[-1]['qtyAfter']} ↔ 재고 {qty}")
            continue
        for prev, cur in zip(rows, rows[1:]):
            if abs(float(prev["qtyAfter"]) + float(cur["deltaQty"]) - float(cur["qtyAfter"])) > LEDGER_TOLERANCE:
                items.append(f"{name}: 원장 행 #{cur['id']} 이 직전 잔량과 이어지지 않음")
                break
    return _finding("ledger_mismatch", "high", "원장과 재고 불일치", items,
                    "개발팀: 원장을 거치지 않은 재고 변경이 있는지 확인하세요 (InventoryLedger 만 재고를 바꿔야 합니다)")


def check_duplicate_names(ingredients: list[dict], used_ids: set[int]) -> dict | None:
    """R9. 이름이 같은 식자재 중 이 매장이 쓰는 것이 있을 때만 알린다 (전 매장 공통 이슈를 매장마다 반복하지 않게)."""
    by_name: dict[str, list[dict]] = {}
    for i in ingredients:
        by_name.setdefault(i["name"], []).append(i)
    items = [f"{name}: " + ", ".join(f"#{i['id']}({i['unit']})" for i in rows)
             for name, rows in sorted(by_name.items())
             if len(rows) > 1 and any(i["id"] in used_ids for i in rows)]
    return _finding("duplicate_name", "low", "이름이 같은 식자재", items, "본사: 이름에 단위를 붙이거나 하나로 합치세요")


# ── 관찰·판단 ──────────────────────────────────────────────────────────


def _list(client, path: str) -> list | None:
    r = client.get(path)
    return r if isinstance(r, list) else None


def observe(client, store_id: int) -> dict:
    today = date.today()
    menus = _list(client, f"/api/menus/{store_id}")
    recipes = None
    if menus is not None:
        fetched = {m["id"]: _list(client, f"/api/menu-ingredients/menu/{m['id']}") for m in menus}
        recipes = None if any(v is None for v in fetched.values()) else fetched
    status = client.get(f"/api/predictions/{store_id}/model-status")
    obs = {
        "storeId": store_id, "asOf": today.isoformat(), "menus": menus, "recipes": recipes,
        "inventory": _list(client, f"/api/inventory/{store_id}"),
        "orders": _list(client, f"/api/orders/{store_id}"),
        "sales": _list(client, f"/api/sales/{store_id}/range?start={today - timedelta(days=SALES_GAP_DAYS)}&end={today}"),
        "txns": _list(client, f"/api/inventory/{store_id}/txns"),      # 003 적용 전이면 None
        "ingredients": _list(client, "/api/ingredients"),
        "status": status if isinstance(status, dict) and "error" not in status else None,  # ai-service 꺼짐 등
    }
    if obs["inventory"] is None and obs["menus"] is None and obs["orders"] is None:
        raise RuntimeError("매장 데이터를 하나도 조회하지 못했습니다. 백엔드 상태를 확인하세요.")
    return obs


def decide(obs: dict) -> dict:
    today = date.fromisoformat(obs["asOf"])
    inventory, menus, recipes = obs["inventory"], obs["menus"], obs["recipes"]
    used = {i["ingredient"]["id"] for i in inventory or []} \
        | {r["ingredient"]["id"] for rows in (recipes or {}).values() for r in rows}
    checks = {
        "negative_stock": (inventory is not None, lambda: check_negative_stock(inventory)),
        "threshold_unset": (inventory is not None, lambda: check_threshold(inventory)),
        "menu_no_recipe": (recipes is not None, lambda: check_menu_without_recipe(menus, recipes)),
        "recipe_unit": (recipes is not None, lambda: check_recipe_units(menus, recipes)),
        "order_stuck": (obs["orders"] is not None, lambda: check_stuck_orders(obs["orders"], today)),
        "region_fallback": (obs["status"] is not None, lambda: check_region(obs["status"])),
        "sales_gap": (obs["sales"] is not None, lambda: check_sales_gap(obs["sales"])),
        "ledger_mismatch": (obs["txns"] is not None and inventory is not None, lambda: check_ledger(inventory, obs["txns"])),
        "duplicate_name": (obs["ingredients"] is not None, lambda: check_duplicate_names(obs["ingredients"], used)),
    }
    findings, not_checked = [], []
    for code, (available, run) in checks.items():
        if not available:
            not_checked.append(code)
        elif (f := run()) is not None:
            findings.append(f)
    findings.sort(key=lambda f: SEVERITY_ORDER[f["severity"]])
    return {"asOf": obs["asOf"], "findings": findings, "notChecked": not_checked,
            "checked": len(checks) - len(not_checked)}


def _serious(decision: dict) -> list[dict]:
    return [f for f in decision["findings"] if f["severity"] != "low"]


def needs_llm(decision: dict) -> bool:
    return bool(_serious(decision))


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    """정보 카드 1장. 저위험만 있으면 실행 기록에만 남긴다 (매일 같은 카드로 승인함을 채우지 않게)."""
    serious = _serious(decision)
    if not serious:
        return []
    actions = {a["code"]: a["action"] for a in (llm or {}).get("actions", [])}
    return [{
        "type": "AUDIT_REPORT",
        "payload": {
            "asOf": decision["asOf"], "checked": decision["checked"], "notChecked": decision["notChecked"],
            # 건수·심각도는 점검 결과 그대로이고, LLM 은 조치 문구만 바꿀 수 있다
            "items": [{"severity": f["severity"], "title": f["title"],
                       "action": actions.get(f["code"]) or f["action"],
                       "examples": ", ".join(str(x) for x in f["items"][:5]) + (" 외" if f["count"] > 5 else "")}
                      for f in decision["findings"]],
        },
        "rationale": llm["summary"] if llm else
        f"데이터 점검 {decision['checked']}개 항목에서 확인이 필요한 이슈 {len(serious)}종을 찾았습니다.",
    }]


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    high = [f for f in decision["findings"] if f["severity"] == "high"]
    if not high:
        return []
    return [{"type": "AUDIT", "message": f"[데이터 감사] {decision['asOf']} 심각 이슈: "
                                         + ", ".join(f["title"] for f in high) + ". AI 승인함을 확인하세요."}]
