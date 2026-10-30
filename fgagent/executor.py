"""쓰기 작업 (재예측, 발주 생성).

fgcli 는 읽기 전용으로 남겨 두고, 쓰기는 이 모듈에만 둔다. 이 모듈은 사람이 터미널에서
승인한 뒤 fgagent 러너가 직접 호출한다. Claude 에게 주는 도구는 `python -m fgcli *` 뿐이라
Claude 는 여기까지 올 수 없다.
"""

from __future__ import annotations

from typing import Any

import requests

from fgcli.client import AI_BASE, API_BASE, FoodGuardClient


class WriteClient(FoodGuardClient):
    def post(self, path: str, body: dict | None = None, base: str = API_BASE) -> tuple[int, Any]:
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            r = requests.post(f"{base}{path}", json=body, headers=headers, timeout=120)
        except requests.RequestException as e:
            return 0, str(e)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, r.text.strip()


    def put(self, path: str, body: dict | None = None, base: str = API_BASE) -> tuple[int, Any]:
        headers = {"Authorization": f"Bearer {self.token}"}
        try:
            r = requests.put(f"{base}{path}", json=body, headers=headers, timeout=120)
        except requests.RequestException as e:
            return 0, str(e)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, r.text.strip()


def ai_service_up() -> bool:
    try:
        return requests.get(f"{AI_BASE}/health", timeout=3).status_code == 200
    except requests.RequestException:
        return False


def trigger_prediction(client: WriteClient, store_id: int) -> tuple[bool, str]:
    """재예측. 실패하면 서버가 502 + {"status": "error", "message": ...} 를 돌려준다."""
    status, body = client.post(f"/api/predictions/{store_id}/trigger")
    if status == 200 and isinstance(body, dict) and body.get("status") == "success":
        return True, "재예측 완료"
    msg = body.get("message") if isinstance(body, dict) else body
    return False, f"재예측 실패 ({status}): {msg}"


def place_orders(client: WriteClient, store_id: int, items: list[dict]) -> list[dict]:
    """승인된 항목만 하나씩 발주한다. 한 건이 실패해도 나머지 결과를 모두 보고한다."""
    results = []
    for it in items:
        status, body = client.post("/api/orders", {
            "storeId": store_id, "ingredientId": it["ingredientId"], "quantity": it["orderQty"],
        })
        ok = status == 200 and isinstance(body, dict) and body.get("id") is not None
        results.append({**it, "ok": ok, "orderId": body.get("id") if ok else None,
                        "error": None if ok else f"{status}: {str(body)[:200]}"})
    return results


def verify_orders(client: WriteClient, store_id: int, results: list[dict]) -> list[dict]:
    """발주 내역을 다시 조회해서 생성된 발주가 실제로 REQUESTED 로 있는지 확인한다."""
    orders = client.get(f"/api/orders/{store_id}")
    by_id = {o["id"]: o for o in orders} if isinstance(orders, list) else {}
    checked = []
    for r in results:
        o = by_id.get(r["orderId"]) if r["ok"] else None
        verified = bool(o) and o.get("status") == "REQUESTED" \
            and abs(float(o.get("orderedQty", 0)) - r["orderQty"]) < 1e-6
        checked.append({**r, "verified": verified})
    return checked
