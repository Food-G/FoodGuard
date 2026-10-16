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
├── backtest.py                  # rolling-origin 백테스트 (모델 vs 베이스라인 3종, wMAPE·MASE)
├── tests/                       # pytest (requirements-dev.txt)
├── ml/
│   ├── demand_predictor.py      # XGBoost 점 추정 모델 + quantile(안전재고) 모델 (학습/예측)
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
  → SALES_DATA에서 판매 이력 조회 → 매장 영업일 달력으로 정렬 (판매 없는 영업일 0, 휴무·미입력일 제외, 품절일 표시)
  → Open-Meteo로 과거 날씨 조회 (학습용)
  → XGBoost 점 추정 모델 + quantile 모델(안전재고) 학습 → 7일 예측
  → PREDICTION_RESULT 테이블 저장 (predicted_qty + recommended_order_qty)
```

### DB 테이블 (AI 서비스 접근)
- `MENU` — 읽기 (활성 메뉴 목록)
- `SALES_DATA` — 읽기 (판매 이력, 학습 데이터)
- `STORE` — 읽기 (region 컬럼으로 날씨 좌표 조회)
- `SALES_DAY_FLAG` — 읽기 (휴무·품절 기록: 휴무일은 학습 제외·예측 0, 품절일은 학습 정답에서 제외)
- `PREDICTION_RESULT` — 쓰기 (예측 결과 저장)

### 모델 전략 (`DemandPredictor.fit`, 영업일 행 수 기준)
| 데이터 수 | 전략 | 피처셋 |
|---|---|---|
| 0개 | 0 반환 | — |
| 1~6개 | 요일 평균 + 요일별 경험적 분위수(안전재고) | — |
| 7~14개 | XGBoost | MINIMAL_FEATURE_COLS |
| 15~29개 | XGBoost | MID_FEATURE_COLS |
| ≥ 30개 | XGBoost | FULL_FEATURE_COLS |

과거 날씨가 조회되면 모든 XGBoost 단계에 날씨 6종이 추가된다. lag 피처(`lag_7`, `lag_14`)는 행 위치가 아니라 **달력 기준 같은 요일** 값이며(`feature_engineering.weekday_lag`), 7일 앞을 한 모델로 예측하므로 `lag_1`은 쓰지 않는다.

### 성능 검증 (백테스트)
`ai-service`에서 `python backtest.py --synthetic` 또는 `python backtest.py --db --step 7`. 모델 변경 시 계절 나이브·요일 평균(4주)·이동평균(7일) 대비 wMAPE·MASE와 추천 발주량 커버리지(목표 60%)를 함께 확인한다.

신뢰도(confidence)는 R² 대신 **wMAPE** 기반: `clip(100 - wMAPE, 15, 95)`. 예측일이 멀수록 하루당 1.5% 감소 (최소 15%).

### 안전재고 (recommended_order_qty)
품절비용 vs 폐기비용의 뉴스벤더 모델(critical fractile)로 목표 분위수를 정한 XGBoost quantile 모델(`objective="reg:quantileerror"`)로 산출. 원가 데이터가 DB에 없어 `COST_RATIO=0.4`(판매가의 40%)로 근사, critical fractile = `1 - COST_RATIO = 0.6`. 자세한 배경은 `ai-service/PROJECT_STATUS.md` 참조.

### 날씨 피처 (6개)
`temp_max`, `temp_min`, `precipitation`, `is_rainy`, `is_hot`, `is_cold`

### 환경변수 (.env)
```
# ai-service/.env
DB_URL=mysql+pymysql://...
KMA_API_KEY=기상청_공공데이터_API_키

# backend/.env (application.properties 가 spring.config.import 로 읽음, 커밋 금지)
DB_PASSWORD=...
JWT_SECRET=...
```

---
**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
