"""예측 운영 에이전트 판단 테스트 (네트워크·Claude 호출 없음).

    python -m unittest fgagent.test_mlops -v
"""

from __future__ import annotations

import unittest

from fgagent import report
from fgagent.agents import AGENTS, mlops
from fgagent.runtime.scheduler import SCHEDULES
from fgcli.planner import ObserveError


def status(models=3, stale=0, fallback=False):
    return {"models": models, "staleDays": stale, "coordsFallback": fallback, "region": "창원"}


def comparison(champion=0.20, challenger=0.15, wins=3, cutoffs=4, n=56, models=3, cid="c1"):
    return {"id": cid, "models": models, "n": n, "championWape": champion, "challengerWape": challenger,
            "challengerWins": wins, "cutoffs": cutoffs, "championWindowDays": None, "challengerWindowDays": 90}


def obs(signals=None, comp=None, pending=(), trigger=None, error=None, st=None):
    return {"asOf": "2026-11-06", "signals": signals or mlops.assess({"wape": 0.3, "baseline_wape": 0.2}, {"wape": 0.1}, status()),
            "status": st or status(), "trigger": trigger, "comparison": comp, "comparisonError": error,
            "pendingFingerprints": list(pending)}


class AssessTest(unittest.TestCase):
    def test_드리프트_경계(self):
        self.assertEqual(mlops.assess({"wape": 0.15}, {"wape": 0.10}, status())["reasons"], [])   # 정확히 5%p 는 아님
        self.assertEqual(mlops.assess({"wape": 0.1501}, {"wape": 0.10}, status())["reasons"], ["drift"])

    def test_학습_후_판매_7일이면_오래됨(self):
        self.assertEqual(mlops.assess(None, None, status(stale=6))["reasons"], [])
        self.assertEqual(mlops.assess(None, None, status(stale=7))["reasons"], ["stale"])

    def test_모델이_없으면_오래됨이_아니다(self):
        self.assertEqual(mlops.assess(None, None, status(models=0, stale=30))["reasons"], [])

    def test_기준선보다_나쁨(self):
        s = mlops.assess({"wape": 0.2, "baseline_wape": 0.19}, None, status())
        self.assertEqual(s["reasons"], ["worse_than_baseline"])

    def test_평가할_이력이_없어도_실패가_아니다(self):
        s = mlops.assess(None, None, status())
        self.assertEqual(s["reasons"], [])
        self.assertIsNone(s["drift"])

    def test_이력_없음과_진짜_오류를_구분(self):
        self.assertIsNone(mlops._overall({"error": "no_actuals"}))
        self.assertIsNone(mlops._overall({"error": "no_log"}))
        self.assertEqual(mlops._overall({"overall": {"wape": 0.1}}), {"wape": 0.1})
        with self.assertRaises(ObserveError):
            mlops._overall({"error": "http_500", "message": "x"})


class PromoteRuleTest(unittest.TestCase):
    def test_충분히_나으면_교체_후보(self):
        self.assertTrue(mlops.should_promote(comparison()))

    def test_1퍼센트포인트_이하_개선은_아니다(self):
        self.assertFalse(mlops.should_promote(comparison(champion=0.20, challenger=0.19)))

    def test_기준일_과반에서_이겨야_한다(self):
        self.assertFalse(mlops.should_promote(comparison(wins=2, cutoffs=4)))   # 한 번 크게 맞은 것은 노이즈일 수 있다

    def test_표본이_적으면_아니다(self):
        self.assertFalse(mlops.should_promote(comparison(n=27)))

    def test_모델을_못_만들었거나_평가_못했으면_아니다(self):
        self.assertFalse(mlops.should_promote(comparison(models=0)))
        self.assertFalse(mlops.should_promote(comparison(champion=None)))
        self.assertFalse(mlops.should_promote(None))


class DecideTest(unittest.TestCase):
    def test_교체_제안을_만들고_챌린저_id_로_고정(self):
        (p,) = mlops.to_proposals(mlops.decide(obs(comp=comparison())), {"summary": "요약", "concerns": ["우려"]})
        self.assertEqual(p["type"], "MODEL_PROMOTE")
        self.assertEqual(p["fingerprint"], "c1")
        self.assertEqual(p["payload"]["improvement"], 0.05)
        self.assertEqual(p["payload"]["concerns"], ["우려"])
        self.assertEqual(p["rationale"], "요약")

    def test_LLM_없는_문구도_합성_데이터를_밝히고_정확도라_쓰지_않는다(self):
        (p,) = mlops.to_proposals(mlops.decide(obs(comp=comparison())), None)
        self.assertIn("합성", p["rationale"])
        self.assertNotIn("정확도", p["rationale"])

    def test_LLM_이_있어도_결정적_판단을_뒤집지_못한다(self):
        d = mlops.decide(obs(comp=comparison(champion=0.20, challenger=0.195)))
        self.assertEqual(mlops.to_proposals(d, {"summary": "교체하세요", "concerns": []}), [])

    def test_이미_대기_중이면_다시_제안하지_않는다(self):
        self.assertFalse(mlops.decide(obs(comp=comparison(), pending=["c1"]))["promote"])

    def test_경고(self):
        d = mlops.decide(obs(st=status(fallback=True), error="502: down", trigger={"ok": False, "message": "재예측 실패"}))
        text = " ".join(d["warnings"])
        for needle in ("서울 날씨", "챌린저 학습 실패", "재예측 실패"):
            self.assertIn(needle, text)


class NotificationTest(unittest.TestCase):
    def test_문제가_없으면_알리지_않는다(self):
        s = mlops.assess(None, None, status())
        self.assertEqual(mlops.notifications(mlops.decide(obs(signals=s)), None), [])

    def test_문구는_LLM_과_무관하게_고정(self):
        d = mlops.decide(obs(comp=comparison()))
        (n,) = mlops.notifications(d, None)
        self.assertEqual(n["type"], "ACCURACY")
        self.assertIn("교체 제안", n["message"])
        self.assertEqual(n, mlops.notifications(d, {"summary": "다른 말"})[0])


class ReportTest(unittest.TestCase):
    def test_매장_메뉴별_표(self):
        acc = {"source": "backtest", "period": {"from": "2026-01-01", "to": "2026-02-01"}, "stores": 1, "menus": 1,
               "overall": {"n": 7, "wape": 0.132, "baseline_wape": 0.162, "bias": -0.01},
               "byMenu": [{"storeId": 1, "menuId": 10, "n": 7, "wape": 0.132, "bias": -0.01},
                          {"storeId": 1, "menuId": 11, "n": 7, "wape": None, "bias": None}]}
        md = report.render_accuracy(acc, {(1, 10): "불고기버거"})
        self.assertIn("| 1 | 불고기버거 | 7 | 13.2% | - | -1.0% |", md)
        self.assertIn("| 1 | 메뉴 11 | 7 | - | - | - |", md)
        self.assertIn("합성 판매 데이터", md)

    def test_조회_실패는_숨기지_않는다(self):
        class C:
            def get(self, path):
                return {"error": "no_log"}
        with self.assertRaises(RuntimeError):
            report.accuracy_report(C())


class WiringTest(unittest.TestCase):
    def test_등록과_스케줄(self):
        self.assertIs(AGENTS["mlops"], mlops)
        self.assertEqual(SCHEDULES["mlops"], "0 7 * * *")


if __name__ == "__main__":
    unittest.main()
