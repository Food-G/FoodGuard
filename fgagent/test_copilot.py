"""Copilot 가드레일·주간 브리핑 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_copilot -v
"""

from __future__ import annotations

import base64
import json
import os
import sys
import unittest
from datetime import date
from types import SimpleNamespace
from unittest import mock

from fgagent import copilot
from fgagent.agents import AGENTS, weekly_brief as wb
from fgagent.runtime import loop
from fgagent.runtime.scheduler import SCHEDULES
from fgagent.test_runtime import _fake_anthropic, _resp
from fgcli.client import FoodGuardClient


def jwt(role: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"role": role, "id": 7}).encode()).decode().rstrip("=")
    return f"header.{payload}.signature"


OWNER = jwt("OWNER")
HQ = jwt("HQ_ADMIN")


def tool(name, **args):
    return SimpleNamespace(type="tool_use", id=f"t-{name}", name=name, input=args)


def text(answer="답변", action="none"):
    return SimpleNamespace(type="text", text=json.dumps({"answer": answer, "action": action}))


class FakeLog:
    last = None

    def __init__(self, client, agent, store_id, trigger, run_id=None):
        self.run_id, self.trigger, self.store_id = run_id or "run-1", trigger, store_id
        FakeLog.last = self
        self.finished = None

    def start(self, model):
        pass

    def finish(self, status, result=None, error=None, model=None, usage=None):
        self.finished = {"status": status, "result": result, "error": error, "usage": usage}


class FakeHttp:
    """서버 대역: 내 매장(1)만 허용한다. 받은 토큰과 경로를 기록한다."""

    def __init__(self):
        self.calls = []

    def __call__(self, url, headers=None, timeout=None):
        self.calls.append((url, headers["Authorization"]))
        allowed = "/1" in url.split("/api/")[1]
        return SimpleNamespace(status_code=200 if allowed else 403, text="",
                               headers={"content-type": "application/json"}, json=lambda: [])


class ChatCase(unittest.TestCase):
    def setUp(self):
        self.http = FakeHttp()
        for p in (mock.patch("fgcli.client.requests.get", self.http),
                  mock.patch.object(copilot, "RunLog", FakeLog),
                  mock.patch.object(copilot, "_log_client", return_value=None)):
            p.start()
            self.addCleanup(p.stop)
        saved = sys.modules.get("anthropic")
        self.addCleanup(lambda: sys.modules.__setitem__("anthropic", saved) if saved else sys.modules.pop("anthropic", None))

    def api(self, *responses):
        mod, calls = _fake_anthropic(list(responses))
        sys.modules["anthropic"] = mod
        p = mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test"})
        p.start()
        self.addCleanup(p.stop)
        return calls


class GuardrailTest(ChatCase):
    def test_다른_매장을_물으면_서버_403_을_그대로_보고한다(self):
        self.api(_resp("tool_use", tool("sales", store_id=999, start="2026-11-01", end="2026-11-06")),
                 _resp("end_turn", text("권한이 없습니다")))
        out = copilot.chat(OWNER, "다른 매장 매출 알려줘", store_id=1)
        self.assertTrue(out["denied"])
        self.assertEqual(out["sources"], [])
        self.assertIn("/api/sales/999/", self.http.calls[0][0])

    def test_모든_조회는_질문한_사람의_토큰으로(self):
        self.api(_resp("tool_use", tool("inventory", store_id=1)), _resp("tool_use", tool("orders-all")),
                 _resp("end_turn", text()))
        with mock.patch.object(copilot, "get_token", side_effect=AssertionError("다른 계정으로 조회하면 안 된다")):
            out = copilot.chat(OWNER, "질문", store_id=1)
        self.assertEqual({auth for _, auth in self.http.calls}, {f"Bearer {OWNER}"})
        self.assertEqual(out["sources"], ["inventory"])
        self.assertTrue(out["denied"])

    def test_도구는_매장에_고정되지_않아_권한_판단은_서버가_한다(self):
        (t,) = copilot.build_tools(["inventory"])
        self.assertIn("store_id", t.spec["input_schema"]["required"])

    def test_쓰기_도구가_없고_클라이언트에_쓰기_메서드가_없다(self):
        names = {t.name for t in copilot.build_tools(copilot.CHAT_TOOLS)}
        self.assertEqual(names, set(copilot.CHAT_TOOLS))
        for name in ("whoami", "plan", "ai-health"):
            self.assertNotIn(name, names)
        for method in ("post", "put", "delete"):
            self.assertFalse(hasattr(FoodGuardClient("t"), method))

    def test_LLM_이_없는_도구를_불러도_실행되지_않는다(self):
        self.api(_resp("tool_use", tool("place_order", ingredientId=1, qty=5)), _resp("end_turn", text()))
        copilot.chat(OWNER, "발주해줘", store_id=1)
        self.assertEqual(self.http.calls, [])


class ActionTest(ChatCase):
    def _ask(self, token, store_id, action="order_plan"):
        self.api(_resp("end_turn", text(action=action)))
        return copilot.chat(token, "발주해줘", store_id=store_id)["action"]

    def test_점주_발주_요청은_버튼으로만_안내(self):
        self.assertEqual(self._ask(OWNER, 1), "order_plan")
        self.assertEqual(self.http.calls, [])   # 조회도 실행도 일어나지 않았다

    def test_매장이_없거나_본사면_안내하지_않는다(self):
        self.assertEqual(self._ask(HQ, None), "none")
        self.assertEqual(self._ask(OWNER, None), "none")


class RecordTest(ChatCase):
    def test_기록에_답변과_토큰이_없다(self):
        self.api(_resp("end_turn", text("비밀스러운 답변 내용")))
        copilot.chat(OWNER, "질문입니다", store_id=1)
        log = FakeLog.last
        self.assertEqual(log.trigger, "CHAT")
        self.assertEqual(log.finished["status"], "OK")
        saved = json.dumps(log.finished, ensure_ascii=False)
        self.assertIn("질문입니다", saved)
        self.assertNotIn("비밀스러운", saved)
        self.assertNotIn(OWNER, saved)

    def test_LLM_실패는_기록하고_알린다(self):
        self.api(_resp("refusal"))
        with self.assertRaises(loop.AgentError):
            copilot.chat(OWNER, "질문", store_id=1)
        self.assertEqual(FakeLog.last.finished["status"], "FAILED")


class LogClientTest(unittest.TestCase):
    def test_계정_문제면_빈_토큰_클라이언트(self):
        for err in (SystemExit("없음"), RuntimeError("로그인 실패"), OSError("연결 실패")):
            with mock.patch.object(copilot, "get_token", side_effect=err):
                self.assertEqual(copilot._log_client().token, "")


class CliFallbackTest(ChatCase):
    def _run(self, token, store_id):
        env = {k: v for k, v in os.environ.items() if k not in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        out = {"output": {"answer": "a", "action": "none"}, "engine": "cli", "model": "m",
               "usage": {}, "toolCalls": []}
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(loop, "_run_cli", return_value=out) as cli:
            result = copilot.chat(token, "질문", store_id=store_id)
        return result, cli.call_args.args[1]

    def test_점주는_자기_매장을_미리_조회해_넣는다(self):
        result, user_input = self._run(OWNER, 1)
        self.assertIn("<조회결과>", user_input)
        self.assertEqual({a for _, a in self.http.calls}, {f"Bearer {OWNER}"})
        self.assertEqual(set(result["sources"]), set(copilot.OWNER_CONTEXT) | {"salesSummary"})

    def test_판매_요약은_일별_매출과_최근7일_메뉴순위(self):
        today = date(2026, 11, 13)
        rows = [
            {"saleDate": "2026-11-12", "quantity": 10, "menu": {"id": 1, "menuName": "불고기", "price": 12000}},
            {"saleDate": "2026-11-12", "quantity": 4, "menu": {"id": 2, "menuName": "냉면", "price": 10000}},
            {"saleDate": "2026-11-10", "quantity": 7, "menu": {"id": 2, "menuName": "냉면", "price": 10000}},
            {"saleDate": "2026-11-01", "quantity": 99, "menu": {"id": 2, "menuName": "냉면", "price": 10000}},  # 7일 밖
        ]
        client = SimpleNamespace(get=lambda path: rows)
        s = copilot.sales_summary(client, 1, today)
        self.assertEqual(s["today"], "2026-11-13")
        self.assertEqual(next(d for d in s["daily"] if d["date"] == "2026-11-12"), {"date": "2026-11-12", "qty": 14, "revenue": 160000})
        self.assertEqual(s["menuQtyLast7Days"]["items"], [{"menuName": "냉면", "qty": 11}, {"menuName": "불고기", "qty": 10}])

    def test_본사_컨텍스트는_본사만(self):
        self._run(OWNER, None)
        self.assertEqual(self.http.calls, [])

    def test_권한_거부도_보고한다(self):
        result, _ = self._run(HQ, None)     # 대역 서버는 전 매장 조회를 403 으로 준다
        self.assertTrue(result["denied"])


class InputTest(unittest.TestCase):
    def test_대화는_최근_것만(self):
        history = [{"role": "user", "content": f"q{i}"} for i in range(15)]
        text_ = copilot.build_input("지금 질문", history, "OWNER", 1)
        self.assertNotIn("q4\n", text_)
        self.assertIn("q5", text_)
        self.assertTrue(text_.endswith("질문: 지금 질문"))

    def test_깨진_토큰이어도_답변_흐름은_서버_권한에_맡긴다(self):
        self.assertIsNone(copilot._role("not-a-jwt"))


class WeeklyTest(unittest.TestCase):
    OBS = {"asOf": "2026-11-09", "weekly": {"thisWeekRevenue": 1200000, "prevWeekRevenue": 1000000},
           "waste": [{"ingredientName": f"품목{i}", "wastePrediction": i, "unit": "kg", "riskLevel": "HIGH"} for i in range(5)]
           + [{"ingredientName": "낮음", "wastePrediction": 0, "unit": "kg", "riskLevel": "LOW"}],
           "orders": [{"status": "REQUESTED"}, {"status": "DONE"}, {"status": "HQ_SENT"}], "live": {"wape": 0.14}}

    def test_수치는_결정적으로(self):
        d = wb.decide(self.OBS)
        self.assertEqual(d["revenueChangePct"], 20.0)
        self.assertEqual((d["wasteRiskCount"], len(d["topWaste"]), d["activeOrders"], d["liveWape"]), (5, 3, 2, 0.14))

    def test_전주_매출이_없어도_계산한다(self):
        d = wb.decide({**self.OBS, "weekly": {"thisWeekRevenue": 10, "prevWeekRevenue": 0}})
        self.assertIsNone(d["revenueChangePct"])
        self.assertIn("전주 매출 없음", wb.to_proposals(d, None)[0]["rationale"])

    def test_폐기_조회_실패는_위험_없음이_아니다(self):
        d = wb.decide({**self.OBS, "waste": None})
        self.assertFalse(d["wasteChecked"])
        self.assertIn("폐기 위험 미확인", wb.to_proposals(d, None)[0]["rationale"])

    def test_카드는_일주일_유지되고_LLM_은_문장만(self):
        (p,) = wb.to_proposals(wb.decide(self.OBS), {"summary": "요약", "revenueChangePct": 999})
        self.assertEqual(p["type"], "WEEKLY_BRIEFING")
        self.assertEqual(p["expiresAt"], "2026-11-16T23:59:59")
        self.assertEqual(p["payload"]["revenueChangePct"], 20.0)
        self.assertEqual(p["rationale"], "요약")

    def test_등록과_스케줄(self):
        self.assertIs(AGENTS["weekly"], wb)
        self.assertEqual(SCHEDULES["weekly"], "0 8 * * 1")


if __name__ == "__main__":
    unittest.main()
