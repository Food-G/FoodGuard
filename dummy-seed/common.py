"""더미 시드·평가 공용 헬퍼. FoodGuard 루트에서 ai-service venv 로 실행한다.

    ai-service/venv/Scripts/python.exe dummy-seed/<script>.py
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse

import pymysql

ROOT = Path(__file__).resolve().parent.parent
HERE = Path(__file__).resolve().parent
STORE = 60005
MANIFEST = HERE / "manifest.json"
TRUTH = HERE / "ground_truth.json"

sys.path.insert(0, str(ROOT))  # fgcli, fgagent

# backend util/UnitConverter 와 같은 표
UNIT_RULES = {"kg": {"g": 0.001, "kg": 1.0}, "L": {"ml": 0.001, "L": 1.0}, "개": {"개": 1.0}}


def connect():
    env = dict(l.split("=", 1) for l in (ROOT / "backend/.env").read_text(encoding="utf-8").splitlines()
               if "=" in l and not l.startswith("#"))
    u = urlparse(env["DB_URL"].strip().removeprefix("jdbc:"))
    return pymysql.connect(host=u.hostname, port=u.port or 3306, user=env["DB_USERNAME"].strip(),
                           password=env["DB_PASSWORD"].strip(), database=u.path.lstrip("/"),
                           ssl={"ssl": {}} if "tidb" in u.hostname else None, autocommit=False,
                           cursorclass=pymysql.cursors.DictCursor, connect_timeout=30, read_timeout=600,
                           write_timeout=600)


def jsonable(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, (date, datetime)):
        return o.isoformat()
    raise TypeError(type(o))


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=jsonable), encoding="utf-8")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def recipes(cur) -> dict[int, list[dict]]:
    cur.execute("SELECT mi.menu_id, mi.ingredient_id, mi.qty_per_unit, mi.unit, mi.tolerance, i.unit base "
                "FROM menu_ingredient mi JOIN ingredient i USING(ingredient_id) JOIN menu m USING(menu_id) "
                "WHERE m.store_id=%s AND m.is_active=1", (STORE,))
    out: dict[int, list[dict]] = {}
    for r in cur.fetchall():
        out.setdefault(r["menu_id"], []).append(r)
    return out


def ingredient_need(menu_qty: dict[int, float], rec: dict[int, list[dict]]) -> dict[int, float]:
    """메뉴 수량 → 식자재 기준 단위 소요량 (planner.build_plan 과 같은 전개)."""
    need: dict[int, float] = {}
    for mid, q in menu_qty.items():
        for r in rec.get(mid, []):
            f = UNIT_RULES.get(r["base"], {}).get(r["unit"])
            if f is None:
                continue
            need[r["ingredient_id"]] = need.get(r["ingredient_id"], 0.0) + \
                float(r["qty_per_unit"]) * q * (1 + float(r["tolerance"]) / 100) * f
    return need
