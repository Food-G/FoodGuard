"""planner 단위 테스트 (네트워크 없음).  python -m unittest fgcli.test_planner"""

import unittest
from datetime import date

from fgcli.planner import build_plan

TODAY = date(2026, 10, 16)


def obs(**over):
    base = {
        "storeId": 1,
        "menus": [{"id": 10, "menuName": "불고기버거"}],
        "recipes": {10: [
            {"ingredientId": 100, "ingredientName": "패티", "baseUnit": "kg",
             "qtyPerUnit": 100, "recipeUnit": "g", "tolerancePct": 10},
            {"ingredientId": 200, "ingredientName": "번", "baseUnit": "개",
             "qtyPerUnit": 1, "recipeUnit": "개", "tolerancePct": 0},
        ]},
        # 7일 × 20개 = 140개
        "predictions": [{"menuId": 10, "date": f"2026-10-{16 + d}", "qty": 20} for d in range(7)],
        "inventory": [
            {"ingredientId": 100, "ingredientName": "패티", "unit": "kg", "currentQty": 5.0, "minThreshold": 0},
            {"ingredientId": 200, "ingredientName": "번", "unit": "개", "currentQty": 500.0, "minThreshold": 0},
        ],
        "pendingOrders": [{"id": 1, "ingredientId": 100, "qty": 2.0, "status": "REQUESTED", "orderedAt": "2026-10-15"}],
        # 패티: 100g × 140 × 1.1 = 15.4kg − 5 − 2 = 8.4kg
        "serverRecommend": [{"ingredientId": 100, "orderQty": 8.4}],
    }
    base.update(over)
    return base


class PlannerTest(unittest.TestCase):
    def test_서버와_같은_산식(self):
        p = build_plan(obs(), TODAY)
        self.assertEqual([(i["ingredientId"], i["orderQty"]) for i in p["items"]], [(100, 8.4)])
        self.assertTrue(p["crosscheck"]["match"])
        self.assertEqual(p["prediction"]["freshness"], "fresh")

    def test_과잉재고는_폐기위험(self):
        risks = {r["ingredientId"]: r["risk"] for r in build_plan(obs(), TODAY)["risks"]}
        self.assertEqual(risks[200], "waste")      # 번 500개 > 140 × 2
        self.assertNotIn(100, risks)               # 패티 (5+2) / 하루 2.2kg = 3.2일분 → 위험 아님

    def test_버틸_날이_2일_미만이면_품절위험(self):
        inv = [{"ingredientId": 100, "ingredientName": "패티", "unit": "kg", "currentQty": 1.0, "minThreshold": 0},
               obs()["inventory"][1]]
        p = build_plan(obs(inventory=inv, serverRecommend=[{"ingredientId": 100, "orderQty": 12.4}]), TODAY)
        risks = {r["ingredientId"]: r for r in p["risks"]}
        self.assertEqual(risks[100]["risk"], "stockout")   # (1+2)/2.2 = 1.4일분
        self.assertEqual(risks[100]["coverDays"], 1.4)
        self.assertTrue(p["crosscheck"]["match"])

    def test_폐기_힌트만큼_줄이고_서버_대조는_힌트_전_수량으로(self):
        p = build_plan(obs(), TODAY, waste_hints={100: 3.0})
        item = p["items"][0]
        self.assertEqual(item["orderQty"], 5.4)
        self.assertIn("폐기 위험 감축 3.0", item["reason"])
        self.assertTrue(p["crosscheck"]["match"])
        self.assertIn("waste_hint_applied", [w["type"] for w in p["warnings"]])
        self.assertNotEqual(p["planId"], build_plan(obs(), TODAY)["planId"])

    def test_폐기_힌트가_발주량보다_크면_항목이_빠진다(self):
        p = build_plan(obs(), TODAY, waste_hints={100: 100.0})
        self.assertEqual(p["items"], [])
        self.assertTrue(p["crosscheck"]["match"])

    def test_서버_불일치_경고(self):
        p = build_plan(obs(serverRecommend=[{"ingredientId": 100, "orderQty": 8400}]), TODAY)
        self.assertFalse(p["crosscheck"]["match"])
        self.assertIn("crosscheck_mismatch", [w["type"] for w in p["warnings"]])

    def test_최근_판매가_없으면_경고(self):
        types = [w["type"] for w in build_plan(obs(recentSalesDays=0), TODAY)["warnings"]]
        self.assertIn("sales_stale", types)
        self.assertNotIn("sales_stale", [w["type"] for w in build_plan(obs(), TODAY)["warnings"]])

    def test_레시피_있는_메뉴의_예측이_빠지면_재예측_대상(self):
        # 실제로 겪은 상황: 레시피 없는 메뉴(20)의 예측만 남아 있었다
        o = obs(menus=[{"id": 10, "menuName": "불고기버거"}, {"id": 20, "menuName": "신메뉴"}],
                predictions=[{"menuId": 20, "date": f"2026-10-{17 + d}", "qty": 0} for d in range(7)],
                serverRecommend=[])
        p = build_plan(o, TODAY)
        self.assertEqual(p["prediction"]["freshness"], "stale")
        self.assertIn("prediction_partial", [w["type"] for w in p["warnings"]])

    def test_재고_없이_대기발주에만_기대면_입고대기_위험(self):
        # 실제로 겪은 상황: 소고기 재고 0, 소요 전부를 넉 달 묵은 REQUESTED 발주가 메우고 있었다
        inv = [{"ingredientId": 100, "ingredientName": "패티", "unit": "kg", "currentQty": 0.0, "minThreshold": 0},
               obs()["inventory"][1]]
        pend = [{"id": 9, "ingredientId": 100, "ingredientName": "패티", "qty": 20.0, "status": "REQUESTED",
                 "orderedAt": "2026-06-19"}]
        p = build_plan(obs(inventory=inv, pendingOrders=pend, serverRecommend=[]), TODAY)
        risks = {r["ingredientId"]: r["risk"] for r in p["risks"]}
        self.assertEqual(risks[100], "awaiting_delivery")
        self.assertEqual(p["items"], [])   # 수량 산식은 서버와 같게 유지 (경고로만 알린다)
        stale = [w for w in p["warnings"] if w["type"] == "pending_stale"]
        self.assertEqual(stale[0]["orderIds"], [9])
        # 어떤 식자재의 발주인지 문구에 있어야 LLM 이 다른 식자재에 연결하지 않는다
        self.assertEqual(stale[0]["ingredientIds"], [100])
        self.assertIn("#9 패티", stale[0]["message"])

    def test_최근_발주는_오래됨_경고_없음(self):
        self.assertNotIn("pending_stale", [w["type"] for w in build_plan(obs(), TODAY)["warnings"]])

    def test_예측없으면_발주안_없음(self):
        p = build_plan(obs(predictions=[], serverRecommend=[]), TODAY)
        self.assertEqual(p["items"], [])
        self.assertEqual(p["prediction"]["freshness"], "missing")

    def test_비호환_단위는_계산에서_제외하고_경고(self):
        recipes = {10: [{"ingredientId": 100, "ingredientName": "패티", "baseUnit": "kg",
                         "qtyPerUnit": 100, "recipeUnit": "ml", "tolerancePct": 0}]}
        p = build_plan(obs(recipes=recipes, serverRecommend=[]), TODAY)
        self.assertIn("unit_incompatible", [w["type"] for w in p["warnings"]])
        self.assertEqual(p["items"], [])

    def test_상태가_바뀌면_planId_도_바뀐다(self):
        a = build_plan(obs(), TODAY)["planId"]
        b = build_plan(obs(pendingOrders=[]), TODAY)["planId"]
        self.assertNotEqual(a, b)
        self.assertEqual(a, build_plan(obs(), TODAY)["planId"])


if __name__ == "__main__":
    unittest.main()
