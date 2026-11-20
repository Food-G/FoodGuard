"""기부 매칭 에이전트 결정 로직 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_donation_matcher -v
"""

from __future__ import annotations

import unittest
from unittest import mock

from fgagent.agents import AGENTS, donation_matcher as dm, waste_guard
from fgagent.runtime import runner


def cand(iid=1, name="양상추", category="채소류", qty=8.0, days=2):
    return {"ingredientId": iid, "ingredientName": name, "unit": "kg", "category": category,
            "quantity": qty, "daysUntilExpiry": days}


ORG_A = {"id": 3, "orgName": "[예시] 가상 푸드뱅크 경남", "orgType": "FOOD_BANK", "region": "경남"}
ORG_B = {"id": 4, "orgName": "[예시] 가상 아동시설 경남", "orgType": "ORPHANAGE", "region": "경남"}


def obs(*candidates, orgs=None, busy=()):
    return {"storeId": 1, "candidates": list(candidates),
            "orgsByCategory": orgs if orgs is not None else {"채소류": [ORG_A, ORG_B], "빵류": [ORG_B]},
            "busyIngredientIds": list(busy)}


def llm(*matches, concerns=()):
    return {"summary": "요약", "matches": list(matches), "concerns": list(concerns)}


class DecideTest(unittest.TestCase):
    def test_수량은_AG2_산출값_그대로(self):
        (m,) = dm.decide(obs(cand(qty=8.0)))["matches"]
        self.assertEqual(m["quantity"], 8.0)
        self.assertEqual([o["orgId"] for o in m["orgs"]], [3, 4])

    def test_기한이_1일_미만이면_제외(self):
        self.assertEqual(dm.decide(obs(cand(days=0)))["matches"], [])

    def test_이미_제안했거나_기부_예정이면_다시_제안하지_않는다(self):
        self.assertEqual(dm.decide(obs(cand(), busy=[1]))["matches"], [])

    def test_맞는_기관이_없으면_unmatched(self):
        d = dm.decide(obs(cand(), orgs={}))
        self.assertEqual(d["matches"], [])
        self.assertEqual(d["unmatched"], ["양상추"])

    def test_상온이_확실하지_않으면_콜드체인_확인을_강제(self):
        self.assertEqual(dm.decide(obs(cand()))["matches"][0]["concerns"], [dm.COLD_CHAIN_CONCERN])
        self.assertEqual(dm.decide(obs(cand(category="빵류")))["matches"][0]["concerns"], [])


class ProposalsTest(unittest.TestCase):
    def _one(self, verdict):
        (p,) = dm.to_proposals(dm.decide(obs(cand())), verdict)
        return p

    def test_LLM_추천_기관과_초안을_쓴다(self):
        p = self._one(llm({"ingredientId": 1, "orgId": 4, "reason": "이유", "draftMessage": "초안"}, concerns=["우려"]))
        self.assertEqual(p["type"], "DONATION_CREATE")
        self.assertEqual(p["payload"]["orgId"], 4)
        self.assertEqual(p["payload"]["draftMessage"], "초안")
        self.assertEqual(p["rationale"], "이유")
        self.assertEqual(p["payload"]["donationType"], "INGREDIENT")
        self.assertEqual(p["payload"]["concerns"], [dm.COLD_CHAIN_CONCERN, "우려"])

    def test_후보에_없는_기관을_말하면_첫_후보와_결정적_문구로(self):
        p = self._one(llm({"ingredientId": 1, "orgId": 999, "reason": "지어낸 이유", "draftMessage": "지어낸 초안"}))
        self.assertEqual(p["payload"]["orgId"], 3)
        self.assertNotIn("지어낸", p["rationale"])
        self.assertNotIn("지어낸", p["payload"]["draftMessage"])

    def test_LLM_이_수량을_바꿀_수_없다(self):
        p = self._one(llm({"ingredientId": 1, "orgId": 3, "reason": "r", "draftMessage": "d", "quantity": 999}))
        self.assertEqual(p["payload"]["quantity"], 8.0)

    def test_LLM_없이도_제안하고_초안을_만든다(self):
        p = self._one(None)
        self.assertEqual(p["payload"]["orgId"], 3)
        self.assertIn("양상추 8.0kg", p["payload"]["draftMessage"])

    def test_LLM_이_항목을_빠뜨려도_콜드체인_확인은_남는다(self):
        self.assertEqual(self._one(llm())["payload"]["concerns"], [dm.COLD_CHAIN_CONCERN])


class FollowUpTest(unittest.TestCase):
    def _agent(self):
        return AGENTS["waste"]

    def test_기부_후보가_있을_때만_이어서_실행(self):
        self.assertEqual(waste_guard.follow_ups({"donationCandidates": [cand()]}), ["donation"])
        self.assertEqual(waste_guard.follow_ups({"donationCandidates": []}), [])

    def test_후속_실패는_원래_실행에_영향이_없다(self):
        with mock.patch.object(runner, "run", side_effect=RuntimeError("로그인 실패")) as run:
            runner._run_follow_ups(self._agent(), {"donationCandidates": [cand()]}, 1, False)
        run.assert_called_once_with("donation", 1, trigger="EVENT", use_llm=False)

    def test_등록(self):
        self.assertIs(AGENTS["donation"], dm)


if __name__ == "__main__":
    unittest.main()
