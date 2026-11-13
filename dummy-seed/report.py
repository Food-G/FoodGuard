"""results/*.jsonl → 에이전트별 요약 (markdown)."""
from __future__ import annotations

import json
import statistics
import sys
from collections import Counter

from common import HERE

sys.stdout.reconfigure(encoding="utf-8")
R = HERE / "results"


def rows(agent):
    p = R / f"{agent}.jsonl"
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] if p.exists() else []


def mean(xs):
    xs = [x for x in xs if x is not None]
    return round(statistics.mean(xs), 3) if xs else None


def pct(x):
    return "-" if x is None else f"{x * 100:.1f}%"


def ground(rs):
    n = sum(r.get("grounding", {}).get("numbers", 0) for r in rs)
    g = sum(r.get("grounding", {}).get("grounded", 0) for r in rs)
    return f"{g}/{n} ({pct(g / n)})" if n else "숫자 없음"


def common_line(agent, rs):
    ok = sum(r.get("status") == "OK" for r in rs)
    el = mean([r.get("elapsed") for r in rs])
    tok = mean([(r.get("usage") or {}).get("outputTokens") for r in rs])
    return f"| {agent} | {ok}/{len(rs)} | {el}s | {tok or '-'} | {ground(rs)} |"


def prf_agg(rs, path):
    vals = []
    for r in rs:
        s = r.get("score") or {}
        for k in path:
            s = (s or {}).get(k)
        if s:
            vals.append(s)
    if not vals:
        return "-"
    tp, fp, fn = (sum(v[k] for v in vals) for k in ("tp", "fp", "fn"))
    p = tp / (tp + fp) if tp + fp else 1.0
    r_ = tp / (tp + fn) if tp + fn else 1.0
    return f"정밀도 {pct(p)} · 재현율 {pct(r_)} (TP {tp} / FP {fp} / FN {fn}, {len(vals)}회)"


def main():
    print("| 에이전트 | 성공 | 평균 시간 | 평균 출력 토큰 | LLM 숫자 근거율 |\n|---|---|---|---|---|")
    for a in ("echo", "audit", "order_advisor", "waste", "inbound", "weekly", "hq_review", "mlops"):
        rs = rows(a)
        if rs:
            print(common_line(a, rs))
    print()
    rs = rows("echo")
    if rs:
        print("echo 재고 부족:", prf_agg(rs, ["lowStock"]))
    rs = rows("audit")
    if rs:
        print("감사 이슈 코드:", prf_agg(rs, ["codes"]))
        print("  항목 이름까지 맞음:", Counter(all((r.get("score") or {}).get("itemsNamedCorrectly", {}).values()) for r in rs))
    rs = rows("order_advisor")
    if rs:
        sc = [r["score"] for r in rs if r.get("score")]
        print("발주 참모 위험 라벨 정확도:", mean([s["riskLabelAccuracy"] for s in sc]),
              "| 수량 = 독립 재계산:", Counter(s["orderQtyExact"] for s in sc),
              "| 필수 발주 포함:", Counter(s["mustOrderIncluded"] for s in sc),
              "| 과잉 품목 제외:", Counter(s["mustNotOrderExcluded"] for s in sc))
        print("  오답 라벨:", [s["riskLabelWrong"] for s in sc if s["riskLabelWrong"]][:2], "| 추가 위험:", [s["extraRisks"] for s in sc][:1])
        print("  LLM 권고:", Counter(s.get("llmRecommendation") for s in sc), "| 수량 증가 없음:", Counter(s.get("neverIncreased") for s in sc))
        verdicts = [json.dumps(s.get("llmVerdicts"), sort_keys=True) for s in sc]
        print("  LLM 품목 판정이 5회 모두 같음:", len(set(verdicts)) == 1, "| 판정 분포:",
              Counter(v for s in sc for v in (s.get("llmVerdicts") or {}).values()))
    rs = rows("waste")
    if rs:
        print("폐기 위험 식자재:", prf_agg(rs, ["risky"]))
        print("  HIGH 등급:", prf_agg(rs, ["high"]))
        print("  기부 후보:", prf_agg(rs, ["donationCandidates"]), "| 폐기 후보:", prf_agg(rs, ["disposal"]))
        print("  기부 매칭(이어서 실행):", [((r.get("score") or {}).get("donation") or {}).get("matched") for r in rs],
              "| 지역 일치:", Counter(((r.get("score") or {}).get("donation") or {}).get("orgsInStoreRegion") for r in rs))
    rs = rows("inbound")
    if rs:
        print("입고 지연:", prf_agg(rs, ["delays"]), "| 링크 만료 임박 판정:", Counter((r.get("score") or {}).get("tokenStatusCorrect") for r in rs))
    rs = rows("weekly")
    if rs:
        keys = ("thisWeekRevenue", "prevWeekRevenue", "activeOrders", "wasteRiskCount")
        print("주간 브리핑 수치 일치:", {k: Counter((r.get("score") or {}).get(k) for r in rs) for k in keys})
    rs = rows("hq_review")
    if rs:
        print("본사 심사 이상 발주:", prf_agg(rs, ["anomaly"]))
        cases = Counter()
        for r in rs:
            for o in (r.get("score") or {}).get("orders", []):
                cases[(o["case"], o["recommendation"])] += 1
        for (case, rec), n in sorted(cases.items()):
            print(f"  {case}: {rec} × {n}")
    rs = rows("mlops")
    if rs:
        sc = [r["score"] for r in rs if r.get("score")]
        print("예측 운영: 오래된 모델 감지", Counter(s["staleDetected"] for s in sc), "| 챌린저 학습", Counter(s["challengerTrained"] for s in sc),
              "| 교체 제안", Counter(s["promote"] for s in sc))
        print("  WAPE 챔피언 → 챌린저:", [(s["championWape"], s["challengerWape"], s["wins"]) for s in sc])
    rs = rows("chat")
    if rs:
        by = {}
        for r in rs:
            by.setdefault(r["question"], []).append(r["correct"])
        total = sum(r["correct"] for r in rs)
        print(f"코파일럿 정답률: {total}/{len(rs)} ({pct(total / len(rs))}), 평균 {mean([r['elapsed'] for r in rs])}s")
        for k, v in by.items():
            print(f"  {k}: {sum(v)}/{len(v)}")


if __name__ == "__main__":
    main()
