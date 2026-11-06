"""에이전트 응답 후처리: Claude 가 무엇을 돌려줘도 코드가 경계를 지킨다 (claude 호출은 가짜로 바꾼다)."""

import base64

import pytest
from fastapi.testclient import TestClient

from main import app
from routers import agents, ingest
from services.table_import import TableImportError, extract_sales, read_table

client = TestClient(app)


def fake(monkeypatch, module, *responses):
    queue = list(responses)
    calls = []

    def run(system_prompt, user_input, *rest):
        calls.append(user_input)
        return queue.pop(0)

    monkeypatch.setattr(module, "run_structured", run)
    return calls


def b64(text, encoding="utf-8"):
    return base64.b64encode(text.encode(encoding)).decode()


COLUMNS = {"found": True, "headerRow": 1, "dateColumn": 0, "menuColumn": 1, "quantityColumn": 2}
POS_CSV = "매장 판매 보고서\n일자,상품명,수량,금액\n2026-11-01,불고기 버거,3,15000\n2026-11-01,불고기 버거,2,10000\n2026-11-01,합계,5,25000\n2026-11-02,치즈버거세트,1,7000\n2026-11-02,콜라,x,0\n"
MENUS = [{"id": 1, "name": "불고기버거"}, {"id": 2, "name": "치즈버거"}]


def test_sales_file_reads_numbers_from_file_and_matches_menus(monkeypatch):
    fake(monkeypatch, ingest, COLUMNS, {"matches": [
        {"name": "치즈버거세트", "menuId": 2}, {"name": "합계", "menuId": None}, {"name": "콜라", "menuId": 999},
    ]})
    r = client.post("/api/ingest/sales-file", json={"filename": "pos.csv", "contentBase64": b64(POS_CSV), "menus": MENUS}).json()
    rows = {(x["saleDate"], x["rawName"]): x for x in r["rows"]}
    assert rows[("2026-11-01", "불고기 버거")]["quantity"] == 5  # 같은 날 줄 합계, 띄어쓰기 달라도 매칭
    assert rows[("2026-11-01", "불고기 버거")]["menuId"] == 1
    assert rows[("2026-11-02", "치즈버거세트")]["menuId"] == 2
    assert rows[("2026-11-01", "합계")]["menuId"] is None
    assert r["skipped"]["수량을 읽지 못함"] == 1


def test_sales_file_sample_is_limited(monkeypatch):
    calls = fake(monkeypatch, ingest, COLUMNS, {"matches": []})
    big = "h\n일자,상품명,수량\n" + "".join(f"2026-11-01,비밀메뉴{i},1\n" for i in range(100))
    client.post("/api/ingest/sales-file", json={"filename": "pos.csv", "contentBase64": b64(big), "menus": MENUS})
    assert "비밀메뉴50" not in calls[0]


def test_cp949_and_rejected_types():
    assert read_table("a.csv", "일자,상품\n1,2\n".encode("cp949"))[0] == ["일자", "상품"]
    with pytest.raises(TableImportError):
        read_table("a.pdf", b"x")


def test_no_date_column_needs_default_date():
    rows = [["상품", "수량"], ["김밥", "3"]]
    with pytest.raises(TableImportError):
        extract_sales(rows, 0, None, 0, 1, None)


def test_invoice_drops_unknown_id_and_bad_values(monkeypatch):
    monkeypatch.setattr(ingest, "run_structured_image", lambda *a: {"items": [
        {"rawName": "양상추", "ingredientId": 7, "quantity": 8, "unit": "kg", "expiryDate": "2026-11-10"},
        {"rawName": "치즈", "ingredientId": 999, "quantity": 5, "unit": "개", "expiryDate": "내년"},
        {"rawName": "패티", "ingredientId": 8, "quantity": 0, "unit": "개", "expiryDate": None},
        {"rawName": "쌀", "ingredientId": 9, "quantity": 10, "unit": "포", "expiryDate": "2026-13-40"},
    ], "unreadable": []})
    r = client.post("/api/ingest/invoice", json={
        "contentBase64": b64("img"), "mediaType": "image/png",
        "ingredients": [{"id": 7, "name": "양상추", "unit": "kg"}, {"id": 8, "name": "패티", "unit": "개"}, {"id": 9, "name": "쌀", "unit": "kg"}],
    }).json()
    by_name = {i["rawName"]: i for i in r["items"]}
    assert by_name["양상추"]["ingredientId"] == 7 and not by_name["양상추"]["unitMismatch"]
    assert by_name["치즈"]["ingredientId"] is None and by_name["치즈"]["expiryDate"] is None
    assert by_name["쌀"]["unitMismatch"] and by_name["쌀"]["expiryDate"] is None
    assert r["unreadable"] == ["패티"]


def test_invoice_exact_name_matches_when_model_leaves_it_empty(monkeypatch):
    monkeypatch.setattr(ingest, "run_structured_image", lambda *a: {"items": [
        {"rawName": "체다치즈(슬라이스)", "ingredientId": None, "quantity": 5, "unit": "개", "expiryDate": None},
        {"rawName": "소금", "ingredientId": None, "quantity": 1, "unit": "kg", "expiryDate": None},
    ], "unreadable": []})
    r = client.post("/api/ingest/invoice", json={
        "contentBase64": b64("img"), "mediaType": "image/png",
        "ingredients": [{"id": 7, "name": "체다치즈", "unit": "kg"}, {"id": 8, "name": "소금", "unit": "kg"}, {"id": 9, "name": "소금", "unit": "kg"}],
    }).json()["items"]
    assert (r[0]["ingredientId"], r[0]["unitMismatch"]) == (7, True)
    assert r[1]["ingredientId"] is None  # 같은 이름이 둘이면 고르지 않는다


def test_invoice_rejects_other_types():
    r = client.post("/api/ingest/invoice", json={"contentBase64": b64("x"), "mediaType": "application/pdf", "ingredients": []})
    assert r.status_code == 400


def test_ingredient_settings_clamped_and_history_wins(monkeypatch):
    fake(monkeypatch, agents, {"items": [
        {"ingredientId": 1, "shelfLifeDays": 9999, "storage": "냉동", "orderCycleDays": 99, "leadTimeDays": 0, "reason": "r"},
        {"ingredientId": 2, "shelfLifeDays": 3, "storage": "냉장", "orderCycleDays": 2, "leadTimeDays": 1, "reason": "r"},
        {"ingredientId": 3, "shelfLifeDays": 3, "storage": "냉장", "orderCycleDays": 2, "leadTimeDays": 1, "reason": "모르는 id"},
    ]})
    r = client.post("/api/agents/ingredient-settings", json={"items": [
        {"ingredientId": 1, "name": "냉동 패티"}, {"ingredientId": 2, "name": "양상추", "observedCycleDays": 4, "observedLeadDays": 2},
    ]}).json()["items"]
    assert len(r) == 2
    assert (r[0]["shelfLifeDays"], r[0]["orderCycleDays"], r[0]["leadTimeDays"]) == (365, 7, 1)
    assert (r[1]["orderCycleDays"], r[1]["cycleSource"], r[1]["leadTimeDays"]) == (3, "history", 2)  # 보관 3일보다 길 수 없다


def test_order_review_cannot_increase_and_fills_missing(monkeypatch):
    fake(monkeypatch, agents, {"summary": "s", "recommendation": "revise", "concerns": [], "items": [
        {"ingredientId": 1, "verdict": "reduce", "suggestedQty": 500, "reason": "늘리려는 시도"},
        {"ingredientId": 2, "verdict": "hold", "suggestedQty": 5, "reason": "r"},
        {"ingredientId": 3, "verdict": "approve", "suggestedQty": 1, "reason": "r"},
        {"ingredientId": 99, "verdict": "approve", "suggestedQty": 1, "reason": "없는 식자재"},
    ]})
    items = client.post("/api/agents/order-review", json={"items": [
        {"ingredientId": i, "orderQty": 10} for i in (1, 2, 3, 4)
    ]}).json()["items"]
    assert {i["ingredientId"]: i["suggestedQty"] for i in items} == {1: 10, 2: 0, 3: 10, 4: 10}


def test_order_review_empty_skips_claude():
    r = client.post("/api/agents/order-review", json={"items": [], "warnings": ["예측 없음"]}).json()
    assert r["recommendation"] == "wait" and r["concerns"] == ["예측 없음"]


def test_weekly_report_keeps_flagged_stores_only(monkeypatch):
    fake(monkeypatch, agents, {"headline": "매출 1,200원", "actions": ["a", "b", "c", "d"], "stores": [
        {"storeId": 1, "finding": "f", "hypothesis": "h"}, {"storeId": 2, "finding": "f", "hypothesis": "h"},
    ]})
    r = client.post("/api/agents/hq-weekly", json={"periodStart": "2026-11-01", "periodEnd": "2026-11-07", "stores": [
        {"storeId": 1, "revenue": 1200, "flags": ["DROP"]}, {"storeId": 2, "revenue": 5, "flags": []},
    ]}).json()
    assert [s["storeId"] for s in r["stores"]] == [1]
    assert len(r["actions"]) == 3
    assert r["unverifiedNumbers"] == []


def test_assistant_flags_numbers_not_in_data(monkeypatch):
    fake(monkeypatch, agents, {"answer": "양상추 재고는 12.5kg, 내일 예측은 37개입니다.", "answerable": True, "sources": ["inventory"]})
    r = client.post("/api/agents/assistant", json={"question": "재고?", "data": {"inventory": [{"qty": 12.5}]}}).json()
    assert r["unverifiedNumbers"] == ["37"]


def test_assistant_rejects_empty_and_long_questions():
    assert client.post("/api/agents/assistant", json={"question": " ", "data": {}}).status_code == 400
    assert client.post("/api/agents/assistant", json={"question": "가" * 301, "data": {}}).status_code == 400
