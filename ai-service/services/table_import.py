"""
판매 내역 파일(POS 내보내기 CSV·XLSX) 해석. 어떤 POS 형식이든 Claude 는 '어느 열이 무엇인지'만 판단하고,
날짜·수량 값은 이 코드가 파일에서 직접 읽는다 (LLM 이 숫자를 옮겨 적지 않게).
"""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import date
from typing import Optional

import pandas as pd

MAX_ROWS = 20000


class TableImportError(ValueError):
    pass


def read_table(filename: str, content: bytes) -> list[list[str]]:
    """파일을 문자열 행 목록으로 읽는다."""
    name = filename.lower()
    if name.endswith(".xlsx"):
        try:
            df = pd.read_excel(io.BytesIO(content), header=None, dtype=object, engine="openpyxl")
        except Exception as e:
            raise TableImportError("엑셀 파일을 읽지 못했습니다.") from e
        rows = [["" if pd.isna(v) else str(v).strip() for v in row] for row in df.values.tolist()]
    elif name.endswith((".csv", ".txt")):
        for encoding in ("utf-8-sig", "cp949"):
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise TableImportError("파일 인코딩을 알 수 없습니다. UTF-8 또는 CP949 CSV 만 읽습니다.")
        delimiter = "\t" if text.split("\n", 1)[0].count("\t") > text.split("\n", 1)[0].count(",") else ","
        rows = [[c.strip() for c in row] for row in csv.reader(io.StringIO(text), delimiter=delimiter)]
    else:
        raise TableImportError("CSV 또는 XLSX 파일만 읽습니다.")
    rows = [r for r in rows if any(r)]
    if not rows:
        raise TableImportError("파일에 내용이 없습니다.")
    if len(rows) > MAX_ROWS:
        raise TableImportError(f"행이 너무 많습니다 ({len(rows)}행, 최대 {MAX_ROWS}행).")
    return rows


def _parse_date(value: str) -> Optional[date]:
    value = value.strip()
    if not re.search(r"\d", value):
        return None
    parsed = pd.to_datetime(value, errors="coerce")
    return None if pd.isna(parsed) else parsed.date()


def _parse_quantity(value: str) -> Optional[float]:
    try:
        return float(re.sub(r"[,\s개건]", "", value))
    except ValueError:
        return None


def extract_sales(
    rows: list[list[str]],
    header_row: int,
    date_column: Optional[int],
    menu_column: int,
    quantity_column: int,
    default_date: Optional[date],
) -> tuple[dict[tuple[date, str], int], dict[str, int]]:
    """
    {(날짜, 메뉴 원문): 수량 합계}, 건너뛴 행 수 {이유: 개수}.
    날짜 열이 없는 일 단위 보고서는 default_date 를 쓴다. 수량 합이 0 이하인 줄(취소만 있는 경우)은 뺀다.
    """
    width = max(len(r) for r in rows)
    for label, col in (("메뉴", menu_column), ("수량", quantity_column), ("날짜", date_column)):
        if col is not None and not 0 <= col < width:
            raise TableImportError(f"{label} 열을 찾지 못했습니다.")
    if date_column is None and default_date is None:
        raise TableImportError("파일에 날짜 열이 없습니다. 판매 일자를 지정해 주세요.")

    totals: dict[tuple[date, str], float] = defaultdict(float)
    skipped: dict[str, int] = defaultdict(int)
    for row in rows[header_row + 1:]:
        row = row + [""] * (width - len(row))
        name = row[menu_column].strip()
        day = default_date if date_column is None else _parse_date(row[date_column])
        qty = _parse_quantity(row[quantity_column])
        if not name:
            skipped["메뉴명 없음"] += 1
        elif day is None:
            skipped["날짜를 읽지 못함"] += 1
        elif qty is None:
            skipped["수량을 읽지 못함"] += 1
        else:
            totals[(day, name)] += qty
    result = {}
    for key, qty in totals.items():
        if qty != int(qty):
            skipped["수량이 정수가 아님"] += 1
        elif qty > 0:
            result[key] = int(qty)
    return result, dict(skipped)


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", name).lower()
