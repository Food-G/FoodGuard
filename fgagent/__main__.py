"""발주 참모 에이전트 러너.

    python -m fgagent order 60006            # 관찰 → 판단 → 발주안 → Claude 검토 → 승인 → 실행 → 검증
    python -m fgagent order 60006 --no-llm   # Claude 없이 결정적 코어만

쓰기(재예측, 발주)는 반드시 이 터미널에서 사람이 입력한 답을 받은 뒤에만 일어난다.
실행 직전에 발주안을 다시 계산해 planId 가 바뀌었으면(그 사이 재고·발주가 바뀌면) 멈춘다.
모든 실행 기록은 agent-runs/ 에 JSON 으로 남긴다.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from fgagent import advisor, executor
from fgcli.auth import get_token
from fgcli.planner import ObserveError, build_plan, observe

RUNS_DIR = Path(__file__).resolve().parent.parent / "agent-runs"

RISK_LABEL = {"stockout": "품절 위험", "below_threshold": "임계치 미만",
              "waste": "폐기 위험(과잉)", "no_demand": "예측 수요 없음"}


def ask(question: str, choices: str) -> str:
    """사람의 답만 받는다. 입력이 없는 환경(파이프 등)에서는 '아니오'로 본다."""
    try:
        ans = input(f"{question} [{choices}] ").strip().lower()
    except EOFError:
        print("\n(입력이 없어 아무것도 실행하지 않습니다)")
        return ""
    return ans


def show_plan(plan: dict) -> None:
    p = plan["prediction"]
    print(f"\n■ 관찰  매장 {plan['storeId']} · 기준일 {plan['asOf']} · "
          f"예측 {p['days']}일({p['from']}~{p['to']}) · 진행 중 발주 {plan['pendingOrderCount']}건")
    if plan["risks"]:
        print("■ 판단")
        for r in plan["risks"]:
            cover = f", {r['coverDays']}일분" if r["coverDays"] is not None else ""
            print(f"  - {RISK_LABEL.get(r['risk'], r['risk'])}: {r['ingredientName']} "
                  f"재고 {r['currentQty']}{r['unit']} / 소요 {r['requiredQty']}{r['unit']}{cover}")
    for w in plan["warnings"]:
        print(f"  ⚠ {w['message']}")
    cc = "일치" if plan["crosscheck"]["match"] else "불일치"
    print(f"■ 발주안 #{plan['planId']} ({len(plan['items'])}건, 서버 추천과 {cc})")
    for i, it in enumerate(plan["items"], 1):
        print(f"  {i}. {it['ingredientName']} {it['orderQty']}{it['unit']}  — {it['reason']}")


def show_review(rev: dict) -> None:
    label = {"execute": "승인 권장", "revise": "조정 후 승인", "wait": "보류 권장"}
    print(f"\n■ 발주 참모 검토 ({label[rev['recommendation']]})\n  {rev['summary']}")
    for it in rev["items"]:
        if it["verdict"] != "approve":
            print(f"  - {it['ingredientId']}: {it['verdict']} → {it['suggestedQty']}  ({it['reason']})")
    for c in rev["concerns"]:
        print(f"  ⚠ {c}")


def apply_review(items: list[dict], rev: dict) -> list[dict]:
    """참모 조정안 적용. 줄이거나 빼는 것만 받아들인다 (늘리는 제안은 무시)."""
    by_id = {r["ingredientId"]: r for r in rev["items"]}
    out = []
    for it in items:
        r = by_id.get(it["ingredientId"])
        if r is None or r["verdict"] == "approve":
            out.append(it)
        elif r["verdict"] == "reduce" and 0 < r["suggestedQty"] < it["orderQty"]:
            out.append({**it, "orderQty": round(r["suggestedQty"], 1), "adjustedBy": "advisor"})
    return out


def save_run(record: dict) -> Path:
    RUNS_DIR.mkdir(exist_ok=True)
    path = RUNS_DIR / f"{datetime.now():%Y%m%d-%H%M%S}-{record['storeId']}-order.json"
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    return path


def run_order(store_id: int, role: str, use_llm: bool, model: str | None) -> int:
    record: dict = {"storeId": store_id, "startedAt": datetime.now().isoformat(), "steps": []}

    try:
        # 로그인 실패도 기록에 남도록 try 안에서 한다
        client = executor.WriteClient(get_token(role))

        def plan_now() -> dict:
            return build_plan(observe(client, store_id))

        plan = plan_now()
        show_plan(plan)

        # 예측이 없거나 오래됐으면 재예측을 제안 (쓰기 → 승인 필요)
        if plan["prediction"]["freshness"] != "fresh":
            if not executor.ai_service_up():
                print("\nAI 예측 서비스(:8000)가 꺼져 있어 재예측할 수 없습니다. ai-service 를 켜고 다시 실행하세요.")
            elif ask("\n재예측을 실행할까요? (오늘 이후 예측을 새로 만듭니다)", "y/N") == "y":
                ok, msg = executor.trigger_prediction(client, store_id)
                record["steps"].append({"step": "trigger_prediction", "ok": ok, "message": msg})
                print(msg)
                if ok:
                    plan = plan_now()
                    show_plan(plan)

        record["plan"] = plan
        if not plan["items"]:
            print("\n발주할 항목이 없습니다.")
            return 0

        review = None
        if use_llm:
            print("\nClaude 가 발주안을 검토하는 중...")
            try:
                review = advisor.review(plan, model=model)
                record["review"] = review
                show_review(review)
            except advisor.AdvisorError as e:
                print(f"검토를 건너뜁니다: {e}")

        choices = "y=발주안 그대로 / a=참모 조정안 적용 / N=취소" if review else "y=발주 / N=취소"
        ans = ask("\n승인하시겠습니까?", choices)
        if ans == "a" and review:
            approved = apply_review(plan["items"], review)
        elif ans == "y":
            approved = plan["items"]
        else:
            print("취소했습니다. 발주하지 않았습니다.")
            record["decision"] = "rejected"
            return 0
        record["decision"] = "approved_adjusted" if ans == "a" else "approved"
        record["approvedItems"] = approved

        # 승인과 실행 사이에 상태가 바뀌었는지 확인
        fresh = plan_now()
        if fresh["planId"] != plan["planId"]:
            print(f"\n승인 후 재고·발주 상태가 바뀌었습니다 (#{plan['planId']} → #{fresh['planId']}). "
                  "발주하지 않았습니다. 다시 실행하세요.")
            record["decision"] = "aborted_state_changed"
            return 1

        results = executor.verify_orders(client, store_id,
                                         executor.place_orders(client, store_id, approved))
        record["results"] = results
        print("\n■ 실행·검증")
        for r in results:
            mark = "✓" if r["verified"] else "✗"
            detail = f"발주 #{r['orderId']}" if r["ok"] else r["error"]
            print(f"  {mark} {r['ingredientName']} {r['orderQty']}{r['unit']}  {detail}")

        after = plan_now()
        record["after"] = {"planId": after["planId"], "remainingItems": after["items"]}
        left = [i["ingredientName"] for i in after["items"]]
        print(f"  남은 부족분: {', '.join(left) if left else '없음'}")
        return 0 if all(r["verified"] for r in results) else 1

    except (ObserveError, RuntimeError, SystemExit, OSError) as e:  # OSError: requests 연결 오류
        print(f"실패: {e}")
        record["error"] = str(e)
        return 1
    finally:
        print(f"\n기록: {save_run(record)}")


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(prog="python -m fgagent", description="FoodGuard 에이전트 러너")
    sub = p.add_subparsers(dest="command", required=True)
    o = sub.add_parser("order", help="발주 참모: 관찰→판단→발주안→승인→실행→검증")
    o.add_argument("store_id", type=int)
    o.add_argument("--as", dest="role", choices=["owner", "hq"], default="owner")
    o.add_argument("--no-llm", action="store_true", help="Claude 검토 없이 실행")
    o.add_argument("--model", help="Claude 모델 (기본: 계정 기본값)")
    a = p.parse_args(argv)
    return run_order(a.store_id, a.role, not a.no_llm, a.model)


if __name__ == "__main__":
    raise SystemExit(main())
