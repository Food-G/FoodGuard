"""에이전트 공통 LLM 출력 스키마."""

# 공통 LLM 출력 스키마. 제안(payload)은 LLM 이 아니라 각 에이전트의 결정적 코드가 만든다 (R4).
COMMON_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string", "description": "3~5문장, 결론 먼저"},
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                    "ingredientId": {"type": ["integer", "null"]},
                },
                "required": ["severity", "title", "detail", "ingredientId"],
                "additionalProperties": False,
            },
        },
        "concerns": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["summary", "findings", "concerns"],
    "additionalProperties": False,
}
