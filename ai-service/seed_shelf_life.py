"""식자재 보관일수(INGREDIENT.shelf_life_days) 기본값 (DEV_ROADMAP D-3).

    python seed_shelf_life.py           # 미리보기만 (DB 를 바꾸지 않음)
    python seed_shelf_life.py --apply   # 값이 NULL 인 식자재만 채운다 (이미 넣은 값은 건드리지 않음)

값은 일반적인 냉장 보관 기준의 **추정치**다. 실행 전에 팀이 표를 확인하고 고칠 것.
None = 유통기한 관리 안 함 (쌀·당면 같은 건자재). 목록에 없는 식자재도 None 으로 남기고 따로 보여준다.
식자재는 이름으로 매칭한다 — 같은 이름이 여러 개(양파(개)/양파(kg))여도 보관일수는 같다.
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import text

from database import SessionLocal

SHELF_LIFE_DAYS: dict[str, int | None] = {
    # 육류·가공
    "소고기": 5, "돼지고기": 5, "어묵": 7, "두부": 7, "떡볶이떡": 7, "냉면사리": 30,
    # 채소
    "양파": 14, "대파": 7, "마늘": 14, "참나물": 5, "콩나물": 3, "시금치": 5,
    "양상추": 5, "토마토": 7,
    # 유제품·계란·빵
    "계란": 21, "치즈": 30, "체다치즈": 30, "번": 3, "버거빵": 3,
    # 장류·소스·절임
    "배추김치": 30, "피클": 60, "된장": 180, "고추장": 180, "참기름": 180, "간장": 365,
    # 건자재 (관리 안 함)
    "쌀": None, "당면": None,
}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="DB 에 반영 (없으면 미리보기)")
    a = ap.parse_args()

    db = SessionLocal()
    try:
        rows = db.execute(text(
            "SELECT ingredient_id, ingredient_name, unit, shelf_life_days FROM INGREDIENT ORDER BY ingredient_name"
        )).fetchall()
        todo, unknown = [], []
        print(f"{'id':>8}  {'식자재':<10} {'단위':<4} {'현재':>5} → 제안")
        for iid, name, unit, cur in rows:
            if name not in SHELF_LIFE_DAYS:
                unknown.append(name)
            days = SHELF_LIFE_DAYS.get(name)
            mark = "" if cur is None else "  (이미 값 있음 — 유지)"
            print(f"{iid:>8}  {name:<10} {unit:<4} {str(cur):>5} → {days}{mark}")
            if cur is None and days is not None:
                todo.append((iid, days))
        if unknown:
            print(f"\n표에 없는 식자재 (None 으로 둠, 필요하면 SHELF_LIFE_DAYS 에 추가): {', '.join(unknown)}")
        print(f"\n채울 식자재: {len(todo)}개")
        if not a.apply:
            print("미리보기입니다. 확인 후 --apply 로 실행하세요.")
            return
        for iid, days in todo:
            db.execute(text("UPDATE INGREDIENT SET shelf_life_days = :d "
                            "WHERE ingredient_id = :i AND shelf_life_days IS NULL"), {"d": days, "i": iid})
        db.commit()
        print("반영했습니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
