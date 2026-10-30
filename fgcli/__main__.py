"""FoodGuard 읽기 전용 데이터 CLI.

    python -m fgcli inventory 60006
    python -m fgcli recommend 60006
    python -m fgcli weekly-all --as hq

출력은 항상 JSON이다. 목록은 {"count": N, "items": [...]} 로 감싼다.
필드는 기본적으로 트리밍된다 — 원본 응답에는 store/ingredient 객체가 통째로
중첩되고 menu.imageUrl 에 base64 이미지가 들어 있어 그대로 두면 컨텍스트를
크게 낭비한다. 원본이 필요하면 --full 을 쓴다.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Callable

from fgcli.auth import decode_claims, get_token
from fgcli.client import AI_BASE, FoodGuardClient

# ── 필드 트리밍 ─────────────────────────────────────────────────────────
# 원본 응답에서 에이전트가 실제로 쓰는 필드만 남긴다.


def _pick(d: dict, *keys: str) -> dict:
    return {k: d[k] for k in keys if k in d}


def trim_menu(m: dict) -> dict:
    # imageUrl 은 base64 data URI 가 들어갈 수 있어 반드시 제외한다
    out = _pick(m, "id", "menuName", "category", "price")
    out["active"] = m.get("active", m.get("isActive"))
    return out


def trim_inventory(i: dict) -> dict:
    ing = i.get("ingredient") or {}
    return {
        "ingredientId": ing.get("id"),
        "ingredientName": ing.get("name"),
        "currentQty": i.get("currentQty"),
        "minThreshold": i.get("minThreshold"),
        "unit": i.get("unit") or ing.get("unit"),
        "belowThreshold": _below(i),
    }


def _below(i: dict) -> bool | None:
    try:
        return float(i.get("currentQty")) < float(i.get("minThreshold"))
    except (TypeError, ValueError):
        return None


def trim_order(o: dict) -> dict:
    ing = o.get("ingredient") or {}
    store = o.get("store") or {}
    return {
        "id": o.get("id"),
        "storeId": store.get("id"),
        "status": o.get("status"),
        "ingredientId": ing.get("id"),
        "ingredientName": ing.get("name"),
        "orderedQty": o.get("orderedQty"),
        "unit": ing.get("unit"),
        "orderedAt": o.get("orderedAt"),
        "approvedAt": o.get("approvedAt"),
    }


def trim_recipe(r: dict) -> dict:
    ing = r.get("ingredient") or {}
    return {
        "id": r.get("id"),
        "ingredientId": ing.get("id"),
        "ingredientName": ing.get("name"),
        "qtyPerUnit": r.get("qtyPerUnit"),
        "recipeUnit": r.get("unit"),
        "baseUnit": ing.get("unit"),
        "tolerancePct": r.get("tolerance"),
    }


def trim_sales(s: dict) -> dict:
    menu = s.get("menu") or {}
    return {
        "id": s.get("id"),
        "saleDate": s.get("saleDate"),
        "menuId": menu.get("id"),
        "menuName": menu.get("menuName"),
        "quantity": s.get("quantity"),
    }


def trim_store(s: dict) -> dict:
    return _pick(s, "id", "storeName", "region", "address", "openedAt")


def trim_prediction(p: dict) -> dict:
    return _pick(p, "menuId", "menuName", "predictionDate", "predictedQty",
                 "confidence", "modelVersion")


def trim_ingredient(i: dict) -> dict:
    return _pick(i, "id", "name", "unit", "category")


# ── 커맨드 정의 ─────────────────────────────────────────────────────────
# (path 생성 함수, 트리머, 도움말)

Trimmer = Callable[[dict], dict] | None

COMMANDS: dict[str, tuple[Callable[[argparse.Namespace], str], Trimmer, str]] = {
    "whoami":      (lambda a: "", None, "현재 토큰의 역할·사용자 ID 확인"),
    "my-stores":   (lambda a: "", trim_store, "내가 소유한 매장 목록"),
    "stores":      (lambda a: "/api/stores", trim_store, "전체 매장 목록 (HQ 전용)"),
    "menus":       (lambda a: f"/api/menus/{a.store_id}", trim_menu, "매장의 활성 메뉴"),
    "recipe":      (lambda a: f"/api/menu-ingredients/menu/{a.menu_id}", trim_recipe,
                    "메뉴의 레시피(식자재 구성)"),
    "ingredients": (lambda a: "/api/ingredients", trim_ingredient, "식자재 마스터 전체"),
    "inventory":   (lambda a: f"/api/inventory/{a.store_id}", trim_inventory, "매장 재고 현황"),
    "predictions": (lambda a: f"/api/predictions/{a.store_id}", trim_prediction,
                    "오늘 이후 수요 예측"),
    "recommend":   (lambda a: f"/api/orders/recommend/{a.store_id}", None,
                    "AI 예측 기반 발주 추천 (읽기 전용)"),
    "orders":      (lambda a: f"/api/orders/{a.store_id}", trim_order, "매장 발주 내역"),
    "orders-all":  (lambda a: "/api/orders/admin/all", trim_order, "전 매장 발주 내역 (HQ 전용)"),
    "sales":       (lambda a: f"/api/sales/{a.store_id}/range?start={a.start}&end={a.end}",
                    trim_sales, "기간별 판매 실적"),
    "today":       (lambda a: f"/api/sales/{a.store_id}/today-summary", None, "오늘 매출 요약"),
    "weekly":      (lambda a: f"/api/sales/{a.store_id}/weekly-summary", None,
                    "최근 7일 vs 직전 7일 매출"),
    "weekly-all":  (lambda a: "/api/sales/all-stores/weekly-summary", None,
                    "전 매장 주간 매출 (HQ 전용)"),
    "ai-health":   (lambda a: "/health", None, "AI 예측 서비스 가동 확인"),
    "accuracy":    (lambda a: "/api/predictions/accuracy?source=" + a.source
                    + (f"&storeId={a.store}" if a.store else ""), None,
                    "예측 정확도 (예측 이력 × 실제 판매, WAPE·MAPE·편향·기준선 대비)"),
    "plan":        (lambda a: "", None,
                    "발주 참모 발주안: 관찰→판단→발주안 + 서버 추천과 대조 (읽기 전용, 발주하지 않음)"),
}

NEEDS_STORE_ID = {"menus", "inventory", "predictions", "recommend", "orders",
                  "sales", "today", "weekly", "plan"}
NEEDS_MENU_ID = {"recipe"}


def _common_options(parser: argparse.ArgumentParser, *, suppress: bool) -> None:
    """공통 옵션. 서브커맨드 앞뒤 어디에 써도 동작하도록 양쪽에 등록한다.

    서브커맨드 쪽은 default=SUPPRESS 로 둬서, 지정하지 않았을 때 전역 값을
    덮어쓰지 않게 한다.
    """
    d: dict = {"default": argparse.SUPPRESS} if suppress else {}
    parser.add_argument("--as", dest="role", choices=["owner", "hq", "agent"],
                        help="어느 계정 권한으로 조회할지 (기본 owner)",
                        **({} if suppress else {"default": "owner"}), **d)
    parser.add_argument("--full", action="store_true",
                        help="필드 트리밍 없이 원본 응답 출력", **d)
    parser.add_argument("--limit", type=int,
                        help="목록을 앞에서 N건만 출력 (넓은 기간 조회로 컨텍스트가 넘치는 것을 방지)",
                        **d)
    parser.add_argument("--refresh-token", action="store_true",
                        help="캐시 무시하고 재로그인", **d)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m fgcli",
        description="FoodGuard 읽기 전용 데이터 CLI (쓰기 커맨드는 의도적으로 없음)",
    )
    _common_options(p, suppress=False)

    sub = p.add_subparsers(dest="command", required=True, metavar="COMMAND")
    for name, (_, _, help_text) in COMMANDS.items():
        sp = sub.add_parser(name, help=help_text)
        if name in NEEDS_STORE_ID:
            sp.add_argument("store_id", type=int, help="매장 ID")
        if name in NEEDS_MENU_ID:
            sp.add_argument("menu_id", type=int, help="메뉴 ID")
        if name == "accuracy":
            sp.add_argument("--source", choices=["backtest", "live"], default="backtest")
            sp.add_argument("--store", type=int, help="매장 ID (생략 시 전체)")
        if name == "sales":
            sp.add_argument("--start", required=True, help="시작일 YYYY-MM-DD")
            sp.add_argument("--end", required=True, help="종료일 YYYY-MM-DD")
        _common_options(sp, suppress=True)
    return p


def emit(payload: Any, limit: int | None = None) -> int:
    """JSON 출력. 에러면 종료 코드 1."""
    if isinstance(payload, list):
        total = len(payload)
        if limit is not None and total > limit:
            # 잘렸다는 사실을 반드시 알린다 — 에이전트가 전체로 오해하면 안 된다
            payload = {"count": limit, "total": total,
                       "truncated": f"전체 {total}건 중 앞 {limit}건만 표시했습니다.",
                       "items": payload[:limit]}
        else:
            payload = {"count": total, "items": payload}
    print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
    return 1 if isinstance(payload, dict) and "error" in payload else 0


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    args = build_parser().parse_args(argv)

    try:
        token = get_token(args.role, force_refresh=args.refresh_token)
    except RuntimeError as e:
        return emit({"error": "login_failed", "message": str(e)})

    claims = decode_claims(token)

    limit = getattr(args, "limit", None)

    if args.command == "whoami":
        return emit({
            "role": claims.get("role"),
            "userId": claims.get("id"),
            "email": claims.get("sub"),
            "as": args.role,
        })

    client = FoodGuardClient(token)
    path_fn, trimmer, _ = COMMANDS[args.command]

    if args.command == "plan":
        from fgcli.planner import ObserveError, build_plan, observe
        try:
            return emit(build_plan(observe(client, args.store_id)))
        except ObserveError as e:
            return emit({"error": "observe_failed", "message": str(e)})

    if args.command == "my-stores":
        path = f"/api/stores/my/{claims.get('id')}"
    else:
        path = path_fn(args)

    # accuracy 는 Spring 프록시를 거친다 (권한 검사 + 내부 토큰을 에이전트가 갖지 않게)
    base = AI_BASE if args.command == "ai-health" else None
    result = client.get(path, base=base) if base else client.get(path)

    if isinstance(result, list) and trimmer and not args.full:
        result = [trimmer(x) for x in result]

    return emit(result, limit)


if __name__ == "__main__":
    raise SystemExit(main())
