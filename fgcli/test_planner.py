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
        "pendingOrders": [{"id": 1, "ingredientId": 100, "qty": 2.0, "status": "REQUESTED"}],
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

    def test_서버_불일치_경고(self):
        p = build_plan(obs(serverRecommend=[{"ingredientId": 100, "orderQty": 8400}]), TODAY)
        self.assertFalse(p["crosscheck"]["match"])
        self.assertIn("crosscheck_mismatch", [w["type"] for w in p["warnings"]])

    def test_최근_판매가_없으면_경고(self):
        types = [w["type"] for w in build_plan(obs(recentSalesDays=0), TODAY)["warnings"]]
        self.assertIn("sales_stale", types)
        self.assertNotIn("sales_stale", [w["type"] for w in build_plan(obs(), TODAY)["warnings"]])

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
