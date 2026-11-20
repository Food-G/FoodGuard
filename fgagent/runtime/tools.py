"""fgcli COMMANDS 를 Claude 도구로 바꾼다 (읽기 전용).

도구 실행은 FoodGuardClient 로 직접 GET 한다. 쓰기 도구는 만들지 않는다 (R5).
매장 단위 실행이면 store_id 를 도구 입력에서 빼고 실행 매장으로 고정한다 —
AGENT 계정은 전 매장을 읽을 수 있지만, 한 매장 에이전트가 다른 매장을 볼 이유는 없다.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from typing import Any

from fgcli.__main__ import COMMANDS, NEEDS_MENU_ID, NEEDS_STORE_ID
from fgcli.client import FoodGuardClient

# path 가 없거나(whoami, my-stores, plan) AI 서비스 직접 호출(ai-health)이라 도구로 만들지 않는다
EXCLUDED = {"whoami", "my-stores", "plan", "ai-health"}

MAX_ITEMS = 100  # 목록이 길면 잘라서 컨텍스트를 아낀다 (잘렸다는 사실은 알린다)
ORDER_LISTS = {"orders", "orders-all"}
ACTIVE_ORDER_STATUSES = ("REQUESTED", "APPROVED", "HQ_SENT", "DRIVER_RECEIVED")

_INT = {"type": "integer"}
_DATE = {"type": "string", "description": "YYYY-MM-DD"}


@dataclass
class Tool:
    name: str
    spec: dict           # Messages API tools[] 항목
    bound_store: int | None

    def run(self, client: FoodGuardClient, args: dict) -> Any:
        return run_command(client, self.name, args, self.bound_store)


def _input_schema(name: str, bind_store: bool) -> dict:
    props: dict = {}
    required: list[str] = []
    if name in NEEDS_STORE_ID and not bind_store:
        props["store_id"] = {**_INT, "description": "매장 ID"}
        required.append("store_id")
    if name in NEEDS_MENU_ID:
        props["menu_id"] = {**_INT, "description": "메뉴 ID"}
        required.append("menu_id")
    if name == "sales":
        props["start"], props["end"] = {**_DATE, "description": "시작일 YYYY-MM-DD"}, {**_DATE, "description": "종료일 YYYY-MM-DD"}
        required += ["start", "end"]
    if name == "txns":
        props["from_date"] = {**_DATE, "description": "시작일 YYYY-MM-DD (생략 시 30일 전)"}
        props["to_date"] = {**_DATE, "description": "종료일 YYYY-MM-DD, 그날 포함 (생략 시 오늘)"}
        props["ingredient"] = {**_INT, "description": "식자재 ID (생략 시 전체)"}
    if name == "accuracy":
        props["source"] = {"type": "string", "enum": ["backtest", "live"]}
        required.append("source")
        if not bind_store:
            props["store"] = {**_INT, "description": "매장 ID (생략 시 전체)"}
    return {"type": "object", "properties": props, "required": required, "additionalProperties": False}


def build_tools(names: list[str], store_id: int | None = None) -> list[Tool]:
    """허용 목록(names)만 도구로 만든다. store_id 가 있으면 그 매장으로 고정한다."""
    tools = []
    for name in names:
        if name not in COMMANDS or name in EXCLUDED:
            raise ValueError(f"도구로 쓸 수 없는 커맨드: {name}")
        bind = store_id is not None
        tools.append(Tool(name=name, bound_store=store_id, spec={
            "name": name,
            "description": COMMANDS[name][2],
            "input_schema": _input_schema(name, bind),
        }))
    return tools


def run_command(client: FoodGuardClient, name: str, args: dict, bound_store: int | None = None) -> Any:
    """fgcli 커맨드 1개를 실행해 (트리밍된) 결과를 돌려준다. 입력 오류는 error dict 로."""
    ns = argparse.Namespace(**args)
    if bound_store is not None:
        ns.store_id = bound_store
        if name == "accuracy":
            ns.store = bound_store
    if name == "accuracy" and not hasattr(ns, "store"):
        ns.store = None
    for key in ("store_id", "menu_id"):
        if hasattr(ns, key) and not isinstance(getattr(ns, key), int):
            return {"error": "bad_input", "message": f"{key} 는 정수여야 합니다."}

    path_fn, trimmer, _ = COMMANDS[name]
    try:
        path = path_fn(ns)
    except AttributeError as e:
        return {"error": "bad_input", "message": f"필수 입력 누락: {e}"}

    result = client.get(path)
    if isinstance(result, list):
        if trimmer:
            result = [trimmer(x) for x in result]
        extra: dict = {}
        if name in ORDER_LISTS:
            # 진행 중 발주 먼저, 그다음 최신순. 서버는 오래된 순으로 주므로 그냥 자르면 지금 필요한 발주가 빠진다
            # (2026-11-13 평가: 675건 중 앞 100건이 모두 완료 건이라 "진행 중 0건"으로 답했다)
            result = sorted(result, key=lambda o: str(o.get("orderedAt") or ""), reverse=True)
            result.sort(key=lambda o: o.get("status") not in ACTIVE_ORDER_STATUSES)
            by_status: dict[str, int] = {}
            for o in result:
                by_status[o.get("status")] = by_status.get(o.get("status"), 0) + 1
            extra = {"byStatus": by_status,
                     "activeCount": sum(n for s, n in by_status.items() if s in ACTIVE_ORDER_STATUSES),
                     "order": "진행 중 발주 먼저, 그다음 최신순"}
        total = len(result)
        if total > MAX_ITEMS:
            return {"count": MAX_ITEMS, "total": total, **extra,
                    "truncated": f"전체 {total}건 중 앞 {MAX_ITEMS}건만 표시했습니다.",
                    "items": result[:MAX_ITEMS]}
        return {"count": total, **extra, "items": result}
    return result


def to_text(result: Any) -> str:
    return json.dumps(result, ensure_ascii=False, default=str)
