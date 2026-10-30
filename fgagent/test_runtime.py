"""에이전트 공통 런타임 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_runtime -v
"""

from __future__ import annotations

import json
import sys
import types
import unittest
from types import SimpleNamespace

from fgagent.agents import AGENTS, echo, order_advisor
from fgagent.runtime import loop
from fgagent.runtime.tools import MAX_ITEMS, build_tools, run_command


class FakeClient:
    def __init__(self, response):
        self.response = response
        self.paths: list[str] = []

    def get(self, path, base=None):
        self.paths.append(path)
        return self.response


class ToolsTest(unittest.TestCase):
    def test_store_is_bound_and_hidden_from_schema(self):
        (inv,) = build_tools(["inventory"], store_id=60006)
        self.assertNotIn("store_id", inv.spec["input_schema"]["properties"])
        c = FakeClient([])
        inv.run(c, {"store_id": 1})  # 모델이 다른 매장을 넣어도 실행 매장으로 고정
        self.assertEqual(c.paths, ["/api/inventory/60006"])

    def test_unbound_schema_requires_inputs(self):
        (sales,) = build_tools(["sales"])
        schema = sales.spec["input_schema"]
        self.assertEqual(set(schema["required"]), {"store_id", "start", "end"})
        self.assertFalse(schema["additionalProperties"])

    def test_write_or_pathless_commands_are_not_tools(self):
        for name in ("plan", "whoami", "ai-health", "nope"):
            with self.assertRaises(ValueError):
                build_tools([name])

    def test_missing_input_is_reported_not_raised(self):
        out = run_command(FakeClient([]), "sales", {"store_id": 1})
        self.assertEqual(out["error"], "bad_input")

    def test_long_lists_are_truncated_with_notice(self):
        rows = [{"ingredient": {"id": i}} for i in range(MAX_ITEMS + 5)]
        out = run_command(FakeClient(rows), "inventory", {}, bound_store=1)
        self.assertEqual(out["total"], MAX_ITEMS + 5)
        self.assertEqual(len(out["items"]), MAX_ITEMS)
        self.assertIn("truncated", out)

    def test_txns_optional_filters(self):
        (txns,) = build_tools(["txns"], store_id=60006)
        self.assertEqual(txns.spec["input_schema"]["required"], [])
        c = FakeClient([])
        txns.run(c, {})
        txns.run(c, {"from_date": "2026-10-01", "ingredient": 5})
        self.assertEqual(c.paths, ["/api/inventory/60006/txns",
                                   "/api/inventory/60006/txns?from=2026-10-01&ingredientId=5"])

    def test_accuracy_bound_store(self):
        c = FakeClient({})
        run_command(c, "accuracy", {"source": "live"}, bound_store=60006)
        self.assertEqual(c.paths, ["/api/predictions/accuracy?source=live&storeId=60006"])


class EchoTest(unittest.TestCase):
    INV = {"inventory": [
        {"ingredientId": 1, "ingredientName": "양파", "currentQty": 1, "minThreshold": 5, "unit": "kg",
         "belowThreshold": True},
        {"ingredientId": 2, "ingredientName": "소금", "currentQty": 9, "minThreshold": 1, "unit": "kg",
         "belowThreshold": False},
        {"ingredientId": 3, "ingredientName": "빵", "currentQty": 3, "minThreshold": None, "unit": "개",
         "belowThreshold": None},
    ]}

    def test_registered(self):
        self.assertIs(AGENTS["echo"], echo)

    def test_decide_counts_only_below_threshold(self):
        d = echo.decide(self.INV)
        self.assertEqual((d["inventoryCount"], d["lowStockCount"]), (3, 1))

    def test_one_flag_proposal_without_llm(self):
        (p,) = echo.to_proposals(echo.decide(self.INV), None)
        self.assertEqual(p["type"], "ORDER_FLAG")
        self.assertEqual([i["ingredientId"] for i in p["payload"]["items"]], [1])
        self.assertTrue(p["rationale"])

    def test_no_proposal_when_nothing_low(self):
        self.assertEqual(echo.to_proposals(echo.decide({"inventory": []}), None), [])


def _fake_anthropic(responses):
    """anthropic 모듈 대역: 준비한 응답을 순서대로 돌려주고 요청을 기록한다."""
    mod = types.ModuleType("anthropic")
    for name in ("RateLimitError", "APIStatusError", "APIConnectionError"):
        setattr(mod, name, type(name, (Exception,), {}))
    calls = []

    class Messages:
        def create(self, **kw):
            calls.append(kw)
            return responses.pop(0)

    mod.Anthropic = lambda: SimpleNamespace(beta=SimpleNamespace(messages=Messages()))
    return mod, calls


def _resp(stop, *blocks):
    return SimpleNamespace(stop_reason=stop, content=list(blocks), model="claude-sonnet-5-5",
                           usage=SimpleNamespace(input_tokens=10, output_tokens=5))


class LoopTest(unittest.TestCase):
    def setUp(self):
        self._saved = sys.modules.get("anthropic")

    def tearDown(self):
        if self._saved is None:
            sys.modules.pop("anthropic", None)
        else:
            sys.modules["anthropic"] = self._saved

    def test_tool_round_then_structured_answer(self):
        final = {"summary": "양파 부족", "findings": [], "concerns": []}
        mod, calls = _fake_anthropic([
            _resp("tool_use", SimpleNamespace(type="tool_use", id="t1", name="inventory", input={})),
            _resp("end_turn", SimpleNamespace(type="text", text=json.dumps(final))),
        ])
        sys.modules["anthropic"] = mod
        client = FakeClient({"error": "forbidden", "status": 403})
        out = loop._run_api("sys", "in", build_tools(["inventory"], 60006), echo.OUTPUT_SCHEMA,
                            "claude-sonnet-5-5", client, max_turns=4)

        self.assertEqual(out["output"], final)
        self.assertEqual(out["usage"], {"inputTokens": 20, "outputTokens": 10})
        self.assertEqual(out["toolCalls"][0]["error"], "forbidden")
        # 도구 결과는 같은 tool_use_id 로, 오류면 is_error 로 돌려준다
        tool_result = calls[1]["messages"][2]["content"][0]  # user → assistant(tool_use) → user(tool_result)
        self.assertEqual((tool_result["tool_use_id"], tool_result["is_error"]), ("t1", True))
        self.assertEqual(calls[0]["output_config"]["format"]["schema"], echo.OUTPUT_SCHEMA)

    def test_schema_mismatch_retries_once_then_fails(self):
        bad = _resp("end_turn", SimpleNamespace(type="text", text='{"summary": "x"}'))
        mod, _ = _fake_anthropic([bad, bad])
        sys.modules["anthropic"] = mod
        with self.assertRaises(loop.AgentError):
            loop._run_api("sys", "in", [], echo.OUTPUT_SCHEMA, "m", FakeClient([]), max_turns=4)

    def test_refusal_raises(self):
        mod, _ = _fake_anthropic([_resp("refusal")])
        sys.modules["anthropic"] = mod
        with self.assertRaises(loop.AgentError):
            loop._run_api("sys", "in", [], echo.OUTPUT_SCHEMA, "m", FakeClient([]), max_turns=4)


def _plan(items, risks=(), freshness="fresh"):
    return {"storeId": 60006, "asOf": "2026-10-30", "planId": "abcd1234", "items": list(items),
            "risks": list(risks), "warnings": [{"message": "w"}],
            "prediction": {"freshness": freshness}}


def _item(iid, qty):
    return {"ingredientId": iid, "ingredientName": f"식자재{iid}", "unit": "kg", "orderQty": qty,
            "requiredQty": qty + 1, "currentStock": 1, "pendingQty": 0, "reason": "산식"}


class OrderAdvisorTest(unittest.TestCase):
    def review(self, rec, *verdicts):
        return {"summary": "요약", "concerns": ["c"], "recommendation": rec,
                "items": [{"ingredientId": i, "verdict": v, "suggestedQty": q, "reason": "r"} for i, v, q in verdicts]}

    def test_registered_and_scheduled(self):
        from fgagent.runtime.scheduler import SCHEDULES
        self.assertIs(AGENTS["order_advisor"], order_advisor)
        self.assertEqual(SCHEDULES["order_advisor"], "0 8 * * *")

    def test_one_bundled_proposal_with_plan_fingerprint(self):
        (p,) = order_advisor.to_proposals({"plan": _plan([_item(1, 5), _item(2, 3)])}, None)
        self.assertEqual((p["type"], p["fingerprint"]), ("ORDER_CREATE", "abcd1234"))
        self.assertEqual([i["orderQty"] for i in p["payload"]["items"]], [5, 3])

    def test_review_can_only_reduce_or_hold(self):
        rev = self.review("revise", (1, "reduce", 2), (2, "hold", 0), (3, "reduce", 99))
        (p,) = order_advisor.to_proposals({"plan": _plan([_item(1, 5), _item(2, 3), _item(3, 4)])}, rev)
        got = {i["ingredientId"]: (i["planQty"], i["orderQty"]) for i in p["payload"]["items"]}
        self.assertEqual(got, {1: (5, 2), 3: (4, 4)})   # 3: 늘리는 제안은 무시
        self.assertEqual(p["payload"]["held"], ["식자재2"])
        self.assertEqual(p["rationale"], "요약")

    def test_wait_means_no_proposal_but_stable_notification(self):
        d = {"plan": _plan([_item(1, 5)])}
        rev = self.review("wait", (1, "approve", 5))
        self.assertEqual(order_advisor.to_proposals(d, rev), [])
        (n1,) = order_advisor.notifications(d, rev)
        (n2,) = order_advisor.notifications(d, {**rev, "summary": "다른 요약"})
        self.assertEqual(n1, n2)  # 문구가 같아야 서버 24h 중복 금지가 동작

    def test_nothing_to_order(self):
        self.assertEqual(order_advisor.to_proposals({"plan": _plan([])}, None), [])

    def test_stale_prediction_triggers_then_replans(self):
        calls = []
        orig_trigger, orig_plan = order_advisor.executor.trigger_prediction, order_advisor.plan_for
        order_advisor.executor.trigger_prediction = lambda c, s: (calls.append("trigger"), (True, "ok"))[1]
        order_advisor.plan_for = lambda c, s: (calls.append("plan"), _plan([_item(1, 2)]))[1]
        try:
            plan, trig = order_advisor.refresh_if_stale(None, 60006, _plan([], freshness="missing"))
        finally:
            order_advisor.executor.trigger_prediction, order_advisor.plan_for = orig_trigger, orig_plan
        self.assertEqual(calls, ["trigger", "plan"])
        self.assertTrue(trig["ok"])
        self.assertEqual(len(plan["items"]), 1)

    def test_schema_is_strict_for_structured_output(self):
        self.assertFalse(order_advisor.OUTPUT_SCHEMA["additionalProperties"])
        self.assertFalse(order_advisor.OUTPUT_SCHEMA["properties"]["items"]["items"]["additionalProperties"])


if __name__ == "__main__":
    unittest.main()
