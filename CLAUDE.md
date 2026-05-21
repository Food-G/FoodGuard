# CLAUDE.md — FoodGuard 프로젝트

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## FoodGuard 프로젝트 컨텍스트

### 서비스 구조
- **Frontend**: React + TypeScript + Vite (포트 5173)
- **Backend**: Spring Boot 3.x + Java 17 + JPA (포트 8080), DB: TiDB Cloud (MySQL 호환)
- **AI Service**: FastAPI + Python 3.11 (포트 8000)

### 실행 순서
1. AI Service (`ai-service/start.bat`)
2. Backend (`backend/gradlew.bat bootRun`)
3. Frontend (`frontend/npm run dev`)

### AI Service 핵심 구조
```
ai-service/
├── main.py                      # FastAPI 진입점
├── config.py                    # 환경설정 (.env: DB_URL, KMA_API_KEY)
├── ml/
│   ├── demand_predictor.py      # RandomForest 모델 (학습/예측)
│   └── feature_engineering.py  # 피처 생성 (날짜 + 날씨 + lag/rolling)
├── services/
│   ├── prediction_service.py   # 예측 비즈니스 로직
│   ├── data_service.py         # DB 읽기/쓰기 (순수 SQL)
│   └── weather_service.py      # 기상청 API + Open-Meteo
└── routers/
    ├── prediction.py            # /api/predict/*
    └── training.py              # /api/train/*
```

### AI 예측 흐름
```
POST /api/predict/store/{id}
  → 기상청 단기예보(1~3일) + 중기예보(4~7일) 조회
  → SALES_DATA에서 판매 이력 조회
  → Open-Meteo로 과거 날씨 조회 (학습용)
  → RandomForest 학습 → 7일 예측
  → PREDICTION_RESULT 테이블 저장
```

### DB 테이블 (AI 서비스 접근)
- `MENU` — 읽기 (활성 메뉴 목록)
- `SALES_DATA` — 읽기 (판매 이력, 학습 데이터)
- `STORE` — 읽기 (region 컬럼으로 날씨 좌표 조회)
- `PREDICTION_RESULT` — 쓰기 (예측 결과 저장)

### 모델 전략
| 데이터 수 | 전략 | 신뢰도 |
|---|---|---|
| < 7개 | 예측 불가 (0 반환) | 0% |
| 7~29개 | 요일 평균 단순 예측 | 40% ~ 31% (decay) |
| ≥ 30개 | RandomForest (날씨 피처 포함) | R²×85% (최대 95%) |

신뢰도는 예측일이 멀수록 하루당 1.5% 감소 (최소 15%).

### 날씨 피처 (6개)
`temp_max`, `temp_min`, `precipitation`, `is_rainy`, `is_hot`, `is_cold`

### 환경변수 (.env)
```
DB_URL=mysql+pymysql://...
KMA_API_KEY=기상청_공공데이터_API_키
```

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
