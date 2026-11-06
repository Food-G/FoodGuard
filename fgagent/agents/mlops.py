"""예측 운영 에이전트 (AG-5): 매일 07:00 성능을 점검하고, 나빠졌으면 챌린저를 학습·비교해 교체를 제안한다.

재예측과 챌린저 학습은 직접 실행한다 (§4.3, 운영 모델은 바뀌지 않음). 운영 모델 교체는 제안 → 본사 승인으로만.
판단 산식은 전부 결정적이고, LLM 은 운영자용 설명만 쓴다.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from fgagent import executor
from fgagent.agents import order_advisor
from fgagent.agents.schema import COMMON_OUTPUT_SCHEMA
from fgcli.planner import ObserveError, _get

NAME = "mlops"
DEFAULT_MODEL = "claude-opus-5-5"
ALLOWED_TOOLS = ["accuracy", "predictions", "sales"]
PROMPT = (Path(__file__).parent.parent / "mlops.md").read_text(encoding="utf-8")
OUTPUT_SCHEMA = COMMON_OUTPUT_SCHEMA

LIVE_WINDOW_DAYS = 7
DRIFT_LIMIT = 0.05       # live WAPE 가 백테스트보다 이만큼(5%p) 나쁘면 드리프트
STALE_DAYS = 7           # 마지막 학습 후 쌓인 판매 일수
PROMOTE_MARGIN = 0.01    # 챌린저가 이만큼(1%p) 나아야 교체 후보
# 시뮬레이션에서 두 정책 차이의 부호가 시드마다 뒤집혀 1%p 만으로는 노이즈를 거르지 못했다.
# 그래서 표본 수와, 기준일 과반에서 이겼는지도 함께 본다.
MIN_COMPARE_ROWS = 28
CHALLENGER_TIMEOUT_SEC = 1800


def _overall(acc) -> dict | None:
    """평가할 이력이 없는 것(no_log, no_actuals)은 정상 상태다. 그 밖의 오류만 실패로 본다."""
    if isinstance(acc, dict) and "error" in acc:
        if acc["error"] in ("no_log", "no_actuals"):
            return None
        raise ObserveError(f"정확도 조회 실패: {acc.get('message')}")
    return acc.get("overall")


def assess(live: dict | None, backtest: dict | None, status: dict) -> dict:
    """성능 신호. 값이 없는 신호는 판단에서 뺀다."""
    live_wape = (live or {}).get("wape")
    base_wape = (live or {}).get("baseline_wape")
    backtest_wape = (backtest or {}).get("wape")
    drift = round(live_wape - backtest_wape, 4) if live_wape is not None and backtest_wape is not None else None
    reasons = []
    if drift is not None and drift > DRIFT_LIMIT:
        reasons.append("drift")
    if status["models"] and status["staleDays"] >= STALE_DAYS:
        reasons.append("stale")
    if live_wape is not None and base_wape is not None and live_wape > base_wape:
        reasons.append("worse_than_baseline")
    return {"liveWape": live_wape, "baselineWape": base_wape, "backtestWape": backtest_wape,
            "drift": drift, "staleDays": status["staleDays"], "reasons": reasons}


def observe(client: executor.WriteClient, store_id: int) -> dict:
    status = _get(client, f"/api/predictions/{store_id}/model-status")
    live = _overall(client.get(f"/api/predictions/accuracy?source=live&storeId={store_id}&windowDays={LIVE_WINDOW_DAYS}"))
    backtest = _overall(client.get(f"/api/predictions/accuracy?source=backtest&storeId={store_id}"))
    signals = assess(live, backtest, status)

    # 예측이 없거나 레시피 있는 메뉴의 예측이 빠졌으면 재예측 (매장당 하루 3회 한도는 서버가 지킨다)
    _, trigger = order_advisor.refresh_if_stale(client, store_id, order_advisor.plan_for(client, store_id))

    comparison, comparison_error = None, None
    if signals["reasons"]:
        code, body = client.post(f"/api/predictions/{store_id}/challenger", timeout=CHALLENGER_TIMEOUT_SEC)
        if code == 200 and isinstance(body, dict):
            comparison = body
        else:
            comparison_error = f"{code}: {str(body)[:200]}"
    pending = _get(client, f"/api/agent/proposals?storeId={store_id}&status=PENDING&type=MODEL_PROMOTE")
    return {
        "storeId": store_id, "asOf": date.today().isoformat(), "signals": signals, "status": status,
        "trigger": trigger, "comparison": comparison, "comparisonError": comparison_error,
        "pendingFingerprints": [p.get("fingerprint") for p in pending],
    }


def should_promote(c: dict | None) -> bool:
    if not c or not c.get("models") or c.get("n", 0) < MIN_COMPARE_ROWS:
        return False
    champion, challenger = c.get("championWape"), c.get("challengerWape")
    if champion is None or challenger is None or challenger >= champion - PROMOTE_MARGIN:
        return False
    return c["challengerWins"] * 2 > c["cutoffs"]


def decide(obs: dict) -> dict:
    c = obs["comparison"]
    warnings = []
    if obs["status"]["coordsFallback"]:
        warnings.append(f"매장 지역 '{obs['status']['region']}'을 시·도로 찾지 못해 서울 날씨로 학습·예측합니다.")
    if obs["trigger"] and not obs["trigger"]["ok"]:
        warnings.append(obs["trigger"]["message"])
    if obs["comparisonError"]:
        warnings.append(f"챌린저 학습 실패: {obs['comparisonError']}")
    if obs["signals"]["liveWape"] is None:
        warnings.append(f"최근 {LIVE_WINDOW_DAYS}일 예측과 대조할 실제 판매가 없어 운영 성능을 평가하지 못했습니다.")
    return {
        "asOf": obs["asOf"], "signals": obs["signals"], "comparison": c, "warnings": warnings,
        "promote": should_promote(c) and c["id"] not in obs["pendingFingerprints"],
        "trigger": obs["trigger"],
    }


def to_proposals(decision: dict, llm: dict | None) -> list[dict]:
    if not decision["promote"]:
        return []
    c = decision["comparison"]
    return [{
        "type": "MODEL_PROMOTE",
        "fingerprint": c["id"],
        "payload": {
            "asOf": decision["asOf"], "reasons": decision["signals"]["reasons"],
            "championWape": c["championWape"], "challengerWape": c["challengerWape"],
            "improvement": round(c["championWape"] - c["challengerWape"], 4),
            "challengerWins": f"{c['challengerWins']}/{c['cutoffs']}", "compareRows": c["n"],
            "championWindowDays": c["championWindowDays"] or "전체 이력",
            "challengerWindowDays": c["challengerWindowDays"] or "전체 이력",
            "models": c["models"], "concerns": (llm or {}).get("concerns", []),
        },
        "rationale": llm["summary"] if llm else
        (f"백테스트 WAPE {c['championWape']:.1%} → {c['challengerWape']:.1%}, 기준일 {c['challengerWins']}/{c['cutoffs']} 우세. "
         "합성 판매 데이터 기준입니다 (Claude 검토 없음)."),
    }]


def notifications(decision: dict, llm: dict | None) -> list[dict]:
    """점검에서 문제가 나왔을 때만 알린다. 문구를 고정해야 24h 중복 금지가 동작한다."""
    reasons = decision["signals"]["reasons"]
    if not reasons:
        return []
    label = {"drift": "성능 하락", "stale": "모델 오래됨", "worse_than_baseline": "기준선보다 나쁨"}
    tail = "모델 교체 제안이 승인함에 있습니다." if decision["promote"] else "교체할 만한 챌린저는 없습니다."
    return [{"type": "ACCURACY",
             "message": f"[예측 운영] {decision['asOf']} {', '.join(label[r] for r in reasons)}. {tail}"}]
