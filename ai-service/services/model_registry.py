"""모델 버전 관리 (DEV_ROADMAP AG-5): 챔피언(운영) · 챌린저 · 보관본.

    trained_models/store_{s}_menu_{m}.joblib           챔피언
    trained_models/challenger/store_{s}_menu_{m}.joblib + store_{s}.json(비교 결과)
    trained_models/archive/{timestamp}/store_{s}_menu_{m}.joblib   교체 직전 백업

챔피언은 판매 이력이 바뀔 때마다 재예측에서 자동으로 재학습되므로, 같은 설정으로 학습한 챌린저는
챔피언과 사실상 같은 모델이다. 그래서 챌린저는 학습 범위(전체 이력 ↔ 최근 N일)를 바꿔 학습하고,
승격하면 그 정책이 모델 파일에 함께 저장되어 이후 재학습에서도 유지된다.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import uuid
from datetime import datetime
from glob import glob
from pathlib import Path

from sqlalchemy.orm import Session

from config import settings
from ml.backtest import compare_policies, load_store_inputs
from ml.demand_predictor import DemandPredictor
from services.data_service import get_active_menus, get_sales_data, get_store_region
from services.weather_service import is_fallback_region

CHALLENGER_WINDOW_DAYS = 90
_TIMESTAMP = re.compile(r"^\d{8}-\d{6}-\d{6}$")  # rollback 의 to 는 외부 입력이라 경로로 쓰기 전에 검사한다


class ChallengerMismatch(Exception):
    """승격하려는 챌린저가 없거나, 승인한 제안의 챌린저가 아니다."""


def _champion_dir() -> str:
    return settings.MODEL_DIR


def _challenger_dir() -> str:
    return os.path.join(settings.MODEL_DIR, "challenger")


def _model_files(directory: str, store_id: int) -> list[str]:
    return sorted(glob(os.path.join(directory, f"store_{store_id}_menu_*.joblib")))


def _manifest_path(store_id: int) -> str:
    return os.path.join(_challenger_dir(), f"store_{store_id}.json")


def read_manifest(store_id: int) -> dict | None:
    path = _manifest_path(store_id)
    if not os.path.exists(path):
        return None
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S-%f")


def _archive_champions(store_id: int, ts: str) -> None:
    target = os.path.join(settings.MODEL_DIR, "archive", ts)
    os.makedirs(target, exist_ok=True)
    for f in _model_files(_champion_dir(), store_id):
        shutil.copy2(f, target)


def next_challenger_window(champion_window: int | None) -> int | None:
    """챔피언과 반대 정책: 전체 이력이면 최근 N일, 최근 N일이면 전체 이력."""
    return None if champion_window else CHALLENGER_WINDOW_DAYS


def _champion_window(store_id: int) -> int | None:
    import joblib
    files = _model_files(_champion_dir(), store_id)
    return joblib.load(files[0]).train_window_days if files else None


def train_challenger(db: Session, store_id: int) -> dict:
    """정책 비교 후 챌린저를 학습해 저장한다. 하루 1회 — 오늘 만든 결과가 있으면 그대로 돌려준다."""
    existing = read_manifest(store_id)
    if existing and existing["trainedAt"][:10] == datetime.now().date().isoformat():
        return {**existing, "reused": True}

    champion_window = _champion_window(store_id)
    challenger_window = next_challenger_window(champion_window)
    weather, sales_by_menu = load_store_inputs(db, store_id)
    comparison = compare_policies(store_id, sales_by_menu, weather, champion_window, challenger_window)

    Path(_challenger_dir()).mkdir(parents=True, exist_ok=True)
    for f in _model_files(_challenger_dir(), store_id):
        os.remove(f)
    models = 0
    for menu_id, sales in sales_by_menu.items():
        p = DemandPredictor(store_id, menu_id, train_window_days=challenger_window)
        p.fit(sales, weather_df=weather)
        if p.is_trained:
            p.save(os.path.join(_challenger_dir(), f"store_{store_id}_menu_{menu_id}.joblib"))
            models += 1

    manifest = {"id": str(uuid.uuid4()), "storeId": store_id, "trainedAt": datetime.now().isoformat(),
                "models": models, **comparison}
    Path(_manifest_path(store_id)).write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
    return {**manifest, "reused": False}


def promote(store_id: int, expect: str) -> dict:
    """챔피언을 보관하고 챌린저로 교체한다. expect = 사람이 승인한 제안의 챌린저 id."""
    manifest = read_manifest(store_id)
    files = _model_files(_challenger_dir(), store_id)
    if not manifest or not files:
        raise ChallengerMismatch("승격할 챌린저가 없습니다.")
    if manifest["id"] != expect:
        raise ChallengerMismatch(f"제안 이후 챌린저가 바뀌었습니다 ({expect} → {manifest['id']}).")

    ts = _timestamp()
    _archive_champions(store_id, ts)
    for f in files:
        os.replace(f, os.path.join(_champion_dir(), os.path.basename(f)))
    os.remove(_manifest_path(store_id))
    return {"storeId": store_id, "archived": ts, "promoted": len(files),
            "windowDays": manifest["challengerWindowDays"]}


def rollback(store_id: int, to: str) -> dict:
    """보관본으로 되돌린다. 지금 챔피언도 먼저 보관하므로 되돌리기를 다시 되돌릴 수 있다."""
    if not _TIMESTAMP.match(to):
        raise ValueError(f"잘못된 보관본 시각입니다: {to}")
    source = os.path.join(settings.MODEL_DIR, "archive", to)
    files = _model_files(source, store_id)
    if not files:
        raise FileNotFoundError(f"매장 {store_id} 의 보관본이 없습니다: {to}")

    ts = _timestamp()
    _archive_champions(store_id, ts)
    for f in _model_files(_champion_dir(), store_id):
        os.remove(f)
    for f in files:
        shutil.copy2(f, _champion_dir())
    return {"storeId": store_id, "restored": len(files), "archived": ts}


def status(db: Session, store_id: int) -> dict:
    """에이전트 판단 재료. staleDays = 가장 뒤처진 메뉴 모델이 학습한 뒤 쌓인 판매 일수."""
    import joblib
    stale_days = 0
    last_trained, last_sale = None, None
    models = 0
    window = None
    for menu in get_active_menus(db, store_id):
        path = DemandPredictor._build_path(store_id, menu["menu_id"])
        sales = get_sales_data(db, store_id, menu["menu_id"])
        if not os.path.exists(path) or sales.empty:
            continue
        predictor = joblib.load(path)
        if predictor._history is None or predictor._history.empty:
            continue
        models += 1
        window = predictor.train_window_days
        trained_until = max(predictor._history["ds"])
        sold_until = max(sales["ds"])
        stale_days = max(stale_days, (sold_until - trained_until).days)
        last_trained = min(last_trained, trained_until) if last_trained else trained_until
        last_sale = max(last_sale, sold_until) if last_sale else sold_until
    region = get_store_region(db, store_id)
    return {"storeId": store_id, "models": models, "championWindowDays": window,
            "lastTrainedSaleDate": str(last_trained) if last_trained else None,
            "lastSaleDate": str(last_sale) if last_sale else None,
            "staleDays": stale_days, "region": region, "coordsFallback": is_fallback_region(region),
            "challenger": read_manifest(store_id)}
