"""주간 브리핑 (AG-8): 매주 월요일 08:00 지난주 매출·폐기 위험·진행 발주·예측 오차를 점주에게 요약한다.

수치는 결정적 코드가 조회·계산하고, LLM 은 요약 문장만 쓴다. 데이터를 바꾸지 않는 정보 카드다.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from fgagent.agents.mlops import _overall
from fgagent.agents.schema import COMMON_OUTPUT_SCHEMA
from fgcli.planner import _get

NAME = "weekly"
DEFAULT_MODEL = "claude-sonnet-5-5"
ALLOWED_TOOLS = ["weekly", "waste", "accuracy", "orders"]
PROMPT = (Path(__file__).parent.parent / "weekly_brief.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = COMMON_OUTPUT_SCHEMA

TOP_WASTE = 3
ACTIVE_STATUSES = ("REQUESTED", "APPROVED", "HQ_SENT", "DRIVER_RECEIVED")
CARD_DAYS = 7


def observe(client, store_id: int) -> dict:
    waste = client.get(f"/api/waste-prediction/{store_id}")   # 004 적용 전이면 오류 → 그 항목만 뺀다
    return {
        "storeId": store_id, "asOf": date.today().isoformat(),
        "weekly": _get(client, f"/api/sales/{store_id}/weekly-summary"),
        "waste": waste if isinstance(waste, list) else None,
        "orders": _get(client, f"/api/orders/{store_id}"),
        "live": _overall(client.get(f"/api/predictions/accuracy?source=live&storeId={store_id}&windowDays=7")),
    }


def decide(obs: dict) -> dict:
    this_week, prev_week = obs["weekly"]["thisWeekRevenue"], obs["weekly"]["prevWeekRevenue"]
    waste = obs["waste"]
    risky = [r for r in waste or [] if r["riskLevel"] in ("HIGH", "MEDIUM")]
    return {
        "asOf": obs["asOf"], "thisWeekRevenue": this_week, "prevWeekRevenue": prev_week,
        "revenueChangePct": round((this_week - prev_week) * 100 / prev_week, 1) if prev_week else None,
        "wasteChecked": waste is not None, "wasteRiskCount": len(risky),
        "topWaste": [{"ingredientName": r["ingredientName"], "wastePrediction": r["wastePrediction"], "unit": r["unit"],
                      "riskLevel": r["riskLevel"]} for r in risky[:TOP_WASTE]],
        "activeOrders": sum(1 for o in obs["orders"] if o["status"] in ACTIVE_STATUSES),
        "liveWape": (obs["live"] or {}).get("wape"),
    }


def _fallback(d: dict) -> str:
    change = f"(전주 대비 {d['revenueChangePct']:+.1f}%)" if d["revenueChangePct"] is not None else "(전주 매출 없음)"
    waste = f"폐기 위험 {d['wasteRiskCount']}개" if d["wasteChecked"] else "폐기 위험 미확인"
    return f"최근 7일 매출 {d['thisWeekRevenue']:,}원 {change}, {waste}, 진행 중 발주 {d['activeOrders']}건입니다."


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    expires = date.fromisoformat(decision["asOf"]) + timedelta(days=CARD_DAYS)
    return [{
        "type": "WEEKLY_BRIEFING",
        "expiresAt": f"{expires.isoformat()}T23:59:59",
        "payload": decision,
        "rationale": llm["summary"] if llm else _fallback(decision),
    }]


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    return [{"type": "INFO", "message": f"[주간 브리핑] {decision['asOf']} 브리핑이 도착했습니다. AI 승인함에서 확인하세요."}]
