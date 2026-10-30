"""DB 데이터 접근 레이어 (순수 SQL로 Spring Boot의 기존 스키마 읽기/쓰기)."""

from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session
import pandas as pd


def get_active_menus(db: Session, store_id: int) -> list[dict]:
    """매장의 활성화된 메뉴 목록 반환."""
    rows = db.execute(
        text(
            "SELECT menu_id, menu_name, category, price "
            "FROM MENU "
            "WHERE store_id = :sid AND is_active = 1"
        ),
        {"sid": store_id},
    ).fetchall()
    return [{"menu_id": r[0], "menu_name": r[1], "category": r[2], "price": r[3]} for r in rows]


def build_daily_calendar(
    sales: pd.DataFrame,
    store_open_dates: set[date],
    closed_dates: set[date],
    sold_out_dates: set[date],
) -> pd.DataFrame:
    """
    메뉴 판매 이력(판매 있는 날만)을 매장 영업일 달력으로 정렬한다.
    - 범위: 메뉴 첫 판매일 ~ 매장 마지막 영업일
    - 영업일 = 매장에 판매가 1건이라도 있는 날 - 휴무 등록일. 영업일에 이 메뉴 판매가 없으면 0
    - 매장 전체 판매가 없는 날(휴무·미입력)은 0이 아니라 행을 빼서 학습에서 제외한다
      (lag 는 feature_engineering.weekday_lag 가 달력 기준으로 계산하므로 행이 빠져도 어긋나지 않음)
    - sold_out: 품절 등록일 (판매량 < 실제 수요였을 수 있음)
    """
    if sales.empty:
        return pd.DataFrame(columns=["ds", "y", "sold_out"])

    first = sales["ds"].min()
    days = sorted(d for d in store_open_dates if d >= first and d not in closed_dates)
    qty = dict(zip(sales["ds"], sales["y"]))
    return pd.DataFrame({
        "ds": days,
        "y": [float(qty.get(d, 0.0)) for d in days],
        "sold_out": [int(d in sold_out_dates) for d in days],
    })


# 매장 전체 판매량이 직전 영업일 중앙값의 이 비율 미만이면 부분 입력일로 본다
PARTIAL_ENTRY_RATIO = 0.4
PARTIAL_ENTRY_WINDOW = 28
PARTIAL_ENTRY_MIN_DAYS = 7


def partial_entry_dates(store_totals: pd.Series) -> set[date]:
    """
    매출이 일부만 입력된 날 (예: 평소 900~1,300개인 매장에 13개). 이날 판매량은 수요가 아니므로
    휴무처럼 학습·평가에서 뺀다. 기준은 직전 PARTIAL_ENTRY_WINDOW 영업일 매장 판매량의 중앙값
    (그날 이후 데이터는 보지 않는다. 직전 영업일이 PARTIAL_ENTRY_MIN_DAYS 보다 적으면 판단하지 않음).
    store_totals: 영업일 -> 매장 전체 판매량, 날짜순
    """
    prior = store_totals.shift(1).rolling(PARTIAL_ENTRY_WINDOW, min_periods=PARTIAL_ENTRY_MIN_DAYS).median()
    return set(store_totals.index[store_totals < PARTIAL_ENTRY_RATIO * prior])


def _flag_dates(db: Session, store_id: int, flag_type: str, menu_id: int | None = None) -> set[date]:
    """SALES_DAY_FLAG(휴무·품절 기록) 날짜 집합."""
    sql = "SELECT flag_date FROM SALES_DAY_FLAG WHERE store_id = :sid AND flag_type = :ftype"
    params = {"sid": store_id, "ftype": flag_type}
    if menu_id is not None:
        sql += " AND menu_id = :mid"
        params["mid"] = menu_id
    try:
        rows = db.execute(text(sql), params).fetchall()
    except ProgrammingError:
        # 테이블은 백엔드(JPA ddl-auto)가 만든다. 새 백엔드가 아직 한 번도 안 떴으면 기록 없음으로 본다
        db.rollback()
        return set()
    return {pd.to_datetime(r[0]).date() for r in rows}


def get_closed_dates(db: Session, store_id: int) -> set[date]:
    return _flag_dates(db, store_id, "CLOSED")


def get_all_sales_data(db: Session) -> dict[tuple[int, int], pd.DataFrame]:
    """
    전체 매장×메뉴의 일별 판매 이력 (글로벌 모델 학습용, 키: (store_id, menu_id)).
    각 값은 is_deleted=0 만, 영업일 달력 기준(build_daily_calendar), 컬럼: ds, y, sold_out
    휴무 등록일과 부분 입력일(partial_entry_dates)은 행에서 뺀다
    """
    rows = db.execute(
        text(
            "SELECT store_id, menu_id, sales_date, SUM(quantity) as qty "
            "FROM SALES_DATA "
            "WHERE is_deleted = 0 "
            "GROUP BY store_id, menu_id, sales_date"
        )
    ).fetchall()
    if not rows:
        return {}

    sales = pd.DataFrame(rows, columns=["store_id", "menu_id", "ds", "y"])
    sales["ds"] = pd.to_datetime(sales["ds"]).dt.date
    sales["y"] = sales["y"].astype(float)
    # 매장에 판매가 1건이라도 있는 날 (휴무 등록일은 build_daily_calendar 가 뺀다)
    store_open = {int(sid): set(g) for sid, g in sales.groupby("store_id")["ds"]}

    try:
        flags = db.execute(
            text("SELECT store_id, menu_id, flag_type, flag_date FROM SALES_DAY_FLAG")
        ).fetchall()
    except ProgrammingError:
        # _flag_dates 와 같음: 백엔드가 아직 테이블을 안 만들었으면 기록 없음
        db.rollback()
        flags = []
    closed: dict[int, set[date]] = {}
    sold_out: dict[tuple[int, int], set[date]] = {}
    for sid, mid, ftype, fdate in flags:
        d = pd.to_datetime(fdate).date()
        if ftype == "CLOSED":
            closed.setdefault(int(sid), set()).add(d)
        elif ftype == "SOLD_OUT" and mid is not None:
            sold_out.setdefault((int(sid), int(mid)), set()).add(d)
    # 부분 입력일도 휴무처럼 뺀다
    for sid, g in sales.groupby("store_id"):
        totals = g.groupby("ds")["y"].sum().sort_index()
        closed.setdefault(int(sid), set()).update(partial_entry_dates(totals))

    out = {}
    for (sid, mid), g in sales.groupby(["store_id", "menu_id"]):
        key = (int(sid), int(mid))
        out[key] = build_daily_calendar(
            g[["ds", "y"]],
            store_open[key[0]],
            closed_dates=closed.get(key[0], set()),
            sold_out_dates=sold_out.get(key, set()),
        )
    return out


def get_event_lifts(db: Session) -> dict[int, dict[date, float]]:
    """
    점주 특이사항(STORE_EVENT_NOTE)을 claude 가 숫자로 바꿔 둔 증감 배율 {store_id: {날짜: 배율}}.
    같은 날 특이사항이 여럿이면 배율을 곱한다. 테이블이 아직 없으면(백엔드 미실행) 빈 값
    """
    try:
        rows = db.execute(
            text("SELECT store_id, event_date, event_lift FROM STORE_EVENT_NOTE WHERE event_lift IS NOT NULL")
        ).fetchall()
    except ProgrammingError:
        db.rollback()
        return {}
    lifts: dict[int, dict[date, float]] = {}
    for sid, d, lift in rows:
        day = pd.to_datetime(d).date()
        store = lifts.setdefault(int(sid), {})
        store[day] = store.get(day, 1.0) * float(lift)
    return lifts


def get_recipes(db: Session) -> dict[int, list[tuple[int, float]]]:
    """
    메뉴별 레시피 {menu_id: [(ingredient_id, 메뉴 1개당 사용량)]}.
    사용량은 식자재 기준 단위로 환산한다 (백엔드 UnitUtils.convertToBaseUnit 과 같은 규칙: g→kg, ml→L).
    """
    rows = db.execute(
        text(
            "SELECT mi.menu_id, mi.ingredient_id, mi.qty_per_unit, mi.unit, i.unit "
            "FROM MENU_INGREDIENT mi JOIN INGREDIENT i ON i.ingredient_id = mi.ingredient_id"
        )
    ).fetchall()
    recipes: dict[int, list[tuple[int, float]]] = {}
    for menu_id, ingredient_id, qty, unit, base_unit in rows:
        per_unit = float(qty)
        if (unit, base_unit) in (("g", "kg"), ("ml", "L")):
            per_unit /= 1000.0
        recipes.setdefault(int(menu_id), []).append((int(ingredient_id), per_unit))
    return recipes


def get_store_sales_last_n_days(db: Session, store_id: int, n_days: int = 30) -> list[dict]:
    """대시보드용 매장 전체 최근 판매 데이터."""
    rows = db.execute(
        text(
            "SELECT sd.sales_date, m.menu_id, m.menu_name, SUM(sd.quantity) as qty "
            "FROM SALES_DATA sd "
            "JOIN MENU m ON sd.menu_id = m.menu_id "
            "WHERE sd.store_id = :sid "
            "  AND sd.is_deleted = 0 "
            "  AND sd.sales_date >= DATE_SUB(CURDATE(), INTERVAL :n DAY) "
            "GROUP BY sd.sales_date, m.menu_id, m.menu_name "
            "ORDER BY sd.sales_date ASC"
        ),
        {"sid": store_id, "n": n_days},
    ).fetchall()
    return [
        {"date": str(r[0]), "menu_id": r[1], "menu_name": r[2], "qty": int(r[3])}
        for r in rows
    ]


def save_predictions_bulk(
    db: Session,
    store_id: int,
    menu_id: int,
    predictions: list[dict],
    model_version: str = "xgb_weather_v1.0",
) -> None:
    """
    PREDICTION_RESULT 테이블에 예측값 저장.
    같은 (store_id, menu_id, target_date)가 이미 있으면 덮어씀.
    """
    # 기존 미래 예측 삭제 (재예측 시 중복 방지)
    db.execute(
        text(
            "DELETE FROM PREDICTION_RESULT "
            "WHERE store_id = :sid AND menu_id = :mid AND target_date >= CURDATE()"
        ),
        {"sid": store_id, "mid": menu_id},
    )

    for p in predictions:
        db.execute(
            text(
                "INSERT INTO PREDICTION_RESULT "
                "(store_id, menu_id, target_date, predicted_qty, recommended_order_qty, confidence, model_version) "
                "VALUES (:sid, :mid, :tdate, :qty, :rec_qty, :conf, :ver)"
            ),
            {
                "sid": store_id,
                "mid": menu_id,
                "tdate": p["date"],
                "qty": p["predicted_qty"],
                "rec_qty": p["recommended_order_qty"],
                "conf": p["confidence"],
                "ver": model_version,
            },
        )

    db.commit()


def get_store_region(db: Session, store_id: int) -> str | None:
    """매장의 지역명 반환 (날씨 API 좌표 조회용)."""
    row = db.execute(
        text("SELECT region FROM STORE WHERE store_id = :sid"),
        {"sid": store_id},
    ).fetchone()
    return row[0] if row else None


def get_saved_predictions(db: Session, store_id: int) -> list[dict]:
    """저장된 예측 결과 조회 (오늘 이후)."""
    rows = db.execute(
        text(
            "SELECT pr.prediction_id, pr.menu_id, m.menu_name, "
            "       pr.target_date, pr.predicted_qty, pr.recommended_order_qty, pr.confidence, "
            "       pr.model_version, pr.created_at "
            "FROM PREDICTION_RESULT pr "
            "JOIN MENU m ON pr.menu_id = m.menu_id "
            "WHERE pr.store_id = :sid AND pr.target_date >= CURDATE() "
            "ORDER BY pr.target_date ASC, m.menu_name ASC"
        ),
        {"sid": store_id},
    ).fetchall()
    return [
        {
            "id": r[0],
            "menu_id": r[1],
            "menu_name": r[2],
            "prediction_date": str(r[3]),
            "predicted_qty": int(r[4]),
            "recommended_order_qty": int(r[5]) if r[5] is not None else int(r[4]),
            "confidence": float(r[6]) if r[6] else 0.0,
            "model_version": r[7],
            "created_at": str(r[8]),
        }
        for r in rows
    ]
