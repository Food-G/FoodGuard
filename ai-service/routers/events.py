"""
점주 특이사항(예: "단체 예약 30명", "근처 축제") → claude 가 유형과 예상 증감 배율로 바꾼다.
배율은 수요 예측에 직접 곱하지 않고 XGBoost 의 피처(event_lift)로만 들어간다. 저장 시점에 한 번 변환해
DB 에 남기므로 같은 데이터로 다시 학습하면 같은 결과가 나온다.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.claude_cli import ClaudeCliError, run_structured

router = APIRouter()

# 배율 허용 범위 (지어낸 극단값이 피처를 흔들지 않게)
MIN_LIFT, MAX_LIFT = 0.3, 3.0

EVENT_TYPES = ["RESERVATION", "LOCAL_EVENT", "PROMOTION", "WEATHER", "SUPPLY", "OTHER"]

SYSTEM_PROMPT = """너는 음식점 점주가 적은 특정 날짜의 특이사항 메모를 수요 예측용 숫자로 바꾼다.
- eventType: RESERVATION(단체 예약·케이터링), LOCAL_EVENT(근처 축제·행사·시험·공휴일 연휴), PROMOTION(할인·신메뉴 홍보),
  WEATHER(폭우·폭설 등 점주가 적은 날씨), SUPPLY(재료 부족·일부 메뉴 판매 중단), OTHER
- lift: 그날 매장 전체 판매량이 평소 대비 몇 배일지 추정한 배율. 평소=1.0, 30% 증가=1.3, 절반=0.5. 0.3~3.0 사이
  메모에 인원·수량이 있으면 평소 하루 판매량(입력의 usualDailySales, 없으면 모른다고 보고 보수적으로)에 비해 추정한다
- 근거가 약하면 1.0 에 가깝게, 지어내지 않는다. reason 은 한 문장"""

SCHEMA = {
    "type": "object",
    "properties": {
        "eventType": {"type": "string", "enum": EVENT_TYPES},
        "lift": {"type": "number"},
        "reason": {"type": "string"},
    },
    "required": ["eventType", "lift", "reason"],
    "additionalProperties": False,
}


class ParseEventRequest(BaseModel):
    note: str
    eventDate: Optional[str] = None
    usualDailySales: Optional[float] = None  # 그 매장 평소 하루 전체 판매량 (백엔드가 넘김)


@router.post("/parse")
def parse_event(req: ParseEventRequest):
    if not req.note.strip():
        raise HTTPException(status_code=400, detail="특이사항 내용이 비어 있습니다.")
    try:
        result = run_structured(SYSTEM_PROMPT, req.model_dump_json(), SCHEMA)
    except ClaudeCliError as e:
        raise HTTPException(status_code=503, detail=str(e))
    result["lift"] = round(min(max(float(result["lift"]), MIN_LIFT), MAX_LIFT), 2)
    return result
