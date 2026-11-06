"""판매 이력을 매장 영업일 달력으로 정렬하는 규칙 검증."""

from datetime import date, timedelta

import pandas as pd

from services.data_service import build_daily_calendar, partial_entry_dates

D = [date(2026, 5, 1) + timedelta(days=i) for i in range(10)]


def test_open_day_without_sales_becomes_zero_and_store_off_day_is_dropped():
    sales = pd.DataFrame({"ds": [D[1], D[2], D[5]], "y": [4.0, 6.0, 3.0]})
    store_open = {D[0], D[1], D[2], D[3], D[5], D[6]}  # D[4]: 매장 전체 판매 0건 → 휴무·미입력

    cal = build_daily_calendar(sales, store_open, closed_dates=set(), sold_out_dates=set())

    # 메뉴 첫 판매일(D[1]) 이전은 제외, D[3]·D[6] 은 0, D[4] 는 행 없음
    assert list(cal["ds"]) == [D[1], D[2], D[3], D[5], D[6]]
    assert list(cal["y"]) == [4.0, 6.0, 0.0, 3.0, 0.0]


def test_discount_day_uses_usual_same_weekday_value_and_leaves_target():
    days = [date(2026, 5, 4) + timedelta(days=7 * i) for i in range(4)]  # 같은 요일
    sales = pd.DataFrame({"ds": days, "y": [10.0, 20.0, 90.0, 30.0]})

    cal = build_daily_calendar(sales, set(days), closed_dates=set(), sold_out_dates=set(), discounted_dates={days[2]})

    assert list(cal["y"]) == [10.0, 20.0, 15.0, 30.0]  # 90 은 lag 에 쓰이지 않는다
    assert list(cal["sold_out"]) == [0, 0, 1, 0]       # 학습 정답·보정에서 빠진다


def test_first_discount_day_without_history_keeps_sales():
    sales = pd.DataFrame({"ds": [D[0], D[1]], "y": [40.0, 5.0]})
    cal = build_daily_calendar(sales, {D[0], D[1]}, closed_dates=set(), sold_out_dates=set(), discounted_dates={D[0]})
    assert list(cal["y"]) == [40.0, 5.0]
    assert list(cal["sold_out"]) == [1, 0]


def test_registered_closure_and_sold_out_flags():
    sales = pd.DataFrame({"ds": [D[0], D[1], D[2]], "y": [5.0, 2.0, 7.0]})
    store_open = {D[0], D[1], D[2], D[3]}

    cal = build_daily_calendar(sales, store_open, closed_dates={D[3]}, sold_out_dates={D[1]})

    assert list(cal["ds"]) == [D[0], D[1], D[2]]
    assert list(cal["sold_out"]) == [0, 1, 0]


def test_partial_entry_day_is_judged_against_prior_median():
    days = [date(2026, 5, 1) + timedelta(days=i) for i in range(12)]
    # 평소 100개 안팎, 9번째 날만 13개 (부분 입력). 첫 7일은 비교할 이력이 부족해 판단하지 않는다
    totals = pd.Series([5, 100, 90, 110, 100, 95, 105, 100, 13, 60, 100, 100], index=days, dtype=float)

    # 60 은 중앙값 100 의 40% 이상이라 정상, 첫날 5 는 이력이 없어 판단하지 않음
    assert partial_entry_dates(totals) == {days[8]}


def test_no_sales_returns_empty_frame():
    cal = build_daily_calendar(pd.DataFrame(columns=["ds", "y"]), {D[0]}, set(), set())
    assert cal.empty and list(cal.columns) == ["ds", "y", "sold_out"]
