"""레시피 입력 보조: claude 초안 중 매장 식자재 목록에 있는 것만, 저장 가능한 값으로 남긴다 (실제 CLI 는 부르지 않는다)."""

import pytest
from fastapi import HTTPException

import routers.recipes as recipes_router
from routers.recipes import Candidate, RecipeDraftRequest, draft_recipe
from services.claude_cli import ClaudeCliError


def _request():
    return RecipeDraftRequest(
        menuName="불고기 덮밥",
        ingredients=[Candidate(ingredientId=1, name="쌀", unit="g"),
                     Candidate(ingredientId=2, name="소고기", unit="g")],
    )


def test_keeps_only_known_positive_unique_items_and_valid_missing(monkeypatch):
    monkeypatch.setattr(recipes_router, "run_structured", lambda *a: {
        "items": [
            {"ingredientId": 1, "qtyPerUnit": 210.456, "reason": "밥 한 공기"},
            {"ingredientId": 1, "qtyPerUnit": 100, "reason": "중복"},
            {"ingredientId": 2, "qtyPerUnit": 0, "reason": "0"},
            {"ingredientId": 99, "qtyPerUnit": 50, "reason": "목록에 없음"},
        ],
        "missing": [
            {"name": "양파", "qtyPerUnit": 30, "unit": "g"},
            {"name": "간장", "qtyPerUnit": 1, "unit": "큰술"},
        ],
    })

    result = draft_recipe(_request())

    assert result["items"] == [{"ingredientId": 1, "qtyPerUnit": 210.46, "reason": "밥 한 공기"}]
    assert result["missing"] == [{"name": "양파", "qtyPerUnit": 30, "unit": "g"}]


def test_maps_cli_errors_and_rejects_empty_menu_name(monkeypatch):
    def fail(*a):
        raise ClaudeCliError("x")
    monkeypatch.setattr(recipes_router, "run_structured", fail)
    with pytest.raises(HTTPException) as e:
        draft_recipe(_request())
    assert e.value.status_code == 503

    with pytest.raises(HTTPException) as e:
        draft_recipe(RecipeDraftRequest(menuName="  ", ingredients=[]))
    assert e.value.status_code == 400
