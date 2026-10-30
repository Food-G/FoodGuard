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

> 진행 현황·남은 작업·작업 규칙·기준 수치는 `docs/HANDOFF.md`. 새 세션은 그 문서부터 읽는다.

### 서비스 구조
- **Frontend**: React + TypeScript + Vite (포트 5173)
- **Backend**: Spring Boot 3.x + Java 17 + JPA (포트 8080), DB: TiDB Cloud (MySQL 호환)
- **AI Service**: FastAPI + Python 3.11 (포트 8000)

### 권한 (백엔드)
점주는 자기 매장만, 본사(HQ_ADMIN)는 전체. 본사 전용 경로는 `SecurityConfig`, 매장 소유 검사는 `security/StoreAccess*`(경로·본문의 storeId·userId·menuId·엔티티 id). 엔티티 `{id}` 경로를 새로 만들면 `StoreAccessInterceptor.ID_ENTITY`에 추가한다. 회원가입은 점주만.

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
├── simulate_orders.py           # 발주 시뮬레이션 (관행 규칙 vs FoodGuard 발주의 폐기·품절 비교)
├── compare_models.py            # 모델 비교 실험용 Prophet·LSTM (backtest.py --compare, requirements-experiment.txt, 운영 미사용)
├── tests/                       # pytest (requirements-dev.txt)
├── ml/
│   ├── demand_predictor.py      # 전체 매장·메뉴 글로벌 XGBoost (점 추정, 추천량 = 점추정 × safety_factor)
│   ├── calibration.py           # 식자재 단위 conformal 안전재고 보정 비율 (safety_factor)
│   └── feature_engineering.py  # 피처 생성 (날짜 + 날씨 + lag/rolling)
├── services/
│   ├── claude_cli.py           # claude -p 헤드리스 호출 (발주 근거 설명, 도구 없음·짧은 시스템 프롬프트·JSON 출력)
│   ├── prediction_service.py   # 예측 비즈니스 로직
│   ├── data_service.py         # DB 읽기/쓰기 (순수 SQL)
│   └── weather_service.py      # 기상청 API + Open-Meteo
└── routers/
    ├── prediction.py            # /api/predict/*
    ├── training.py              # /api/train/*
    ├── explain.py               # /api/explain/order — 발주 추천 근거 설명 (숫자는 바꾸지 않음)
    ├── events.py                # /api/events/parse — 점주 특이사항 메모 → 유형·증감 배율 (claude)
    └── recipes.py               # /api/recipes/draft — 메뉴명 → 매장 식자재 1개당 사용량 초안 (claude, 저장은 점주 확인 후)
```

### AI 예측 흐름
```
POST /api/predict/store/{id}
  → 기상청 단기예보(1~3일) + 중기예보(4~7일) 조회
  → SALES_DATA에서 전체 매장×메뉴 판매 이력 조회 → 매장 영업일 달력으로 정렬 (판매 없는 영업일 0, 휴무·미입력일·부분 입력일 제외, 품절일 표시)
  → Open-Meteo로 매장별 과거 날씨 조회 (학습용)
  → 글로벌 XGBoost 점 추정 모델 1회 학습 + 최근 4주 재학습으로 식자재 단위 안전재고 비율 보정 → 이 매장 메뉴별 7일 예측
  → PREDICTION_RESULT 테이블 저장 (predicted_qty + recommended_order_qty)
```

### DB 테이블 (AI 서비스 접근)
- `MENU` — 읽기 (활성 메뉴 목록)
- `SALES_DATA` — 읽기 (판매 이력, 학습 데이터)
- `STORE` — 읽기 (region 컬럼으로 날씨 좌표 조회)
- `SALES_DAY_FLAG` — 읽기 (휴무·품절 기록: 휴무일은 학습 제외·예측 0, 품절일은 학습 정답에서 제외)
- `STORE_EVENT_NOTE` — 읽기 (점주 특이사항을 claude 가 바꾼 증감 배율 → `event_lift` 피처. 학습 이력에 특이사항 날이 있을 때만 사용, 예측에 직접 곱하지 않음)
- `PREDICTION_RESULT` — 쓰기 (예측 결과 저장)

### 모델 전략 (글로벌 모델, `ml/demand_predictor.py`)
메뉴마다 따로 학습하지 않고 **전체 매장×메뉴 이력을 하나의 XGBoost로 학습**한다 (Montero-Manso & Hyndman 2021).
- 정답은 `판매량 / scale`, `scale = 메뉴 규모(최근 28영업일, 요일 효과 제거) × 매장 요일 비율`. 모델은 이 기준값에 대한 보정 비율을 학습한다
- 매장 요일 비율은 같은 매장 전체 메뉴 판매량으로 추정 (`feature_engineering.store_weekday_ratio`)
- 피처: `GLOBAL_FEATURE_COLS` + 매장·메뉴 ID(범주형) + 날씨 6종(조회된 매장만). 손실은 L1
- 이력 1~6일 신메뉴도 같은 모델로 예측, 이력 0이면 0 반환. 전체 학습 행이 `MIN_DATA_POINTS` 미만이면 요일 평균

lag 피처(`lag_7`, `lag_14`)는 행 위치가 아니라 **달력 기준 같은 요일** 값이며(`feature_engineering.weekday_lag`), 7일 앞을 한 모델로 예측하므로 `lag_1`은 쓰지 않는다. 자세한 근거와 백테스트 결과는 `ai-service/PROJECT_STATUS.md` 10절.

### 성능 검증 (백테스트)
`ai-service`에서 `python backtest.py --synthetic` 또는 `python backtest.py --db --step 7`. 모델 변경 시 계절 나이브·요일 평균(4주)·이동평균(7일) 대비 wMAPE·MASE와 추천 발주량 커버리지(목표 60%)를 함께 확인한다.
발주 방법을 바꾸면 `python simulate_orders.py --db`(약 5분)로 폐기율·품절률·비용 지수를 관행 규칙과 비교한다 (PROJECT_STATUS 11절).

부분 입력일: 매장 전체 판매량이 직전 28영업일 중앙값의 40% 미만인 날은 수요가 아니라 입력 누락으로 보고 휴무처럼 뺀다 (`data_service.partial_entry_dates`).

신뢰도(confidence)는 R² 대신 **wMAPE** 기반: `clip(100 - wMAPE, 15, 95)`. 예측일이 멀수록 하루당 1.5% 감소 (최소 15%).

### 안전재고 (recommended_order_qty)
품절비용 vs 폐기비용의 뉴스벤더 모델(critical fractile)로 목표 분위수를 정한다. 원가 데이터가 DB에 없어 `COST_RATIO=0.4`(판매가의 40%)로 근사, critical fractile = `1 - COST_RATIO = 0.6`.
분위수는 메뉴·일자가 아니라 **식자재 7일 사용량 기준으로 한 번만** 적용한다 (`ml/calibration.py`, split conformal): 최근 4주 시점을 재학습해 식자재 `실제/예측` 사용량 비율의 0.6 분위수(`safety_factor`)를 구하고 `recommended_order_qty = 점추정 × safety_factor`. 백엔드 `recommend()`가 레시피로 합산하면 식자재 단위 분위수가 된다. 자세한 배경은 `ai-service/PROJECT_STATUS.md` 5절·10절 P1-2.
백엔드는 식자재마다 `리드타임 − 1 + min(발주 주기, 보관기한)`일 안의 추천량만 발주한다 (`INGREDIENT.shelf_life_days·lead_time_days·order_cycle_days`, 비면 7일치. 10절 P1-3).

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
