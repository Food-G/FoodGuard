"""정확도 지표 단위 테스트 (DB 없음).  python -m unittest discover -s tests"""

import unittest

import pandas as pd

from services.accuracy_service import _metrics


class MetricsTest(unittest.TestCase):
    def setUp(self):
        # 실제 10/20/0, 예측 12/15/1, 기준선 8/25/0
        self.df = pd.DataFrame({"pred": [12.0, 15.0, 1.0], "actual": [10.0, 20.0, 0.0],
                                "baseline": [8.0, 25.0, 0.0]})

    def test_WAPE_와_편향(self):
        m = _metrics(self.df)
        self.assertAlmostEqual(m["mae"], round(8 / 3, 2))      # |2|+|5|+|1|
        self.assertAlmostEqual(m["wape"], round(8 / 30, 4))
        self.assertAlmostEqual(m["bias"], round(-2 / 30, 4))   # 2-5+1
        self.assertAlmostEqual(m["mape"], round((0.2 + 0.25) / 2, 4))  # 실제 0 인 날 제외

    def test_기준선_대비_skill(self):
        m = _metrics(self.df)
        self.assertAlmostEqual(m["baseline_wape"], round(7 / 30, 4))   # |−2|+|5|+0
        self.assertAlmostEqual(m["skill"], round(1 - (8 / 30) / (7 / 30), 4))
        self.assertLess(m["skill"], 0)   # 이 예시는 기준선보다 나쁘다

    def test_기준선_없는_행은_skill_계산에서_제외(self):
        df = self.df.assign(baseline=[None, None, None])
        self.assertNotIn("skill", _metrics(df))


if __name__ == "__main__":
    unittest.main()
