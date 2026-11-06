"""데이터 품질 감사 점검 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_auditor -v
"""

from __future__ import annotations

import unittest
from datetime import date

from fgagent.agents import AGENTS, auditor as a
from fgagent.runtime.scheduler import SCHEDULES

TODAY = date(2026, 11, 6)


def inv(iid=1, name="양파", qty=5.0, threshold=1.0):
    return {"ingredient": {"id": iid, "name": name}, "currentQty": qty, "minThreshold": threshold, "unit": "kg"}


def recipe(iid=1, name="양파", unit="g", base="kg"):
    return {"ingredient": {"id": iid, "name": name, "unit": base}, "unit": unit}


def order(oid=1, status="REQUESTED", at="2026-11-01T10:00:00"):
    return {"id": oid, "status": status, "orderedAt": at, "ingredient": {"name": "양파"}}


def txn(tid, qty_after, delta, iid=1):
    return {"id": tid, "ingredientId": iid, "qtyAfter": qty_after, "deltaQty": delta}


def clean_obs(**over):
    base = {"asOf": TODAY.isoformat(), "inventory": [inv()], "menus": [{"id": 10, "menuName": "버거"}],
            "recipes": {10: [recipe()]}, "orders": [order()], "sales": [{"id": 1}], "txns": [],
            "ingredients": [{"id": 1, "name": "양파", "unit": "kg"}],
            "status": {"coordsFallback": False, "region": "경남"}}
    base.update(over)
    return base


class CheckTest(unittest.TestCase):
    def test_음수_재고는_심각이_아니다(self):
        f = a.check_negative_stock([inv(qty=-2.0), inv(iid=2, name="대파", qty=0.0)])
        self.assertEqual(f["severity"], "medium")
        self.assertEqual(f["count"], 1)
        self.assertIsNone(a.check_negative_stock([inv()]))

    def test_임계치_0_또는_NULL(self):
        self.assertEqual(a.check_threshold([inv(threshold=0), inv(threshold=None), inv(threshold=1)])["count"], 2)

    def test_레시피_없는_메뉴(self):
        menus = [{"id": 10, "menuName": "버거"}, {"id": 11, "menuName": "샐러드"}]
        f = a.check_menu_without_recipe(menus, {10: [recipe()], 11: []})
        self.assertEqual(f["items"], ["샐러드"])
        self.assertEqual(f["severity"], "high")

    def test_단위_비호환(self):
        menus = [{"id": 10, "menuName": "버거"}]
        self.assertIsNone(a.check_recipe_units(menus, {10: [recipe(unit="g", base="kg"), recipe(unit="개", base="개")]}))
        for unit, base in (("ml", "kg"), ("g", "L"), ("g", "g")):
            self.assertEqual(a.check_recipe_units(menus, {10: [recipe(unit=unit, base=base)]})["count"], 1, (unit, base))

    def test_7일_넘은_진행_중_발주(self):
        orders = [order(1, at="2026-10-30T10:00:00"),   # 7일 → 아직 아님
                  order(2, at="2026-10-29T10:00:00"),   # 8일
                  order(3, status="HQ_SENT", at="2026-10-01T10:00:00"),
                  order(4, status="DRIVER_RECEIVED", at="2026-10-01T10:00:00"),   # 점검 대상 상태가 아님
                  order(5, status="DONE", at="2026-10-01T10:00:00")]
        self.assertEqual([o["id"] for o in a.stuck_orders(orders, TODAY)], [2, 3])

    def test_지역_폴백(self):
        self.assertIsNone(a.check_region({"coordsFallback": False, "region": "경남"}))
        self.assertEqual(a.check_region({"coordsFallback": True, "region": None})["items"], ["(비어 있음)"])

    def test_판매_공백(self):
        self.assertEqual(a.check_sales_gap([])["count"], 1)
        self.assertIsNone(a.check_sales_gap([{"id": 1}]))

    def test_이름_중복은_이_매장이_쓸_때만(self):
        rows = [{"id": 1, "name": "양파", "unit": "개"}, {"id": 2, "name": "양파", "unit": "kg"},
                {"id": 3, "name": "대파", "unit": "kg"}]
        self.assertEqual(a.check_duplicate_names(rows, {2})["items"], ["양파: #1(개), #2(kg)"])
        self.assertIsNone(a.check_duplicate_names(rows, {3}))


class LedgerTest(unittest.TestCase):
    def test_원장_적용_전_재고가_있어도_합계로_오판하지_않는다(self):
        # 합계는 -2 인데 재고는 3 — 시작 잔량이 원장 밖에 있을 뿐 정상이다
        txns = [txn(2, 3.0, -1.0), txn(1, 4.0, -1.0)]
        self.assertIsNone(a.check_ledger([inv(qty=3.0)], txns))

    def test_최신_잔량과_재고가_다르면_불일치(self):
        f = a.check_ledger([inv(qty=2.0)], [txn(2, 3.0, -1.0), txn(1, 4.0, -1.0)])
        self.assertIn("원장 3.0 ↔ 재고 2.0", f["items"][0])
        self.assertEqual(f["severity"], "high")

    def test_행이_이어지지_않으면_불일치(self):
        f = a.check_ledger([inv(qty=3.0)], [txn(2, 3.0, -1.0), txn(1, 9.0, -1.0)])
        self.assertIn("#2", f["items"][0])

    def test_반올림_오차는_허용(self):
        self.assertIsNone(a.check_ledger([inv(qty=3.33)], [txn(1, 3.333, -1.0)]))

    def test_재고_행이_지워졌으면_0_으로_본다(self):
        self.assertIsNone(a.check_ledger([], [txn(1, 0.0, -3.0)]))
        self.assertEqual(a.check_ledger([], [txn(1, 2.0, -1.0)])["count"], 1)


class DecideTest(unittest.TestCase):
    def test_깨끗하면_아무것도_없다(self):
        d = a.decide(clean_obs())
        self.assertEqual((d["findings"], d["notChecked"], d["checked"]), ([], [], 9))
        self.assertEqual(a.to_proposals(d, None), [])
        self.assertEqual(a.notifications(d, None), [])
        self.assertFalse(a.needs_llm(d))

    def test_조회_실패는_이상_없음이_아니라_not_checked(self):
        d = a.decide(clean_obs(txns=None, status=None, recipes=None))
        self.assertEqual(sorted(d["notChecked"]), ["ledger_mismatch", "menu_no_recipe", "recipe_unit", "region_fallback"])
        self.assertEqual(d["checked"], 5)

    def test_심각도_순_정렬(self):
        d = a.decide(clean_obs(inventory=[inv(qty=-1.0, threshold=0)], recipes={10: []}))
        self.assertEqual([f["severity"] for f in d["findings"]], ["high", "medium", "low"])

    def test_한_점검이_실패해도_나머지는_돈다(self):
        d = a.decide(clean_obs(orders=None, sales=[]))
        self.assertIn("order_stuck", d["notChecked"])
        self.assertEqual([f["code"] for f in d["findings"]], ["sales_gap"])


class OutputTest(unittest.TestCase):
    def _d(self):
        return a.decide(clean_obs(recipes={10: []}, sales=[]))

    def test_정보_카드_1장(self):
        (p,) = a.to_proposals(self._d(), None)
        self.assertEqual(p["type"], "AUDIT_REPORT")
        self.assertEqual([i["severity"] for i in p["payload"]["items"]], ["high", "medium"])
        self.assertTrue(p["rationale"])

    def test_LLM_은_조치_문구만_바꾼다(self):
        (p,) = a.to_proposals(self._d(), {"summary": "요약", "actions": [
            {"code": "menu_no_recipe", "action": "점주: 버거 레시피 등록", "severity": "low"}]})
        first = p["payload"]["items"][0]
        self.assertEqual(first["action"], "점주: 버거 레시피 등록")
        self.assertEqual(first["severity"], "high")
        self.assertEqual(p["rationale"], "요약")

    def test_예시는_5개까지(self):
        menus = [{"id": i, "menuName": f"m{i}"} for i in range(7)]
        (p,) = a.to_proposals(a.decide(clean_obs(menus=menus, recipes={i: [] for i in range(7)})), None)
        item = p["payload"]["items"][0]
        self.assertIn("7건", item["title"])
        self.assertEqual(item["examples"], "m0, m1, m2, m3, m4 외")

    def test_저위험만_있으면_카드도_LLM_도_없다(self):
        d = a.decide(clean_obs(inventory=[inv(threshold=0)]))
        self.assertEqual([f["severity"] for f in d["findings"]], ["low"])
        self.assertEqual(a.to_proposals(d, None), [])
        self.assertFalse(a.needs_llm(d))

    def test_HIGH_만_알림(self):
        (n,) = a.notifications(self._d(), None)
        self.assertEqual(n["type"], "AUDIT")
        self.assertIn("레시피 없는 활성 메뉴 1건", n["message"])
        self.assertEqual(a.notifications(a.decide(clean_obs(sales=[])), None), [])


class ObserveTest(unittest.TestCase):
    def test_전부_실패하면_감사_성공으로_치지_않는다(self):
        class Down:
            def get(self, path):
                return {"error": "network", "message": "down"}
        with self.assertRaises(RuntimeError):
            a.observe(Down(), 1)

    def test_원장_503_은_해당_점검만_건너뛴다(self):
        class C:
            def get(self, path):
                if path.endswith("/txns"):
                    return {"error": "http_error", "status": 503}
                if "model-status" in path:
                    return {"coordsFallback": False, "region": "경남"}
                return []
        self.assertIn("ledger_mismatch", a.decide(a.observe(C(), 1))["notChecked"])


class WiringTest(unittest.TestCase):
    def test_등록과_스케줄(self):
        self.assertIs(AGENTS["audit"], a)
        self.assertEqual(SCHEDULES["audit"], "30 6 * * *")


if __name__ == "__main__":
    unittest.main()
