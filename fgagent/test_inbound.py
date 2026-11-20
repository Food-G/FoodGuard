"""입고 추적 규칙 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_inbound -v
"""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest import mock

from fgagent.agents import AGENTS, inbound as ib
from fgagent.runtime import runner, scheduler
from fgcli.planner import ObserveError

NOW = datetime(2026, 11, 6, 12, 0, 0)


def ago(hours: float) -> str:
    return (NOW - timedelta(hours=hours)).isoformat()


def order(oid=1, status="REQUESTED", ordered=100.0, approved=None, updated=None, iid=100, name="패티", store=60006):
    return {"id": oid, "status": status, "store": {"id": store, "storeName": "창신버거"},
            "ingredient": {"id": iid, "name": name}, "orderedAt": ago(ordered),
            "approvedAt": ago(approved) if approved is not None else None,
            "updatedAt": ago(updated) if updated is not None else None}


def decision(*orders, risky=()):
    return ib.decide({"orders": list(orders), "now": NOW.isoformat(), "riskyIngredients": list(risky), "riskAvailable": True})


class ClassifyTest(unittest.TestCase):
    def test_승인_지연_경계(self):
        self.assertIsNone(ib.classify(order(ordered=24), NOW))
        self.assertEqual(ib.classify(order(ordered=24.1), NOW)["kind"], "approval")

    def test_출고_지연은_승인_시각_기준(self):
        for status in ("APPROVED", "HQ_SENT"):
            self.assertIsNone(ib.classify(order(status=status, ordered=500, approved=48), NOW))
            self.assertEqual(ib.classify(order(status=status, ordered=500, approved=48.1), NOW)["kind"], "shipping")

    def test_승인_시각이_없으면_발주_시각으로(self):
        self.assertEqual(ib.classify(order(status="APPROVED", ordered=100), NOW)["kind"], "shipping")

    def test_배송_미완료는_마지막_변경_기준(self):
        self.assertIsNone(ib.classify(order(status="DRIVER_RECEIVED", approved=20, updated=12), NOW))
        self.assertEqual(ib.classify(order(status="DRIVER_RECEIVED", approved=20, updated=12.1), NOW)["kind"], "delivery")

    def test_끝난_발주는_보지_않는다(self):
        for status in ("DONE", "REJECTED", "CANCELLED"):
            self.assertIsNone(ib.classify(order(status=status, ordered=1000), NOW))

    def test_시각이_전혀_없으면_판정하지_않는다(self):
        o = order()
        o["orderedAt"] = None
        self.assertIsNone(ib.classify(o, NOW))

    def test_배달_토큰_만료(self):
        cases = ((30, "valid"), (36, "expiring"), (47, "expiring"), (48, "expired"), (100, "expired"))
        for approved, expected in cases:
            d = ib.classify(order(status="DRIVER_RECEIVED", approved=approved, updated=20), NOW)
            self.assertEqual(d["token"], expected, approved)


class SeverityTest(unittest.TestCase):
    def test_품절_위험_품목이면_high(self):
        d = decision(order(iid=100), order(oid=2, iid=200), risky=[100])
        self.assertEqual({x["orderId"]: x["severity"] for x in d["delays"]}, {1: "high", 2: "medium"})

    def test_위험_판단_실패해도_지연은_알린다(self):
        class C:
            def get(self, path, base=None):
                return [order()]
        with mock.patch.object(ib, "observe_store", side_effect=ObserveError("down")):
            obs = ib.observe(C(), 1)
        self.assertFalse(obs["riskAvailable"])
        self.assertEqual(len(ib.notifications(ib.decide(obs), None)), 1)

    def test_지연이_없으면_위험_조회를_하지_않는다(self):
        class C:
            def get(self, path, base=None):
                return [order(status="DONE")]
        with mock.patch.object(ib, "observe_store") as store:
            ib.observe(C(), 1)
        store.assert_not_called()


class NotificationTest(unittest.TestCase):
    def test_수신자(self):
        by = lambda *o: sorted(n["audience"] for n in ib.notifications(decision(*o), None))
        self.assertEqual(by(order()), ["HQ"])
        self.assertEqual(by(order(status="APPROVED", approved=100)), ["HQ", "OWNER"])
        self.assertEqual(by(order(status="DRIVER_RECEIVED", approved=20, updated=20)), ["OWNER"])

    def test_본사_문구와_점주_문구가_달라야_둘_다_저장된다(self):
        # 서버는 매장·타입·문구가 같으면 중복으로 거른다
        a, b = ib.notifications(decision(order(status="HQ_SENT", approved=100)), None)
        self.assertNotEqual(a["message"], b["message"])

    def test_시간이_지나도_문구가_같아야_중복이_걸러진다(self):
        o = [order(), order(oid=2, status="APPROVED", approved=100)]
        first = ib.notifications(decision(*o), None)
        later = ib.notifications(ib.decide({"orders": o, "now": (NOW + timedelta(hours=5)).isoformat(),
                                            "riskyIngredients": [], "riskAvailable": True}), None)
        self.assertEqual(first, later)

    def test_여러_건은_묶어서_한_번만(self):
        orders = [order(oid=i, name=f"품목{i}") for i in range(1, 8)]
        (n,) = ib.notifications(decision(*orders), None)
        self.assertIn("승인 지연 7건", n["message"])
        self.assertIn("품목1, 품목2, 품목3 외 4건", n["message"])
        self.assertIn("#5…", n["message"])

    def test_품절_위험_표시(self):
        (n,) = ib.notifications(decision(order(), risky=[100]), None)
        self.assertIn("[품절 위험]", n["message"])

    def test_만료된_기사_링크_안내(self):
        (n,) = ib.notifications(decision(order(status="DRIVER_RECEIVED", approved=100, updated=20)), None)
        self.assertIn("점주 검수로 완료", n["message"])

    def test_LLM_과_제안을_쓰지_않는다(self):
        d = decision(order())
        self.assertFalse(ib.needs_llm(d))
        self.assertEqual(ib.to_proposals(d, None), [])


class PollTest(unittest.TestCase):
    def setUp(self):
        scheduler._inbound_seen.clear()
        self.addCleanup(scheduler._inbound_seen.clear)

    def test_지연_있는_매장만(self):
        orders = [order(store=1), order(oid=2, status="DONE", store=2)]
        self.assertEqual(scheduler.stores_with_new_delays(orders, NOW, 1000.0), [1])

    def test_그대로면_실행하지_않고_바뀌거나_하루_지나면_실행(self):
        orders = [order(store=1)]
        scheduler._inbound_seen[1] = (ib.delay_key(orders, NOW), 1000.0)
        self.assertEqual(scheduler.stores_with_new_delays(orders, NOW, 1001.0), [])
        self.assertEqual(scheduler.stores_with_new_delays(orders, NOW, 1000.0 + scheduler.INBOUND_REPEAT_SEC), [1])
        self.assertEqual(scheduler.stores_with_new_delays(orders + [order(oid=2, store=1)], NOW, 1001.0), [1])

    def test_지연이_풀리면_한_번_더_실행해_기록을_비운다(self):
        delayed, resolved = [order(store=1)], [order(store=1, status="DONE")]
        self.assertEqual(scheduler.stores_with_new_delays(resolved, NOW, 1000.0), [])   # 처음부터 지연 없음
        scheduler._inbound_seen[1] = (ib.delay_key(delayed, NOW), 1000.0)
        self.assertEqual(scheduler.stores_with_new_delays(resolved, NOW, 1001.0), [1])
        scheduler._inbound_seen[1] = (ib.delay_key(resolved, NOW), 1001.0)
        self.assertEqual(scheduler.stores_with_new_delays(resolved, NOW, 1001.0 + scheduler.INBOUND_REPEAT_SEC), [])

    def test_지연이_풀린_실행은_알림을_보내지_않는다(self):
        self.assertEqual(ib.notifications(decision(order(status="DONE")), None), [])

    def test_실패하면_다음_시간에_다시(self):
        client = mock.Mock()
        client.get.return_value = [order(store=1, ordered=100)]
        with mock.patch.object(scheduler, "get_token", return_value="t"), \
                mock.patch.object(scheduler, "WriteClient", return_value=client), \
                mock.patch.object(runner, "run", return_value={"status": "FAILED"}) as run:
            scheduler.poll_inbound()
        run.assert_called_once_with("inbound", 1, trigger="SCHEDULE", use_llm=False)
        self.assertEqual(scheduler._inbound_seen, {})

    def test_로그인_실패는_폴링만_건너뛴다(self):
        with mock.patch.object(scheduler, "get_token", side_effect=SystemExit("자격증명 없음")):
            scheduler.poll_inbound()


class WiringTest(unittest.TestCase):
    def test_등록(self):
        self.assertIs(AGENTS["inbound"], ib)
        self.assertEqual(scheduler.INBOUND_POLL, "0 * * * *")


if __name__ == "__main__":
    unittest.main()
