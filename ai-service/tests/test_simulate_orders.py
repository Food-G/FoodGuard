"""발주 시뮬레이션의 재고 흐름(입고·FIFO 소진·보관기한 폐기·품절) 검증."""

from datetime import date, timedelta

from simulate_orders import Scenario, simulate_ingredient

D0 = date(2026, 3, 2)


def _day(i: int) -> date:
    return D0 + timedelta(days=i)


def test_coverage_is_lead_minus_one_plus_min_cycle_shelf():
    # 백엔드 OrderRequestService.coverageDays 와 같은 규칙
    assert Scenario("", lead_time=1, cycle=7, shelf_life=3).coverage == 3
    assert Scenario("", lead_time=2, cycle=3, shelf_life=10).coverage == 4


def test_exact_order_has_no_waste_or_shortage():
    demand = {_day(i): 10.0 for i in range(1, 4)}
    r = simulate_ingredient(demand, {_day(0): 30.0}, _day(0), _day(3), lead_time=1, shelf_life=3)
    assert r == {"demand": 30.0, "received": 30.0, "waste": 0.0, "short": 0.0}


def test_leftover_after_shelf_life_is_wasted():
    demand = {_day(i): 10.0 for i in range(1, 6)}
    # 2일 보관: 1·2일차에 20 을 쓰고 남은 30 은 2일차 끝에 폐기, 3~5일차는 품절
    r = simulate_ingredient(demand, {_day(0): 50.0}, _day(0), _day(5), lead_time=1, shelf_life=2)
    assert r["waste"] == 30.0
    assert r["short"] == 30.0


def test_stock_and_pending_are_subtracted_from_next_order():
    demand = {_day(i): 10.0 for i in range(1, 5)}
    # 0일차 40 발주(4일 보관) → 2일차 남은 재고 20 + 진행 중 0 이므로 필요량 20 이면 추가 발주 없음
    r = simulate_ingredient(demand, {_day(0): 40.0, _day(2): 20.0}, _day(0), _day(4), lead_time=1, shelf_life=4)
    assert r["received"] == 40.0
    assert r["short"] == 0.0


def test_oldest_lot_is_used_first():
    demand = {_day(1): 5.0, _day(2): 0.0, _day(3): 10.0}
    # 1일차 입고 10(2일 보관, 2일차까지) 중 5 사용 → 남은 5 는 폐기. 3일차 입고 10 으로 3일차 수요 충족
    r = simulate_ingredient(demand, {_day(0): 10.0, _day(2): 10.0}, _day(0), _day(3), lead_time=1, shelf_life=2)
    assert r["waste"] == 5.0
    assert r["short"] == 0.0


def test_demand_before_first_arrival_is_not_counted():
    demand = {_day(0): 99.0, _day(1): 10.0}
    r = simulate_ingredient(demand, {_day(0): 10.0}, _day(0), _day(1), lead_time=1, shelf_life=3)
    assert r["demand"] == 10.0
    assert r["short"] == 0.0
