"""모델 버전 관리·학습 정책 테스트 (DB·네트워크 없음).  python -m unittest discover -s tests -t ."""

import os
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest import mock

import joblib
import pandas as pd

from config import settings
from ml.backtest import compare_policies
from ml.demand_predictor import DemandPredictor
from services import model_registry as reg
from services.accuracy_service import latest_per_target
from services.weather_service import is_fallback_region

STORE = 60006


def sales(days: int) -> pd.DataFrame:
    start = date(2026, 1, 1)
    return pd.DataFrame([{"ds": start + timedelta(days=i), "y": float(20 + (i % 7))} for i in range(days)])


class RegistryCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.object(settings, "MODEL_DIR", self.tmp.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def champion(self, menu=1, body=b"champion"):
        Path(self.tmp.name, f"store_{STORE}_menu_{menu}.joblib").write_bytes(body)

    def challenger(self, menu=1, body=b"challenger", manifest_id="c1", window=90):
        d = Path(self.tmp.name, "challenger")
        d.mkdir(exist_ok=True)
        (d / f"store_{STORE}_menu_{menu}.joblib").write_bytes(body)
        Path(reg._manifest_path(STORE)).write_text(
            f'{{"id": "{manifest_id}", "trainedAt": "2026-11-01T07:00:00", "challengerWindowDays": {window}}}',
            encoding="utf-8")

    def read_champion(self, menu=1):
        return Path(self.tmp.name, f"store_{STORE}_menu_{menu}.joblib").read_bytes()


class PromoteTest(RegistryCase):
    def test_챔피언을_보관하고_챌린저로_교체(self):
        self.champion()
        self.challenger()
        r = reg.promote(STORE, "c1")
        self.assertEqual(self.read_champion(), b"challenger")
        self.assertEqual(r["promoted"], 1)
        self.assertEqual(r["windowDays"], 90)
        backup = Path(self.tmp.name, "archive", r["archived"], f"store_{STORE}_menu_1.joblib")
        self.assertEqual(backup.read_bytes(), b"champion")
        self.assertIsNone(reg.read_manifest(STORE))

    def test_승인한_챌린저가_아니면_교체하지_않는다(self):
        self.champion()
        self.challenger(manifest_id="new")
        with self.assertRaises(reg.ChallengerMismatch):
            reg.promote(STORE, "old")
        self.assertEqual(self.read_champion(), b"champion")

    def test_챌린저가_없으면_거부(self):
        self.champion()
        with self.assertRaises(reg.ChallengerMismatch):
            reg.promote(STORE, "c1")

    def test_다른_매장_파일은_건드리지_않는다(self):
        other = Path(self.tmp.name, "store_600060_menu_1.joblib")
        other.write_bytes(b"other")
        self.champion()
        self.challenger()
        reg.promote(STORE, "c1")
        self.assertEqual(other.read_bytes(), b"other")


class RollbackTest(RegistryCase):
    def test_되돌리고_다시_되돌릴_수_있다(self):
        self.champion()
        self.challenger()
        first = reg.promote(STORE, "c1")
        back = reg.rollback(STORE, first["archived"])
        self.assertEqual(self.read_champion(), b"champion")
        self.assertEqual(back["restored"], 1)
        reg.rollback(STORE, back["archived"])
        self.assertEqual(self.read_champion(), b"challenger")

    def test_승격때_새로_생긴_메뉴_모델은_지운다(self):
        self.champion(menu=1)
        self.challenger(menu=1)
        self.challenger(menu=2)
        r = reg.promote(STORE, "c1")
        reg.rollback(STORE, r["archived"])
        self.assertFalse(Path(self.tmp.name, f"store_{STORE}_menu_2.joblib").exists())

    def test_경로를_벗어나는_입력을_거부(self):
        for to in ("../../secret", "..", "20261106-070000", "20261106-070000-000000/../x"):
            with self.assertRaises(ValueError):
                reg.rollback(STORE, to)

    def test_없는_보관본(self):
        with self.assertRaises(FileNotFoundError):
            reg.rollback(STORE, "20200101-000000-000000")


class PolicyTest(RegistryCase):
    def test_챌린저는_챔피언과_반대_정책(self):
        self.assertEqual(reg.next_challenger_window(None), reg.CHALLENGER_WINDOW_DAYS)
        self.assertIsNone(reg.next_challenger_window(90))

    def test_정책은_저장했다_불러와_재학습해도_유지된다(self):
        p = DemandPredictor(STORE, 1, train_window_days=90).fit(sales(120), compute_score=False)
        p.save()
        loaded = DemandPredictor.load(STORE, 1)
        self.assertEqual(loaded.train_window_days, 90)
        loaded.fit(sales(127), compute_score=False)
        self.assertEqual(loaded.train_window_days, 90)
        self.assertEqual(loaded.version_label("rf"), "rf-w90")

    def test_필드가_생기기_전_모델은_전체_이력으로_읽힌다(self):
        p = DemandPredictor(STORE, 1)
        del p.__dict__["train_window_days"]
        path = os.path.join(self.tmp.name, "old.joblib")
        joblib.dump(p, path)
        old = joblib.load(path)
        self.assertIsNone(old.train_window_days)
        self.assertEqual(old.version_label("rf"), "rf")

    def test_window_는_학습_행만_줄이고_예측_이력은_유지한다(self):
        df = sales(200)
        p = DemandPredictor(STORE, 1, train_window_days=30).fit(df, compute_score=False)
        self.assertEqual(len(p._history), 200)
        self.assertTrue(p.matches_history(df))
        self.assertLessEqual(p.model.estimators_[0].tree_.weighted_n_node_samples[0], 30)

    def test_window_학습_행이_너무_적으면_전체를_쓴다(self):
        p = DemandPredictor(STORE, 1, train_window_days=2).fit(sales(60), compute_score=False)
        self.assertGreater(p.model.estimators_[0].tree_.weighted_n_node_samples[0], 2)


class CompareTest(unittest.TestCase):
    def test_같은_정책이면_차이가_없다(self):
        r = compare_policies(STORE, {1: sales(90)}, None, None, None, cutoffs=2)
        self.assertEqual(r["championWape"], r["challengerWape"])
        self.assertEqual(r["n"], 14)

    def test_오차와_승수는_정해진_예측값으로_계산한다(self):
        # 어느 정책이 나은지는 데이터마다 다르다 (시뮬레이션에서 부호가 뒤집힌다). 여기서는 계산만 검증한다.
        class Fixed:
            def __init__(self, store, menu, train_window_days=None):
                self.window = train_window_days

            def fit(self, *a, **k):
                return self

            def predict(self, days, forecast_df, as_of):
                # 실제는 모두 10. 챔피언은 +2, 챌린저는 기준일 하나만 +3 이고 나머지는 +1
                off = 2 if self.window is None else (3 if as_of == date(2026, 3, 1) else 1)
                return [{"date": as_of + timedelta(days=i + 1), "predicted_qty": 10 + off} for i in range(days)]

        df = pd.DataFrame({"ds": [date(2026, 1, 1) + timedelta(days=i) for i in range(74)], "y": [10.0] * 74})
        self.assertEqual(max(df["ds"]) - timedelta(days=14), date(2026, 3, 1))
        with mock.patch("ml.backtest.DemandPredictor", Fixed):
            r = compare_policies(STORE, {1: df}, None, None, 30, cutoffs=2)
        self.assertEqual(r["n"], 14)
        self.assertEqual(r["championWape"], 0.2)              # 28 / 140
        self.assertEqual(r["challengerWape"], round(28 / 140, 4))   # 3×7 + 1×7
        self.assertEqual((r["cutoffs"], r["challengerWins"]), (2, 1))

    def test_데이터가_부족하면_평가하지_않는다(self):
        r = compare_policies(STORE, {1: sales(10)}, None, None, 30, cutoffs=2)
        self.assertEqual(r["n"], 0)
        self.assertIsNone(r["championWape"])


class HelpersTest(unittest.TestCase):
    def test_같은_대상은_가장_나중_예측만(self):
        log = pd.DataFrame({"store_id": [1, 1, 1], "menu_id": [1, 1, 2], "date": ["d", "d", "d"],
                            "horizon": [3, 1, 5], "pred": [30, 10, 50]})
        out = latest_per_target(log)
        self.assertEqual(sorted(out["pred"].tolist()), [10, 50])

    def test_좌표_폴백_판정(self):
        self.assertFalse(is_fallback_region("경남 창원시"))
        self.assertTrue(is_fallback_region("창원"))
        self.assertTrue(is_fallback_region(None))


if __name__ == "__main__":
    unittest.main()
