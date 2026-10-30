"""백테스트가 시간 순서를 지키는지 테스트 (STEP 7).

실행: ai-service 폴더에서 `venv\\Scripts\\python.exe -m unittest discover -s tests`
"""

import unittest
from datetime import timedelta

from evaluation.backtest import _synthetic, rolling_backtest, summarize


class BacktestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = _synthetic(days=56)
        cls.res = rolling_backtest(cls.data, min_train=28, horizon=7, step=7)

    def test_training_always_ends_before_target(self):
        self.assertTrue((self.res["train_end"] < self.res["target"]).all())

    def test_targets_are_the_next_days_after_training(self):
        expected = self.res["train_end"] + self.res["horizon"].map(lambda h: timedelta(days=h))
        self.assertTrue((self.res["target"] == expected).all())

    def test_covers_every_day_after_first_training_window(self):
        # 56일 중 앞 28일 학습 → 나머지 28일이 각각 한 번씩 평가됨
        self.assertEqual(len(self.res), 28)
        self.assertEqual(self.res["target"].nunique(), 28)

    def test_summary_has_three_methods(self):
        table = summarize(self.res, self.data)
        self.assertEqual(list(table["방법"]), ["FoodGuard 모델", "지난주 같은 요일", "요일 평균"])
        self.assertIn("충족률(%)", table.attrs)


if __name__ == "__main__":
    unittest.main()
