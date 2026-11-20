"""폐기 위험 에이전트 결정 로직 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_waste_guard -v
"""

from __future__ import annotations

import unittest
from datetime import date

from fgagent.agents import AGENTS, order_advisor, waste_guard
from fgagent.runtime.scheduler import SCHEDULES


def row(iid=1, name="양상추", risk="HIGH", waste=10.0, expired=0.0, days=2, category="채소류"):
    return {"ingredientId": iid, "ingredientName": name, "unit": "kg", "riskLevel": risk,
            "wastePrediction": waste, "expiredQty": expired, "daysUntilExpiry": days, "category": category}


def recipe(iid, grams):
    return {"ingredient": {"id": iid, "unit": "kg"}, "qtyPerUnit": grams, "unit": "g"}


def obs(*rows):
    return {
        "asOf": "2026-11-06",
        "rows": list(rows),
        "summary": {"basis": "prediction", "warnings": []},
        "menus": [{"id": 10, "menuName": "샐러드"}, {"id": 11, "menuName": "버거"}, {"id": 12, "menuName": "랩"}],
        "recipes": {10: [recipe(1, 100)], 11: [recipe(1, 30)], 12: [recipe(1, 50)]},
        # 사용량: 샐러드 100g×10 = 1kg, 버거 30g×100 = 3kg, 랩 50g×1 = 0.05kg
        "menuQty": {10: 10, 11: 100, 12: 1},
    }


class DecideTest(unittest.TestCase):
    def test_위험_품목은_판촉_감축_기부_후보가_된다(self):
        d = waste_guard.decide(obs(row()))
        self.assertEqual(d["discounts"][0]["menus"], "버거, 샐러드")   # 사용량 많은 Top 2
        self.assertEqual(d["reductions"][0]["reduceQty"], 10.0)
        self.assertEqual(d["donationCandidates"][0]["quantity"], 8.0)   # 폐기 예측 × 0.8
        self.assertEqual(d["disposalCandidates"], [])
        self.assertEqual(d["high"], ["양상추"])

    def test_LOW_는_후보가_없다(self):
        d = waste_guard.decide(obs(row(risk="LOW")))
        self.assertEqual(d["discounts"] + d["reductions"] + d["donationCandidates"] + d["disposalCandidates"], [])

    def test_만료분은_폐기_후보일_뿐_판촉_기부_감축에서_빠진다(self):
        d = waste_guard.decide(obs(row(waste=5.0, expired=5.0, days=-1)))
        self.assertEqual(d["discounts"] + d["reductions"] + d["donationCandidates"], [])
        self.assertEqual(d["disposalCandidates"][0]["qty"], 5.0)

    def test_일부만_만료면_나머지만_대응한다(self):
        d = waste_guard.decide(obs(row(waste=10.0, expired=4.0, days=-1)))
        self.assertEqual(d["reductions"][0]["reduceQty"], 6.0)
        self.assertEqual(d["discounts"][0]["wastePrediction"], 6.0)
        self.assertEqual(d["donationCandidates"], [])   # 대표 기한이 지났으면 기부 후보 아님

    def test_기한이_오늘이면_기부_후보가_아니다(self):
        self.assertEqual(waste_guard.decide(obs(row(days=0)))["donationCandidates"], [])

    def test_허용되지_않은_카테고리는_기부_후보가_아니다(self):
        for category in ("육류", "", None):
            self.assertEqual(waste_guard.decide(obs(row(category=category)))["donationCandidates"], [])


class ProposalsTest(unittest.TestCase):
    def test_후보로_제안을_만들고_감축은_다음날까지_유효(self):
        ps = waste_guard.to_proposals(waste_guard.decide(obs(row())), {"summary": "브리핑", "concerns": ["우려"]})
        self.assertEqual([p["type"] for p in ps], ["DISCOUNT_SUGGEST", "ORDER_REDUCE"])
        self.assertEqual(ps[0]["payload"]["concerns"], ["우려"])
        self.assertEqual(ps[1]["payload"]["validUntil"], "2026-11-07")

    def test_만료분은_폐기_등록_제안만_만든다(self):
        ps = waste_guard.to_proposals(waste_guard.decide(obs(row(waste=5.0, expired=5.0, days=-1))), {"summary": "브리핑"})
        self.assertEqual([p["type"] for p in ps], ["WASTE_RECORD"])
        self.assertEqual(ps[0]["payload"]["items"][0]["qty"], 5.0)
        self.assertEqual(ps[0]["payload"]["items"][0]["reason"], "EXPIRED")
        self.assertIn("실제로 폐기한 뒤", ps[0]["rationale"])

    def test_LLM_없이도_제안한다(self):
        ps = waste_guard.to_proposals(waste_guard.decide(obs(row())), None)
        self.assertTrue(all(p["rationale"] for p in ps))

    def test_위험이_없으면_제안도_알림도_없다(self):
        d = waste_guard.decide(obs(row(risk="LOW")))
        self.assertEqual(waste_guard.to_proposals(d, None), [])
        self.assertEqual(waste_guard.notifications(d, None), [])

    def test_고위험만_알림하고_문구는_고정(self):
        d = waste_guard.decide(obs(row(), row(iid=2, name="대파", risk="MEDIUM")))
        (n,) = waste_guard.notifications(d, None)
        self.assertEqual(n["type"], "WASTE")
        self.assertIn("고위험 1건: 양상추", n["message"])
        self.assertEqual(n, waste_guard.notifications(d, {"summary": "다른 말"})[0])


class FakeClient:
    def __init__(self, proposals):
        self.proposals = proposals

    def get(self, path, base=None):
        return self.proposals


class HintsTest(unittest.TestCase):
    def _p(self, valid_until, *items):
        return {"payload": {"validUntil": valid_until, "items": [
            {"ingredientId": i, "reduceQty": q} for i, q in items]}}

    def test_유효한_힌트만_품목별_최댓값으로(self):
        client = FakeClient([self._p("2026-11-06", (1, 3.0), (2, 1.0)),
                             self._p("2026-11-07", (1, 5.0)),
                             self._p("2026-11-05", (3, 9.0))])
        self.assertEqual(order_advisor.waste_hints(client, 1, date(2026, 11, 6)), {1: 5.0, 2: 1.0})


class WiringTest(unittest.TestCase):
    def test_등록과_스케줄(self):
        self.assertIs(AGENTS["waste"], waste_guard)
        self.assertEqual(SCHEDULES["waste"], "0 9 * * *")


if __name__ == "__main__":
    unittest.main()
