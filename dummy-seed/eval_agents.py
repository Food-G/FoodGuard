"""에이전트 반복 실행 + 채점. 결과는 dummy-seed/results/<agent>.jsonl 에 한 줄씩 쌓인다.

    ai-service/venv/Scripts/python.exe dummy-seed/eval_agents.py echo audit order_advisor waste inbound weekly --n 5
    ai-service/venv/Scripts/python.exe dummy-seed/eval_agents.py hq_review --n 5
    ai-service/venv/Scripts/python.exe dummy-seed/eval_agents.py mlops --n 5
    FG_OWNER_EMAIL=... FG_OWNER_PASSWORD=... ai-service/venv/Scripts/python.exe dummy-seed/eval_agents.py chat --n 5

정답: 시드가 심은 시나리오(ground_truth.json) + DB 에서 독립 재계산한 값.
LLM 근거율: LLM 이 쓴 문장 속 숫자가 결정 데이터(decision) 안의 숫자로 설명되는 비율.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
import time
import traceback
from datetime import date, datetime, timedelta

import requests

from common import HERE, MANIFEST, STORE, TRUTH, UNIT_RULES, connect, dump, ingredient_need, load, recipes

sys.stdout.reconfigure(encoding="utf-8")
RESULTS = HERE / "results"
RESULTS.mkdir(exist_ok=True)
API = "http://localhost:8080"


def db():
    conn = connect()
    conn.autocommit(True)
    return conn.cursor()


def q(c, sql, *a):
    c.execute(sql, a)
    return c.fetchall()


def round1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10.0


def prf(pred: set, gold: set) -> dict:
    tp, fp, fn = len(pred & gold), len(pred - gold), len(gold - pred)
    p = tp / (tp + fp) if tp + fp else 1.0
    r = tp / (tp + fn) if tp + fn else 1.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(p, 3), "recall": round(r, 3),
            "f1": round(2 * p * r / (p + r), 3) if p + r else 0.0,
            "missed": sorted(gold - pred, key=str), "extra": sorted(pred - gold, key=str)}


# ── LLM 근거율 ──────────────────────────────────────────────────────
_DATE = re.compile(r"\d{4}-\d{2}-\d{2}|\d{1,2}/\d{1,2}|\d{1,2}월\s*\d{1,2}일|\d{4}년|#\d+|\d{1,2}시")


def numbers_in(text: str) -> list[float]:
    text = _DATE.sub(" ", text or "")
    out = []
    for m in re.finditer(r"(-?\d[\d,]*\.?\d*)\s*(만|천)?", text):
        try:
            v = float(m.group(1).replace(",", ""))
        except ValueError:
            continue
        out.append(v * (10000 if m.group(2) == "만" else 1000 if m.group(2) == "천" else 1))
    return out


def facts(obj, acc=None) -> set[float]:
    acc = set() if acc is None else acc
    if isinstance(obj, bool) or obj is None:
        return acc
    if isinstance(obj, (int, float)):
        for v in (obj, abs(obj), obj * 100, abs(obj) * 100):
            acc.update({v, round(v), round(v, 1), round(v, 2)})
    elif isinstance(obj, str):
        for v in numbers_in(obj):
            acc.add(v)
    elif isinstance(obj, dict):
        for v in obj.values():
            facts(v, acc)
    elif isinstance(obj, (list, tuple)):
        acc.add(len(obj))
        for v in obj:
            facts(v, acc)
    return acc


def grounding(text: str, decision) -> dict:
    nums = [n for n in numbers_in(text) if n not in (0, 1)]
    if not nums:
        return {"numbers": 0, "grounded": 0, "ungrounded": []}
    f = facts(decision)
    # 서로 더하거나 뺀 값(예: 합계, 증감)도 근거로 본다 — 작은 집합에서만
    small = sorted(x for x in f if abs(x) < 1e9)
    bad = [n for n in nums if not any(abs(n - x) <= max(0.051, abs(x) * 0.01) for x in small)]
    return {"numbers": len(nums), "grounded": len(nums) - len(bad), "ungrounded": bad[:8]}


def llm_text(rec) -> str:
    out = ((rec.get("result") or {}).get("llm") or {}).get("output") or {}
    parts = [out.get("summary", "")]
    for k in ("concerns",):
        parts += [str(x) for x in out.get(k, [])]
    for k in ("items", "actions", "matches"):
        for it in out.get(k, []) or []:
            parts += [str(it.get(f, "")) for f in ("reason", "action", "explanation", "draft", "message")]
    return "\n".join(p for p in parts if p)


# ── 독립 재계산 (oracle) ────────────────────────────────────────────

def oracle_plan(c) -> dict:
    rec = recipes(c)
    preds = q(c, "SELECT menu_id, target_date, predicted_qty FROM prediction_result WHERE store_id=%s AND target_date>=CURDATE()", STORE)
    days = len({p["target_date"] for p in preds})
    menu_total: dict[int, float] = {}
    for p in preds:
        menu_total[p["menu_id"]] = menu_total.get(p["menu_id"], 0) + p["predicted_qty"]
    req = ingredient_need(menu_total, rec)
    inv = {r["ingredient_id"]: float(r["current_qty"]) for r in q(c, "SELECT ingredient_id, current_qty FROM inventory WHERE store_id=%s", STORE)}
    pend: dict[int, float] = {}
    for o in q(c, "SELECT ingredient_id, ordered_qty FROM order_request WHERE store_id=%s AND status IN ('REQUESTED','APPROVED')", STORE):
        pend[o["ingredient_id"]] = pend.get(o["ingredient_id"], 0) + float(o["ordered_qty"])
    qty = {iid: round1(max(0.0, round1(req.get(iid, 0)) - round1(inv.get(iid, 0)) - round1(pend.get(iid, 0))))
           for iid in set(req) | set(inv)}
    return {"days": days, "required": req, "orderQty": {k: v for k, v in qty.items() if v > 0}}


def names(c) -> dict[int, str]:
    return {r["ingredient_id"]: r["ingredient_name"] for r in q(c, "SELECT ingredient_id, ingredient_name FROM ingredient")}


# ── 채점 ────────────────────────────────────────────────────────────

def score_echo(rec, truth, c):
    d = rec["result"]["decision"]
    return {"lowStock": prf({i["ingredientId"] for i in d["lowStock"]}, set(truth["echo"]["lowStock"]))}


def score_audit(rec, truth, c):
    d = rec["result"]["decision"]
    found = {f["code"]: f for f in d["findings"]}
    gold = set(truth["audit"]["expected"])
    items_ok = {code: all(any(n in str(x) for x in found[code]["items"]) for n in want)
                for code, want in truth["audit"]["items"].items() if code in found}
    return {"codes": prf(set(found), gold), "itemsNamedCorrectly": items_ok, "notChecked": d["notChecked"]}


def score_order_advisor(rec, truth, c):
    plan = rec["result"]["decision"]["plan"]
    t = truth["order_advisor"]
    risk = {r["ingredientId"]: r["risk"] for r in plan["risks"]}
    planted = {iid: label for label in ("stockout", "below_threshold", "awaiting_delivery", "waste") for iid in t[label]}
    label_ok = {iid: risk.get(iid) == want for iid, want in planted.items()}
    extra_risks = {iid: r for iid, r in risk.items() if iid not in planted}
    items = {i["ingredientId"]: i["orderQty"] for i in plan["items"]}
    o = oracle_plan(c)
    qty_match = [abs(items.get(iid, 0) - want) <= 0.11 for iid, want in o["orderQty"].items()]
    qty_extra = [iid for iid in items if iid not in o["orderQty"]]
    must = set(t["stockout"]) | set(t["below_threshold"])
    out = {
        "riskLabelAccuracy": round(sum(label_ok.values()) / len(label_ok), 3),
        "riskLabelWrong": {k: (planted[k], risk.get(k)) for k, ok in label_ok.items() if not ok},
        "extraRisks": extra_risks,
        "orderQtyMatchesOracle": f"{sum(qty_match)}/{len(qty_match)}", "orderQtyExact": all(qty_match) and not qty_extra,
        "mustOrderIncluded": sorted(must - set(items)) == [], "mustNotOrderExcluded": not (set(t["mustNotOrder"]) & set(items)),
        "predictionDays": plan["prediction"]["days"], "crosscheck": plan["crosscheck"]["match"],
        "warnings": [w["type"] for w in plan["warnings"]],
    }
    llm = (rec["result"].get("llm") or {}).get("output")
    if llm:
        out["llmRecommendation"] = llm.get("recommendation")
        out["llmVerdicts"] = {str(i["ingredientId"]): i["verdict"] for i in llm.get("items", [])}
        # 안전 규칙: 승인함에 올라간 수량은 산식 수량을 넘지 않는다
        props = q(c, "SELECT payload FROM AGENT_PROPOSAL WHERE run_id=%s AND type='ORDER_CREATE'", rec["runId"])
        if props:
            pl = json.loads(props[0]["payload"]) if isinstance(props[0]["payload"], str) else props[0]["payload"]
            out["neverIncreased"] = all(float(i["orderQty"]) <= float(i["planQty"]) + 1e-9 for i in pl["items"])
            out["proposedItems"] = len(pl["items"])
    return out


def score_waste(rec, truth, c):
    d = rec["result"]["decision"]
    t = truth["waste"]
    nm = names(c)
    by_name = {v: k for k, v in nm.items() if 60001 <= k <= 60020}
    risky = {x["ingredientId"] for k in ("reductions", "disposalCandidates", "discounts") for x in d[k]}
    high = {by_name.get(n) for n in d["high"]}
    out = {"risky": prf(risky, set(t["HIGH"]) | set(t["MEDIUM"])), "high": prf(high, set(t["HIGH"])),
           "donationCandidates": prf({x["ingredientId"] for x in d["donationCandidates"]}, set(t["donation"])),
           "disposal": prf({x["ingredientId"] for x in d["disposalCandidates"]}, set(t["disposal"])),
           "proposalTypes": sorted({p.get("type", "?") for p in rec["result"].get("proposals", []) if isinstance(p, dict)})}
    # 이어서 실행된 기부 매칭
    don = q(c, "SELECT run_id, status, result_json FROM AGENT_RUN WHERE agent='donation' AND store_id=%s AND started_at>=%s "
               "ORDER BY started_at LIMIT 1", STORE, datetime.fromisoformat(rec["startedAt"]) - timedelta(seconds=5))
    if don:
        r = json.loads(don[0]["result_json"]) if isinstance(don[0]["result_json"], str) else (don[0]["result_json"] or {})
        dd = (r or {}).get("decision") or {}
        matches = dd.get("matches", [])
        orgs_ok = all(o["region"] == "서울" for m in matches for o in m["orgs"])
        out["donation"] = {"status": don[0]["status"], "matched": sorted(m["ingredientId"] for m in matches),
                           "unmatched": dd.get("unmatched"), "orgsInStoreRegion": orgs_ok,
                           "grounding": grounding(llm_text({"result": r}), dd)}
    return out


def score_inbound(rec, truth, c):
    d = rec["result"]["decision"]
    gold = {(int(k), v.split("_")[1].split("+")[0]) for k, v in truth["inbound"].items() if v.startswith("delay")}
    pred = {(x["orderId"], x["kind"]) for x in d["delays"]}
    tok = {x["orderId"]: x.get("token") for x in d["delays"] if x["kind"] == "delivery"}
    want_tok = {int(k): "expiring" for k, v in truth["inbound"].items() if "token_expiring" in v}
    return {"delays": prf(pred, gold), "tokenStatusCorrect": all(tok.get(k) == v for k, v in want_tok.items()),
            "notifications": len(rec["result"]["notifications"])}


def score_weekly(rec, truth, c):
    d = rec["result"]["decision"]
    today = date.today()

    def rev(a, b):
        r = q(c, "SELECT IFNULL(SUM(s.quantity*m.price),0) v FROM sales_data s JOIN menu m USING(menu_id) "
                 "WHERE s.store_id=%s AND s.is_deleted=0 AND s.sales_date BETWEEN %s AND %s", STORE, a, b)
        return int(r[0]["v"])
    this_w, prev_w = rev(today - timedelta(days=6), today), rev(today - timedelta(days=13), today - timedelta(days=7))
    active = q(c, "SELECT COUNT(*) n FROM order_request WHERE store_id=%s AND status IN ('REQUESTED','APPROVED','HQ_SENT','DRIVER_RECEIVED')", STORE)[0]["n"]
    return {"thisWeekRevenue": d["thisWeekRevenue"] == this_w, "prevWeekRevenue": d["prevWeekRevenue"] == prev_w,
            "oracle": {"this": this_w, "prev": prev_w, "active": active}, "activeOrders": d["activeOrders"] == active,
            "wasteRiskCount": d["wasteRiskCount"] == len(truth["waste"]["HIGH"]) + len(truth["waste"]["MEDIUM"]),
            "revenueChangePct": d["revenueChangePct"]}


def score_mlops(rec, truth, c):
    d = rec["result"]["decision"]
    comp = d.get("comparison") or {}
    return {"reasons": d["signals"]["reasons"], "staleDetected": "stale" in d["signals"]["reasons"],
            "staleDays": d["signals"]["staleDays"], "backtestWape": d["signals"]["backtestWape"],
            "challengerTrained": bool(comp.get("models")), "championWape": comp.get("championWape"),
            "challengerWape": comp.get("challengerWape"), "wins": f"{comp.get('challengerWins')}/{comp.get('cutoffs')}",
            "promote": d["promote"], "warnings": d["warnings"]}


SCORERS = {"echo": score_echo, "audit": score_audit, "order_advisor": score_order_advisor, "waste": score_waste,
           "inbound": score_inbound, "weekly": score_weekly, "mlops": score_mlops}


def save(agent: str, row: dict) -> None:
    with (RESULTS / f"{agent}.jsonl").open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")


def run_once(agent: str, i: int, truth: dict) -> dict:
    from fgagent.runtime import runner
    t0 = time.time()
    rec = runner.run(agent, STORE, trigger="MANUAL")
    row = {"agent": agent, "round": i, "runId": rec["runId"], "status": rec.get("status"), "elapsed": round(time.time() - t0, 1),
           "model": rec.get("model"), "usage": rec.get("usage"), "error": rec.get("error"), "warnings": rec.get("warnings")}
    if rec.get("status") == "OK" or (rec.get("result") or {}).get("decision"):
        try:
            row["score"] = SCORERS[agent](rec, truth, db())
        except Exception as e:  # 채점 실패는 실행 실패와 구분한다
            row["scoreError"] = f"{type(e).__name__}: {e}"
            traceback.print_exc()
        text = llm_text(rec)
        if text:
            row["llmSummary"] = ((rec["result"].get("llm") or {}).get("output") or {}).get("summary")
            row["grounding"] = grounding(text, rec["result"]["decision"])
    return row


# ── 본사 발주 심사: 라운드마다 라벨 붙은 발주를 넣고 심사 결과를 채점 ─────

def hq_round(i: int, truth: dict) -> dict:
    from fgagent.runtime import runner
    c = db()
    o = oracle_plan(c)
    per7 = {iid: v / o["days"] * 7 for iid, v in o["required"].items()}

    def qty(iid, k):
        unit = q(c, "SELECT unit FROM ingredient WHERE ingredient_id=%s", iid)[0]["unit"]
        v = per7[iid] * k
        return float(max(1, round(v))) if unit == "개" else round(v, 2)
    now = datetime.now().replace(microsecond=0)
    batch = [  # (ingredient, qty, minutes ago, label, case)
        (60001, qty(60001, 0.6), 5, "normal", "적정 수량"), (60003, qty(60003, 0.6), 5, "normal", "적정 수량"),
        (60015, qty(60015, 0.6), 5, "normal", "적정 수량"),
        (60006, qty(60006, 4.0), 4, "anomaly", "7일 소요량의 4배"),
        (60020, qty(60020, 0.8), 4, "anomaly", "재고 과잉+폐기 위험 식자재"),
        (60018, 2.0, 4, "anomaly", "소요 없는 식자재"),
        (60005, qty(60005, 0.9), 50, "anomaly", "중복 발주 1"), (60005, qty(60005, 0.9), 3, "anomaly", "중복 발주 2"),
        (60017, qty(60017, 1.8), 3, "anomaly", "7일 소요량의 1.8배 + 대기발주 있음"),
    ]
    before = {r["order_id"] for r in q(c, "SELECT order_id FROM order_request WHERE store_id=%s", STORE)}
    for iid, qv, mins, *_ in batch:
        at = now - timedelta(minutes=mins)
        c.execute("INSERT INTO order_request (store_id, ingredient_id, status, ordered_qty, ordered_at, updated_at) "
                  "VALUES (%s,%s,'REQUESTED',%s,%s,%s)", (STORE, iid, qv, at, at))
    new = q(c, "SELECT order_id, ingredient_id, ordered_qty FROM order_request WHERE store_id=%s AND status='REQUESTED'", STORE)
    new = [r for r in new if r["order_id"] not in before]
    m = load(MANIFEST)
    m["inserted"].setdefault("order_request", []).extend(r["order_id"] for r in new)
    dump(MANIFEST, m)
    labels, used = {}, set()
    for iid, qv, _, label, case in batch:
        r = next(r for r in new if r["ingredient_id"] == iid and r["order_id"] not in used and abs(float(r["ordered_qty"]) - qv) < 0.01)
        used.add(r["order_id"])
        labels[r["order_id"]] = (label, case, iid)

    t0 = time.time()
    rec = runner.run("hq_review", STORE, trigger="MANUAL")
    elapsed = round(time.time() - t0, 1)
    time.sleep(1)
    flags = {}
    for p in q(c, "SELECT run_id, payload FROM AGENT_PROPOSAL WHERE store_id=%s AND agent='hq_review' AND type='ORDER_FLAG'", STORE):
        pl = json.loads(p["payload"]) if isinstance(p["payload"], str) else p["payload"]
        if pl["orderId"] in labels:
            flags[pl["orderId"]] = (pl["recommendation"], pl["score"], [f["code"] for f in pl["flags"]], p["run_id"])
    rows = [{"orderId": oid, "label": lab, "case": case, "recommendation": flags.get(oid, (None,))[0],
             "score": flags.get(oid, (None, None))[1], "flags": flags.get(oid, (None, None, None))[2],
             "byThisRun": flags.get(oid, (None,) * 4)[3] == rec["runId"]} for oid, (lab, case, _) in labels.items()]
    pred = {r["orderId"] for r in rows if r["recommendation"] in ("review", "reject")}
    gold = {r["orderId"] for r in rows if r["label"] == "anomaly"}
    unscored = [r["orderId"] for r in rows if r["recommendation"] is None]
    # 다음 라운드에 섞이지 않게 취소
    c.execute(f"UPDATE order_request SET status='CANCELLED' WHERE order_id IN ({','.join(map(str, labels))})")
    row = {"agent": "hq_review", "round": i, "runId": rec["runId"], "status": rec.get("status"), "elapsed": elapsed,
           "model": rec.get("model"), "usage": rec.get("usage"), "score": {"anomaly": prf(pred, gold), "unscored": unscored, "orders": rows}}
    text = llm_text(rec)
    if text:
        row["grounding"] = grounding(text, rec["result"]["decision"])
        row["llmSummary"] = ((rec["result"].get("llm") or {}).get("output") or {}).get("summary")
    return row


# ── 코파일럿: 정답을 아는 질문 ──────────────────────────────────────

def chat_questions(c) -> list[dict]:
    today = date.today()
    y = today - timedelta(days=1)
    yrev = int(q(c, "SELECT IFNULL(SUM(s.quantity*m.price),0) v FROM sales_data s JOIN menu m USING(menu_id) "
                    "WHERE s.store_id=%s AND s.is_deleted=0 AND s.sales_date=%s", STORE, y)[0]["v"])
    top = q(c, "SELECT m.menu_name, SUM(s.quantity) n FROM sales_data s JOIN menu m USING(menu_id) WHERE s.store_id=%s "
               "AND s.is_deleted=0 AND s.sales_date BETWEEN %s AND %s GROUP BY m.menu_name ORDER BY n DESC LIMIT 1",
            STORE, today - timedelta(days=7), y)[0]["menu_name"]
    low = [r["ingredient_name"] for r in q(c, "SELECT i.ingredient_name FROM inventory v JOIN ingredient i USING(ingredient_id) "
                                              "WHERE v.store_id=%s AND v.current_qty < v.min_threshold", STORE)]
    active = q(c, "SELECT COUNT(*) n FROM order_request WHERE store_id=%s AND status IN ('REQUESTED','APPROVED','HQ_SENT','DRIVER_RECEIVED')", STORE)[0]["n"]
    nm_pred = int(q(c, "SELECT IFNULL(SUM(p.predicted_qty),0) v FROM prediction_result p JOIN menu m USING(menu_id) "
                       "WHERE p.store_id=%s AND m.menu_name='냉면' AND p.target_date>=CURDATE()", STORE)[0]["v"])
    return [
        {"id": "yesterday_revenue", "q": "어제 우리 매장 매출 합계는 얼마야?", "num": yrev, "tol": 0.01},
        {"id": "low_stock", "q": "지금 최소 재고보다 적은 식자재가 뭐가 있어?", "names": low},
        {"id": "top_menu", "q": "최근 7일 동안 가장 많이 팔린 메뉴는 뭐야?", "names": [top]},
        {"id": "active_orders", "q": "지금 진행 중인 발주는 몇 건이야?", "num": active, "tol": 0},
        {"id": "naengmyeon_forecast", "q": "냉면의 앞으로 예측 판매량 합계는 몇 개야?", "num": nm_pred, "tol": 0.02},
        {"id": "spinach_waste", "q": "시금치 폐기 위험은 어느 정도야?", "any": ["높", "HIGH", "고위험", "위험도가 높"]},
    ]


REFUSAL = ("확인할 수 없", "알 수 없", "조회 결과에 없", "데이터가 없")


def grade(item: dict, answer: str) -> bool:
    # "확인할 수 없습니다. 참고로 예측 1위는 불고기" 같은 답이 이름만 보고 정답 처리되지 않게
    if any(p in answer[:80] for p in REFUSAL):
        return False
    if "num" in item:
        return any(abs(v - item["num"]) <= max(item["tol"] * abs(item["num"]), 0.5) for v in numbers_in(answer))
    if "names" in item:
        return all(n.replace(" ", "") in answer.replace(" ", "") for n in item["names"])
    return any(k in answer for k in item["any"])


def chat_round(i: int, token: str) -> list[dict]:
    from fgagent import copilot
    rows = []
    for item in chat_questions(db()):
        t0 = time.time()
        try:
            r = copilot.chat(token, item["q"], [], STORE)
            ans, ok = r.get("answer", ""), grade(item, r.get("answer", ""))
        except Exception as e:
            ans, ok, r = f"ERROR {type(e).__name__}: {e}", False, {}
        rows.append({"agent": "chat", "round": i, "question": item["id"], "expected": {k: v for k, v in item.items() if k not in ("q", "id")},
                     "correct": ok, "elapsed": round(time.time() - t0, 1), "answer": ans, "sources": r.get("sources")})
        print(f"  [{i}] {item['id']}: {'O' if ok else 'X'} ({rows[-1]['elapsed']}s)", flush=True)
    return rows


def owner_token() -> str:
    r = requests.post(f"{API}/api/auth/login", json={"email": os.environ["FG_OWNER_EMAIL"], "password": os.environ["FG_OWNER_PASSWORD"]}, timeout=20)
    r.raise_for_status()
    try:
        body = r.json()
    except ValueError:
        return r.text.strip()  # /api/auth/login 은 토큰을 평문으로 돌려준다
    return body if isinstance(body, str) else body.get("token") or body.get("accessToken") or body["data"]["token"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("agents", nargs="+")
    ap.add_argument("--n", type=int, default=5)
    a = ap.parse_args()
    truth = load(TRUTH)
    for agent in a.agents:
        print(f"== {agent} × {a.n}", flush=True)
        if agent == "chat":
            token = owner_token()
            for i in range(1, a.n + 1):
                for row in chat_round(i, token):
                    save("chat", row)
            continue
        for i in range(1, a.n + 1):
            try:
                row = hq_round(i, truth) if agent == "hq_review" else run_once(agent, i, truth)
            except Exception as e:
                traceback.print_exc()
                row = {"agent": agent, "round": i, "status": "HARNESS_ERROR", "error": f"{type(e).__name__}: {e}"}
            save(agent, row)
            brief = {k: row.get(k) for k in ("status", "elapsed")}
            print(f"  [{i}] {brief} score={json.dumps(row.get('score'), ensure_ascii=False, default=str)[:400]}", flush=True)


if __name__ == "__main__":
    main()
