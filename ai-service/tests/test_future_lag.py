"""예측일 기준 lag 피처 테스트 (I-05).

학습 때 lag_7은 "7일 전 = 지난주 같은 요일" 값이므로, 2~7일 뒤를 예측할 때도
예측일 기준 7일·14일 전 실측값이 들어가야 한다.
실행: ai-service 폴더에서 `venv\\Scripts\\python.exe -m unittest discover -s tests`
"""

import unittest
from datetime import date, timedelta

import pandas as pd

from ml.feature_engineering import make_future_feature_row


def _weekday_history(days: int = 28) -> pd.DataFrame:
    """요일마다 값이 확연히 다른 판매 이력: 월=10, 화=20, ..., 일=70."""
    start = date(2026, 9, 1)
    ds = [start + timedelta(days=i) for i in range(days)]
    return pd.DataFrame({"ds": ds, "y": [10.0 * (d.weekday() + 1) for d in ds]})


class FutureLagTest(unittest.TestCase):
    def setUp(self):
        self.hist = _weekday_history()
        self.last = self.hist["ds"].iloc[-1]
        self.y_by_date = dict(zip(self.hist["ds"], self.hist["y"]))

    def test_lag7_and_lag14_are_same_weekday_for_each_horizon(self):
        for h in range(1, 8):
            target = self.last + timedelta(days=h)
            row = make_future_feature_row(target, self.hist)
            same_weekday = 10.0 * (target.weekday() + 1)
            with self.subTest(horizon=h):
                self.assertEqual(row["lag_7"], same_weekday)
                self.assertEqual(row["lag_14"], same_weekday)

    def test_lag1_uses_actual_when_available_else_last_actual(self):
        # 1일 뒤: 예측일 하루 전 = 마지막 실측일
        row1 = make_future_feature_row(self.last + timedelta(days=1), self.hist)
        self.assertEqual(row1["lag_1"], self.y_by_date[self.last])
        # 3일 뒤: 하루 전은 아직 미래라 실측이 없음 → 마지막 실측값
        row3 = make_future_feature_row(self.last + timedelta(days=3), self.hist)
        self.assertEqual(row3["lag_1"], self.y_by_date[self.last])

    def test_short_history_falls_back_to_mean(self):
        short = self.hist.head(3)
        row = make_future_feature_row(short["ds"].iloc[-1] + timedelta(days=1), short)
        self.assertAlmostEqual(row["lag_14"], float(short["y"].mean()))


if __name__ == "__main__":
    unittest.main()
