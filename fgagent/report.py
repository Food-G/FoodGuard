"""보고서용 표 (DEV_ROADMAP AG-5, R-1).  python -m fgagent report accuracy"""

from __future__ import annotations


def _pct(v) -> str:
    return "-" if v is None else f"{v:.1%}"


def render_accuracy(acc: dict, menu_names: dict[tuple[int, int], str]) -> str:
    """정확도 응답 → 매장·메뉴별 WAPE markdown. 수치는 오차율이다 (R6: confidence 를 정확도로 쓰지 않는다)."""
    o = acc["overall"]
    lines = [
        f"# 예측 오차 ({acc['source']}, {acc['period']['from']} ~ {acc['period']['to']})",
        "",
        "> 합성 판매 데이터(요일 효과 + ±10% 노이즈) 기준. WAPE 는 낮을수록 좋다. "
        "기준선 = 지난주 같은 요일 판매량을 그대로 쓴 경우.",
        "",
        f"전체 WAPE **{_pct(o['wape'])}**, 기준선 {_pct(o.get('baseline_wape'))}, 편향 {_pct(o['bias'])}, "
        f"{o['n']}건 (매장 {acc['stores']}, 메뉴 {acc['menus']}).",
        "",
        "| 매장 | 메뉴 | 건수 | WAPE | 기준선 WAPE | 편향 |",
        "|---|---|---:|---:|---:|---:|",
    ]
    for m in acc.get("byMenu", []):
        name = menu_names.get((m["storeId"], m["menuId"]), f"메뉴 {m['menuId']}")
        lines.append(f"| {m['storeId']} | {name} | {m['n']} | {_pct(m['wape'])} "
                     f"| {_pct(m.get('baseline_wape'))} | {_pct(m['bias'])} |")
    return "\n".join(lines)


def accuracy_report(client, source: str = "backtest") -> str:
    acc = client.get(f"/api/predictions/accuracy?source={source}")
    if not isinstance(acc, dict) or "error" in acc:
        raise RuntimeError(f"정확도 조회 실패: {acc}")
    names: dict[tuple[int, int], str] = {}
    for sid in sorted({m["storeId"] for m in acc.get("byMenu", [])}):
        menus = client.get(f"/api/menus/{sid}")
        if isinstance(menus, list):
            names.update({(sid, m["id"]): m.get("menuName") for m in menus})
    return render_accuracy(acc, names)
