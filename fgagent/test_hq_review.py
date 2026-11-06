"""본사 발주 심사 산식 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_hq_review -v
"""

from __future__ import annotations

import unittest
from unittest import mock

from fgagent.agents import AGENTS, hq_review as hq
from fgagent.runtime import runner, scheduler

AT = "2026-11-06T10:00:00"


def order(oid=1, qty=10.0, iid=100, status="REQUESTED", at=AT, store=60006):
    return {"id": oid, "status": status, "orderedQty": qty, "orderedAt": at, "store": {"id": store},
            "ingredient": {"id": iid, "name": "패티", "unit": "kg"}}


def obs(target=None, others=(), required=10.0, stock=0.0, days=7, waste=()):
    target = target or order()
    return {"targets": [target], "orders": [target, *others], "stock": {100: stock},
            "requiredByIngredient": {100: required}, "predictionDays": days,
            "wasteHigh": list(waste), "wasteAvailable": True}


def codes(r):
    return [f["code"] for f in r["flags"]]


class RatioPlanTest(unittest.TestCase):
    def test_경계(self):
        for qty, pts in ((15.0, 0), (15.1, 30), (20.0, 30), (20.1, 45)):
            self.assertEqual(hq.score_order(order(qty=qty), obs())["score"], pts, qty)

    def test_예측_일수로_7일에_맞춘다(self):
        # 14일 예측에 소요 20kg → 7일 10kg 이므로 15.1kg 는 1.5배 초과
        self.assertEqual(hq.score_order(order(qty=15.1), obs(required=20.0, days=14))["score"], 30)

    def test_소요량이_없으면_최고점(self):
        r = hq.score_order(order(), obs(required=0.0))
        self.assertEqual(codes(r), ["no_demand"])
        self.assertEqual(r["score"], 45)

    def test_예측이_없으면_소요량_항목은_빠진다(self):
        r = hq.score_order(order(qty=1000.0), obs(days=0, required=0.0))
        self.assertEqual(r["score"], 0)


class HistoryTest(unittest.TestCase):
    def test_4주_평균의_2배_초과(self):
        past = order(oid=2, qty=4.0, status="DONE", at="2026-10-20T10:00:00")
        self.assertEqual(codes(hq.score_order(order(qty=8.0), obs(others=[past]))), [])
        self.assertIn("ratio_hist", codes(hq.score_order(order(qty=8.1), obs(others=[past]))))

    def test_취소_거절과_4주_이전_이후는_평균에서_뺀다(self):
        others = [order(oid=2, qty=1.0, status="CANCELLED", at="2026-10-20T10:00:00"),
                  order(oid=3, qty=1.0, status="REJECTED", at="2026-10-20T10:00:00"),
                  order(oid=4, qty=1.0, status="DONE", at="2026-09-01T10:00:00"),
                  order(oid=5, qty=1.0, status="DONE", at="2026-11-06T11:00:00")]
        self.assertNotIn("ratio_hist", codes(hq.score_order(order(qty=10.0), obs(others=others))))

    def test_이력이_없으면_점수_없음(self):
        self.assertNotIn("ratio_hist", codes(hq.score_order(order(qty=10.0), obs())))


class StockCoverTest(unittest.TestCase):
    def test_자기_자신은_대기발주에_넣지_않는다(self):
        # 재고 0 에 7일 소요량만큼 발주: 정상 발주가 자기 수량 때문에 '재고 충분'으로 잡히면 안 된다
        self.assertEqual(hq.score_order(order(qty=10.0), obs(stock=0.0))["score"], 0)

    def test_재고와_다른_대기발주로_충분하면_감점(self):
        other = order(oid=2, qty=8.0, status="APPROVED", at="2026-11-01T10:00:00")
        self.assertEqual(codes(hq.score_order(order(qty=1.0), obs(others=[other], stock=4.1))), ["stock_cover"])
        self.assertEqual(hq.score_order(order(qty=1.0), obs(others=[other], stock=4.1))["score"], 20)
        self.assertEqual(codes(hq.score_order(order(qty=1.0), obs(others=[other], stock=4.0))), [])   # 정확히 1.2배


class DuplicateTest(unittest.TestCase):
    def test_24시간_안의_승인_대기(self):
        near = order(oid=2, qty=1.0, at="2026-11-05T10:00:00")
        far = order(oid=3, qty=1.0, at="2026-11-05T09:59:00")
        self.assertIn("duplicate", codes(hq.score_order(order(qty=1.0), obs(others=[near]))))
        self.assertNotIn("duplicate", codes(hq.score_order(order(qty=1.0), obs(others=[far]))))

    def test_다른_식자재는_중복이_아니다(self):
        other = order(oid=2, iid=200, at=AT)
        self.assertNotIn("duplicate", codes(hq.score_order(order(qty=1.0), obs(others=[other]))))

    def test_이미_승인된_발주는_중복이_아니다(self):
        other = order(oid=2, qty=1.0, status="APPROVED", at=AT)
        self.assertNotIn("duplicate", codes(hq.score_order(order(qty=1.0), obs(others=[other]))))


class ScoreTest(unittest.TestCase):
    def test_과다_발주는_거절_권고와_근거(self):
        past = order(oid=2, qty=5.0, status="DONE", at="2026-10-20T10:00:00")
        r = hq.score_order(order(qty=100.0), obs(others=[past], stock=20.0, waste=[100]))
        self.assertEqual(r["recommendation"], "reject")
        self.assertGreaterEqual(r["score"], hq.REJECT_SCORE)
        self.assertEqual(set(codes(r)), {"ratio_plan", "ratio_hist", "stock_cover", "waste_link"})
        self.assertTrue(all(f["detail"] for f in r["flags"]))

    def test_점수는_100을_넘지_않는다(self):
        others = [order(oid=2, qty=1.0, status="DONE", at="2026-10-20T10:00:00"), order(oid=3, qty=1.0, at=AT)]
        r = hq.score_order(order(qty=1000.0), obs(others=others, stock=100.0, waste=[100]))
        self.assertEqual(r["score"], 100)

    def test_권고_경계(self):
        self.assertEqual(hq.score_order(order(qty=10.0), obs(waste=[100]))["recommendation"], "approve")   # 15
        self.assertEqual(hq.score_order(order(qty=15.1), obs())["recommendation"], "review")               # 30
        self.assertEqual(hq.score_order(order(qty=15.1), obs(waste=[100]))["recommendation"], "review")    # 45
        other = order(oid=2, qty=10.0, at=AT)   # 중복 +15, 4주 평균 대비는 2배 이내, 재고 충분도 아님
        r = hq.score_order(order(qty=15.1), obs(others=[other], waste=[100]))
        self.assertEqual((r["score"], r["recommendation"]), (60, "reject"))


class ProposalTest(unittest.TestCase):
    def test_LLM_은_점수를_바꿀_수_없다(self):
        d = hq.decide(obs(order(qty=100.0)))
        before = d["reviews"][0]["score"]
        (p,) = hq.to_proposals(d, {"summary": "s", "concerns": [],
                                   "items": [{"orderId": 1, "explanation": "설명", "score": 0, "recommendation": "approve"}]})
        self.assertEqual(p["type"], "ORDER_FLAG")
        self.assertEqual(p["payload"]["score"], before)
        self.assertEqual(p["payload"]["recommendation"], "review" if before < 60 else "reject")
        self.assertEqual(p["rationale"], "설명")

    def test_LLM_설명이_없으면_산식_근거를_쓴다(self):
        (p,) = hq.to_proposals(hq.decide(obs(order(qty=100.0))), None)
        self.assertIn("배입니다", p["rationale"])

    def test_이상이_없어도_심사_기록은_남긴다(self):
        (p,) = hq.to_proposals(hq.decide(obs(order(qty=1.0))), None)
        self.assertEqual(p["payload"]["recommendation"], "approve")
        self.assertTrue(p["rationale"])

    def test_전부_승인_권고면_LLM_을_부르지_않는다(self):
        self.assertFalse(hq.needs_llm(hq.decide(obs(order(qty=1.0)))))
        self.assertTrue(hq.needs_llm(hq.decide(obs(order(qty=100.0)))))

    def test_심사_대상이_없으면_아무것도_안_한다(self):
        d = hq.decide({"targets": [], "orders": []})
        self.assertEqual(hq.to_proposals(d, None), [])
        self.assertFalse(hq.needs_llm(d))

    def test_폐기_예측이_없으면_경고(self):
        d = hq.decide({**obs(), "wasteAvailable": False})
        self.assertIn("폐기 예측", d["warnings"][0])

    def test_심사_대상은_승인_대기_중_미심사만(self):
        orders = [order(1), order(2, status="APPROVED"), order(3)]
        out = hq.unreviewed(orders, [{"payload": {"orderId": 1}, "agent": "hq_review"}])
        self.assertEqual([o["id"] for o in out], [3])


class FakeClient:
    def __init__(self, orders, flags=()):
        self.orders, self.flags = orders, list(flags)
        self.proposal_calls = 0

    def get(self, path, base=None):
        if path == "/api/orders/admin/all":
            return self.orders
        self.proposal_calls += 1
        return self.flags


class PollTest(unittest.TestCase):
    def setUp(self):
        scheduler._failed_at.clear()
        self.addCleanup(scheduler._failed_at.clear)

    def test_미심사_발주가_있는_매장만_고른다(self):
        client = FakeClient([order(1, store=1), order(2, store=2, status="DONE"), order(3, store=3)],
                            [{"agent": "hq_review", "payload": {"orderId": 3}}])
        self.assertEqual(scheduler.stores_to_review(client, 1e9), [1])
        self.assertEqual(client.proposal_calls, 2)     # 승인 대기가 없는 매장은 조회도 안 한다

    def test_다른_에이전트의_ORDER_FLAG_는_심사로_치지_않는다(self):
        client = FakeClient([order(1)], [{"agent": "echo", "payload": {"lowStockCount": 1}}])
        self.assertEqual(scheduler.stores_to_review(client, 1e9), [60006])

    def test_실패한_매장은_한_시간_쉰다(self):
        scheduler._failed_at[60006] = 1000.0
        client = FakeClient([order(1)])
        self.assertEqual(scheduler.stores_to_review(client, 1000.0 + scheduler.FAILURE_BACKOFF_SEC - 1), [])
        self.assertEqual(scheduler.stores_to_review(client, 1000.0 + scheduler.FAILURE_BACKOFF_SEC), [60006])

    def test_한_매장_실패_후_성공하면_쉬는_기록을_지운다(self):
        client = FakeClient([order(1)])
        with mock.patch.object(scheduler, "get_token", return_value="t"), \
                mock.patch.object(scheduler, "WriteClient", return_value=client), \
                mock.patch.object(runner, "run", return_value={"status": "FAILED"}) as run:
            scheduler.poll_hq_review()
            self.assertIn(60006, scheduler._failed_at)
            run.assert_called_once_with("hq_review", 60006, trigger="EVENT")
            scheduler._failed_at[60006] = 0.0
            run.return_value = {"status": "OK"}
            scheduler.poll_hq_review()
            self.assertNotIn(60006, scheduler._failed_at)

    def test_로그인_실패는_폴링만_건너뛴다(self):
        with mock.patch.object(scheduler, "get_token", side_effect=SystemExit("자격증명 없음")):
            scheduler.poll_hq_review()


class WiringTest(unittest.TestCase):
    def test_등록(self):
        self.assertIs(AGENTS["hq_review"], hq)
        self.assertNotIn("hq_review", scheduler.SCHEDULES)   # 전 매장 실행이 아니라 폴링으로 돈다


if __name__ == "__main__":
    unittest.main()
