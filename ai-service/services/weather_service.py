"""날씨 데이터 서비스.

- 과거 날씨 (학습용): Open-Meteo Archive API (무료, 키 없음)
- 예보 (예측용): 기상청 공공데이터포털 단기/중기예보 API
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 공통
# ---------------------------------------------------------------------------

WEATHER_FEATURE_COLS = [
    "temp_max", "temp_min", "precipitation",
    "is_rainy", "is_hot", "is_cold",
]

# 날씨 문자열 중 강수로 분류하는 키워드 (중기예보용)
_RAINY_KEYWORDS = {"비", "눈", "소나기", "빗방울", "진눈깨비"}

# ---------------------------------------------------------------------------
# Open-Meteo (과거 날씨 — 학습 데이터용)
# ---------------------------------------------------------------------------

_OPENMETEO_COORDS: dict[str, tuple[float, float]] = {
    "서울": (37.5665, 126.9780), "인천": (37.4563, 126.7052),
    "경기": (37.4138, 127.5183), "강원": (37.8228, 128.1555),
    "충북": (36.6357, 127.4917), "충남": (36.5184, 126.8000),
    "대전": (36.3504, 127.3845), "세종": (36.4800, 127.2890),
    "전북": (35.7175, 127.1530), "전남": (34.8679, 126.9910),
    "광주": (35.1595, 126.8526), "경북": (36.4919, 128.8889),
    "경남": (35.4606, 128.2132), "대구": (35.8714, 128.6014),
    "부산": (35.1796, 129.0756), "울산": (35.5384, 129.3114),
    "제주": (33.4996, 126.5312),
}
_DEFAULT_COORDS = (37.5665, 126.9780)  # 서울


def is_fallback_region(region: Optional[str]) -> bool:
    """get_coords 가 기본 좌표(서울)로 넘어가는 region 인가 (날씨 피처가 틀어질 수 있음)."""
    return not region or not any(key in region for key in _OPENMETEO_COORDS)


def get_coords(region: Optional[str]) -> tuple[float, float]:
    if not region:
        logger.warning("매장 region 이 비어 있어 기본 좌표(서울)를 사용합니다.")
        return _DEFAULT_COORDS
    for key, coords in _OPENMETEO_COORDS.items():
        if key in region:
            return coords
    # 조용히 서울로 넘어가면 지방 매장의 날씨 피처가 잘못 학습된다
    logger.warning(
        "region=%r 이 알려진 시·도(%s) 중 어느 것과도 매칭되지 않아 "
        "기본 좌표(서울)를 사용합니다.",
        region, ", ".join(_OPENMETEO_COORDS),
    )
    return _DEFAULT_COORDS


def fetch_historical_weather(
    lat: float, lon: float, start_date: date, end_date: date
) -> pd.DataFrame:
    """Open-Meteo로 과거 날씨 조회 (모델 학습용, 어제까지만 가능)."""
    end_date = min(end_date, date.today() - timedelta(days=1))
    if start_date > end_date:
        return pd.DataFrame()
    try:
        resp = requests.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat, "longitude": lon,
                "start_date": str(start_date), "end_date": str(end_date),
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode",
                "timezone": "Asia/Seoul",
            },
            timeout=10,
        )
        resp.raise_for_status()
        daily = resp.json()["daily"]
        df = pd.DataFrame({
            "ds": [pd.Timestamp(d).date() for d in daily["time"]],
            "temp_max": daily["temperature_2m_max"],
            "temp_min": daily["temperature_2m_min"],
            "precipitation": daily["precipitation_sum"],
            "weathercode": daily["weathercode"],
        })
        df["is_rainy"] = df["weathercode"].apply(
            lambda c: int(int(c) in {51,53,55,56,57,61,63,65,66,67,80,81,82,85,86,95,96,99})
            if c is not None else 0
        )
        df["is_hot"] = (df["temp_max"].fillna(0) >= 30).astype(int)
        df["is_cold"] = (df["temp_max"].fillna(99) <= 5).astype(int)
        for col in ["temp_max", "temp_min", "precipitation"]:
            df[col] = df[col].fillna(0.0)
        return df[["ds"] + WEATHER_FEATURE_COLS]
    except Exception:
        return pd.DataFrame()


# ---------------------------------------------------------------------------
# 기상청 공공데이터포털 (예보 — 예측용)
# ---------------------------------------------------------------------------

_KMA_BASE = "http://apis.data.go.kr/1360000"

# 단기예보 격자 좌표 (nx, ny) — LCC 투영
_KMA_GRID: dict[str, tuple[int, int]] = {
    "서울": (60, 127), "인천": (55, 124), "경기": (60, 121),
    "강원": (73, 134), "충북": (69, 107), "충남": (68, 100),
    "대전": (67, 100), "세종": (66, 103),
    "전북": (63, 89),  "전남": (51, 67),  "광주": (58, 74),
    "경북": (87, 106), "대구": (89, 90),
    "경남": (91, 77),  "부산": (98, 76),  "울산": (102, 84),
    "제주": (52, 38),
}
_DEFAULT_GRID = (60, 127)

# 중기 육상예보 지역코드
_KMA_MID_LAND: dict[str, str] = {
    "서울": "11B00000", "인천": "11B00000", "경기": "11B00000",
    "강원": "11D10000",
    "충북": "11C10000", "충남": "11C20000", "대전": "11C20000", "세종": "11C20000",
    "전북": "11F10000", "전남": "11F20000", "광주": "11F20000",
    "경북": "11H10000", "대구": "11H10000",
    "경남": "11H20000", "부산": "11H20000", "울산": "11H20000",
    "제주": "11G00000",
}
_DEFAULT_MID_LAND = "11B00000"

# 중기 기온예보 지역코드
_KMA_MID_TA: dict[str, str] = {
    "서울": "11B10101", "인천": "11B20201", "경기": "11B20601",
    "강원": "11D10301", "충북": "11C10301", "충남": "11C20401",
    "대전": "11C20401", "세종": "11C20401",
    "전북": "11F10201", "전남": "11F20501", "광주": "11F20501",
    "경북": "11H10701", "대구": "11H10701",
    "경남": "11H20301", "부산": "11H20201", "울산": "11H20101",
    "제주": "11G00201",
}
_DEFAULT_MID_TA = "11B10101"


def _get_region_codes(region: Optional[str]) -> tuple[tuple[int,int], str, str]:
    """지역명 → (격자, 중기육상코드, 중기기온코드)"""
    grid = _DEFAULT_GRID
    land = _DEFAULT_MID_LAND
    ta   = _DEFAULT_MID_TA
    if region:
        for key in _KMA_GRID:
            if key in region:
                grid = _KMA_GRID[key]
                land = _KMA_MID_LAND.get(key, _DEFAULT_MID_LAND)
                ta   = _KMA_MID_TA.get(key, _DEFAULT_MID_TA)
                break
    return grid, land, ta


def _base_time_for_short() -> tuple[str, str]:
    """단기예보 base_date/base_time 계산 (발표 1시간 후부터 사용 가능)."""
    release_hours = [2, 5, 8, 11, 14, 17, 20, 23]
    now = datetime.now()
    for h in reversed(release_hours):
        if now.hour >= h + 1:
            return now.strftime("%Y%m%d"), f"{h:02d}00"
    prev = now - timedelta(days=1)
    return prev.strftime("%Y%m%d"), "2300"


def _tmfc_for_mid() -> str:
    """중기예보 발표 시각 (06:00 / 18:00)."""
    now = datetime.now()
    if now.hour >= 18:
        return now.strftime("%Y%m%d") + "1800"
    elif now.hour >= 6:
        return now.strftime("%Y%m%d") + "0600"
    else:
        return (now - timedelta(days=1)).strftime("%Y%m%d") + "1800"


def _fetch_short_term(nx: int, ny: int, api_key: str) -> pd.DataFrame:
    """단기예보 조회 → 일별 집계 (오늘~모레)."""
    base_date, base_time = _base_time_for_short()
    try:
        # serviceKey를 URL에 직접 포함 (requests params 자동 인코딩 방지)
        resp = requests.get(
            f"{_KMA_BASE}/VilageFcstInfoService_2.0/getVilageFcst?serviceKey={api_key}",
            params={
                "pageNo": 1, "numOfRows": 1000,
                "dataType": "JSON",
                "base_date": base_date, "base_time": base_time,
                "nx": nx, "ny": ny,
            },
            timeout=10,
        )
        resp.raise_for_status()
        items = resp.json()["response"]["body"]["items"]["item"]
    except Exception:
        return pd.DataFrame()

    # 날짜별로 모아서 일 집계
    daily: dict[str, dict] = {}
    for item in items:
        d   = item["fcstDate"]
        cat = item["category"]
        val = item["fcstValue"]
        rec = daily.setdefault(d, {"TMP": [], "PTY": [], "PCP": []})
        if cat == "TMP":
            try: rec["TMP"].append(float(val))
            except ValueError: pass
        elif cat == "PTY":
            try: rec["PTY"].append(int(val))
            except ValueError: pass
        elif cat == "PCP" and val not in ("강수없음", "-"):
            try: rec["PCP"].append(float(val.replace("mm", "").strip()))
            except ValueError: pass

    rows = []
    for d, rec in sorted(daily.items()):
        tmps = rec["TMP"]
        rows.append({
            "ds":            datetime.strptime(d, "%Y%m%d").date(),
            "temp_max":      max(tmps) if tmps else None,
            "temp_min":      min(tmps) if tmps else None,
            "precipitation": sum(rec["PCP"]),
            "is_rainy":      int(any(p != 0 for p in rec["PTY"])),
        })

    df = pd.DataFrame(rows)
    if not df.empty:
        df["is_hot"]  = (df["temp_max"].fillna(0) >= 30).astype(int)
        df["is_cold"] = (df["temp_max"].fillna(99) <= 5).astype(int)
    return df


def _fetch_mid_term(reg_land: str, reg_ta: str, api_key: str) -> pd.DataFrame:
    """중기 육상 + 기온 예보 조회 → day3~day7."""
    tmfc = _tmfc_for_mid()
    common = {"pageNo": 1, "numOfRows": 10, "dataType": "JSON", "tmFc": tmfc}
    try:
        land = requests.get(
            f"{_KMA_BASE}/MidFcstInfoService/getMidLandFcst?serviceKey={api_key}",
            params={**common, "regId": reg_land}, timeout=10,
        )
        land.raise_for_status()
        land_item = land.json()["response"]["body"]["items"]["item"][0]

        ta = requests.get(
            f"{_KMA_BASE}/MidFcstInfoService/getMidTa?serviceKey={api_key}",
            params={**common, "regId": reg_ta}, timeout=10,
        )
        ta.raise_for_status()
        ta_item = ta.json()["response"]["body"]["items"]["item"][0]
    except Exception:
        return pd.DataFrame()

    today = date.today()
    rows = []
    for offset in range(3, 8):  # 3~7일 후
        target = today + timedelta(days=offset)
        key = str(offset)
        wf_am = land_item.get(f"wf{key}Am", "")
        wf_pm = land_item.get(f"wf{key}Pm", "")
        is_rainy = int(
            any(kw in (wf_am + wf_pm) for kw in _RAINY_KEYWORDS)
        )
        try:
            temp_max = float(ta_item.get(f"taMax{key}", 0) or 0)
            temp_min = float(ta_item.get(f"taMin{key}", 0) or 0)
        except (ValueError, TypeError):
            temp_max = temp_min = None

        rows.append({
            "ds":            target,
            "temp_max":      temp_max,
            "temp_min":      temp_min,
            "precipitation": 0.0,   # 중기예보는 강수량 수치 미제공
            "is_rainy":      is_rainy,
            "is_hot":        int((temp_max or 0) >= 30),
            "is_cold":       int((temp_max or 99) <= 5),
        })

    return pd.DataFrame(rows)


def fetch_forecast_weather(
    region: Optional[str],
    api_key: str,
    days: int = 7,
) -> pd.DataFrame:
    """기상청 단기(오늘~2일) + 중기(3~7일) 예보 합산 반환.

    api_key가 비어있으면 빈 DataFrame 반환 (예측은 날씨 없이 동작).
    """
    if not api_key:
        return pd.DataFrame()

    grid, reg_land, reg_ta = _get_region_codes(region)
    nx, ny = grid

    short_df = _fetch_short_term(nx, ny, api_key)
    mid_df   = _fetch_mid_term(reg_land, reg_ta, api_key)

    if short_df.empty and mid_df.empty:
        return pd.DataFrame()

    combined = (
        pd.concat([short_df, mid_df], ignore_index=True)
        .drop_duplicates("ds")
        .sort_values("ds")
        .reset_index(drop=True)
    )

    today  = date.today()
    target_dates = {today + timedelta(days=i) for i in range(1, days + 1)}
    combined = combined[combined["ds"].isin(target_dates)].reset_index(drop=True)

    # 없는 날씨 피처 0으로 채움
    for col in WEATHER_FEATURE_COLS:
        if col not in combined.columns:
            combined[col] = 0.0

    return combined[["ds"] + WEATHER_FEATURE_COLS]
