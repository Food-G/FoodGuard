# FoodGuard AI 수요예측 서비스 — 진행 현황

> 마지막 업데이트: 2026-10-16 (10절: P0 측정 기반, P1 글로벌 모델)
> 목적: 지금까지 구현된 내용을 정리 (RandomForest → XGBoost 전환 + 평가지표/안전재고 개선 완료)

## 1. 개요

FastAPI 기반 AI 서비스. Spring Boot 백엔드가 REST로 호출하면, 매장의 판매 이력 + 날씨 데이터로 XGBoost 모델을 학습해 7일치 메뉴별 수요를 예측하고 `PREDICTION_RESULT` 테이블에 저장한다.

```
Spring Boot ──POST /api/predict/store/{id}──▶ AI Service (FastAPI)
                                                  │
                                    ┌─────────────┼──────────────┐
                                    ▼             ▼              ▼
                              기상청 예보    SALES_DATA 조회   Open-Meteo
                              (단기+중기)    (TiDB, 판매이력)   (과거 날씨, 학습용)
                                    │             │              │
                                    └─────────────┴──────────────┘
                                                  ▼
                                    XGBoost 점 추정 모델 + Quantile 모델
                                                  ▼
                              predicted_qty + recommended_order_qty (안전재고)
                                                  ▼
                                        PREDICTION_RESULT 테이블 저장
```

## 2. 파일별 구현 상태

| 파일 | 역할 | 상태 |
|---|---|---|
| `ml/demand_predictor.py` | `DemandPredictor` — 전체 매장×메뉴 글로벌 점 추정 `XGBRegressor` + 안전재고용 quantile `XGBRegressor` | XGBoost 전환 (2026-09-11), 글로벌 모델로 교체 (2026-10-16, 10절) |
| `ml/feature_engineering.py` | 날짜/lag/rolling/날씨 피처 (총 22개) | 변경 없음 — 기존 피처셋으로 충분하다고 판단 |
| `services/weather_service.py` | Open-Meteo(과거) + 기상청 단기·중기예보(미래) | 변경 없음 |
| `services/prediction_service.py` | 학습→예측→저장 오케스트레이션 | score 스케일 수정 |
| `services/data_service.py` | TiDB 순수 SQL 읽기/쓰기 | `recommended_order_qty` 컬럼 추가 |
| `routers/prediction.py`, `routers/training.py` | `/api/predict/*`, `/api/train/*` | `recommended_order_qty` 필드 추가 |
| `schemas/schemas.py` | Pydantic 응답 스키마 | `PredictionItem.recommended_order_qty` 추가 |
| `config.py` | 환경설정 | `COST_RATIO` (원가 근사치) 추가 |
| `trained_models/global_model.joblib` | 글로벌 모델 1개 | 메뉴별 `store_X_menu_Y.joblib` 은 더 이상 쓰지 않음 (2026-10-16) |

## 3. 모델 전략 (2026-10-16: 글로벌 모델 1개)

| 메뉴 판매 이력 (영업일 행) | 전략 |
|---|---|
| 0개 | 0 반환 |
| 1개 이상 | 글로벌 XGBoost (신메뉴 포함, 구조는 10절 P1) |
| 전체 매장·메뉴 학습 행 합계 < `MIN_DATA_POINTS`(7) | 요일별 평균 + 요일별 경험적 분위수(안전재고) |

- 메뉴별 로컬 모델의 피처셋 3단계(`MINIMAL/MID/FULL_FEATURE_COLS`, `MIN_DATA_POINTS_MID/FULL`)는 삭제
- 과거 날씨가 조회되면 날씨 6종이 피처에 추가된다 (못 받은 매장은 결측으로 학습)
- `MODEL_VERSION = "xgb_global_v2.0"` (`prediction_service.py`)
- XGBoost 파라미터: `n_estimators=100, max_depth=3, learning_rate=0.03, min_child_weight=100, subsample=0.8, colsample_bytree=0.8`, L1 손실 (선택 근거는 10절 P1)

## 4. 평가지표 — R² → wMAPE 전환

- 기존: `cross_val_score(scoring="r2")` 기반 confidence = `R²×85`
- 변경: `cross_val_predict`로 out-of-fold 예측을 구해 **wMAPE**(가중 평균 절대 백분율 오차) 계산 → `confidence = clip(100 - wMAPE, 15, 95)`
- 사유: R²는 통계적 설명력 지표라 "실무에서 이 예측이 몇 % 정도 틀리는지"를 직접 말해주지 않음. wMAPE는 발주 현장에서 바로 해석 가능.
- 2026-10-16 글로벌 모델부터: 전체 학습 행을 날짜순으로 나눈 5-fold out-of-fold 예측으로 메뉴별 wMAPE 를 낸다. 학습 행 10개 미만 메뉴는 보수적 고정값 25.0

## 5. 안전재고 — Quantile Regression + 뉴스벤더 비용함수

- 원가 데이터가 DB에 없어 **근사치**를 사용: `COST_RATIO = 0.4` (원가 ≈ 판매가의 40%, `config.py`)
- 뉴스벤더 모델의 critical fractile: `q* = Cu / (Cu + Co) = 1 - COST_RATIO = 0.6`
  - `Co`(폐기비용) = `COST_RATIO × price`, `Cu`(품절비용) = `(1-COST_RATIO) × price` — price 값 자체는 비율만 쓰므로 계산에 직접 필요 없음
- XGBoost quantile 모델(`objective="reg:quantileerror", quantile_alpha=0.6`)을 점 추정 모델과 별도로 학습 → `recommended_order_qty`
- 모델을 학습할 수 없을 때(전체 학습 행 7개 미만)만 quantile 모델 대신 요일별 판매 이력의 **경험적 60번째 백분위수**(`np.percentile`)로 근사
- ⚠️ **단순화 지점**: `COST_RATIO`는 전 메뉴 공통 고정값이며 메뉴별 실제 원가와 다를 수 있음. 실제 원가 데이터가 생기면 메뉴별 값으로 교체 가능.

## 6. DB / 백엔드 / 프론트엔드 반영

- `PREDICTION_RESULT` 테이블에 `recommended_order_qty` 컬럼 추가 필요 — Spring Boot `spring.jpa.hibernate.ddl-auto=update`가 엔티티 변경분을 자동 반영하므로 **별도 ALTER TABLE 실행 없이 백엔드 재시작만 하면 됨**
- `PredictionResult.java`, `PredictionResultDto.java`에 `recommendedOrderQty` 필드 추가, `gradlew compileJava` 통과 확인
- `predictionService.ts`, `Predictions.tsx`에 추천 발주량 컬럼/요약 추가, `tsc --noEmit` 통과 확인 (기존 무관 경고 4건 제외)

## 7. 실행 순서 (중요 — 순서 어기면 INSERT 실패)

1. **Spring Boot 백엔드 재시작** (Hibernate가 `recommended_order_qty` 컬럼을 TiDB에 자동 추가)
2. AI 서비스 재시작 (venv에 xgboost 설치됨)
3. 각 매장 재학습: `POST /api/train/{storeId}` (구 모델 파일을 전량 삭제했으므로 필수)
4. 프론트엔드에서 "AI 예측 실행"으로 확인

## 8. 자동발주 반영 완료 (2026-09-11)

- `backend/service/OrderRequestService.recommend()`가 이제 `predictedQty` 대신 `recommendedOrderQty`(안전재고 반영량)로 식자재 필요량을 계산함
- `recommendedOrderQty`가 없는 구 데이터(마이그레이션 이전 저장분)는 `predictedQty`로 안전하게 대체(null-safe fallback)
- ⚠️ `WastePredictionService`(폐기 예측)는 의도적으로 그대로 `predictedQty` 사용 — 폐기 예측은 "실제 팔릴 양"을 기준으로 해야 하므로 안전재고가 반영된 값을 쓰면 폐기량이 과소추정됨

## 9. 남은 제안 (미착수)

- 웹크롤링 기반 피처 추가는 보류 상태 유지 (요청 시에만 재검토)

## 10. P0 측정 기반 · P1 글로벌 모델 (2026-10-16)

「계획서 대비 진척 분석 및 논문 기반 고도화 방향」 문서의 P0 항목을 반영했다.

**예측 정확도 (이슈 1·2)**
- 판매 이력을 매장 영업일 달력으로 정렬 (`data_service.build_daily_calendar`): 영업일인데 이 메뉴 판매가 없으면 0, 매장 전체 판매가 없는 날(휴무·미입력)은 행에서 제외. 기존에는 판매 0인 날이 빠져 잘 안 팔리는 메뉴를 과대예측했다
- `lag_7`·`lag_14`를 행 위치(`shift`)가 아니라 달력 기준 같은 요일 값으로 계산하고, 학습·예측이 같은 함수(`feature_engineering.weekday_lag`)를 쓴다. 기존 예측 코드는 1~7일차 모두 같은 lag 를 넣어 2일차부터 다른 요일 값이 들어갔다
- `lag_1` 제거: 한 모델로 7일 앞을 예측하므로 2일차부터는 알 수 없는 값 (Ben Taieb et al. 2012)

**품절·휴무 (`SALES_DAY_FLAG`)** — 매출 입력 화면에서 기록
- 품절일: 판매량 < 수요이므로 학습 정답에서 제외 (lag 값으로는 사용)
- 휴무일: 학습 이력에서 제외, 미래 휴무일 예측은 0 → 발주 근거에서 빠짐
- 테이블은 백엔드가 만든다. 아직 없으면 AI 서비스는 "기록 없음"으로 동작

**측정용 로그 (백엔드)**
- `WASTE_RECORD`: 재고 화면 "폐기" 버튼 → 실제 폐기량·사유 기록 + 재고 차감
- `ORDER_REQUEST.recommended_qty`, `order_source`(AUTO/MANUAL): 발주 시점의 AI 추천량을 함께 저장 → 추천 적용률, 점주 수정량 분석

**백테스트 (`backtest.py`)** — rolling-origin, 각 시점까지의 이력만으로 학습해 7일 예측, 날씨 피처 제외

합성 데이터 (200일, 요일 패턴 + 15% 추세 + 포아송 잡음, 90일째부터 2일 간격 52개 시점):

| 방법 | wMAPE | MASE |
|---|---|---|
| 계절 나이브 | 19.6% | 1.079 |
| 요일 평균(4주) | 15.1% | 0.831 |
| 이동평균(7일) | 28.3% | 1.560 |
| DemandPredictor 수정 전 | 16.4% | 0.902 |
| **DemandPredictor 수정 후** | **15.2%** | **0.839** |

DB `SALES_DATA` (9개 매장 54개 메뉴, 출처 불명의 데모용 데이터로 보임, `--db --step 7`):

| 방법 | 수정 전 wMAPE / MASE | 수정 후 wMAPE / MASE |
|---|---|---|
| 계절 나이브 | 14.0% / 1.187 | 14.7% / 1.266 |
| 요일 평균(4주) | 11.4% / 0.996 | 12.0% / 1.084 |
| 이동평균(7일) | 19.5% / 2.165 | 19.9% / 2.201 |
| **DemandPredictor** | 14.4% / 1.417 | **12.7% / 1.099** |
| 추천 발주량 커버리지 (목표 60%) | 77.7% | 64.1% |

- 수정 후에는 판매 0인 영업일이 평가 대상에 들어가 베이스라인 수치도 바뀌었다. 같은 실행 안에서 비교하면 모델과 요일 평균(4주)의 차이가 3.0%p → 0.7%p로 줄었다
- 아직 요일 평균(4주)을 넘지 못한다. 넘는 것은 P1(글로벌 모델 등)의 게이트 2 과제
- 모든 방법에서 7일차 오차가 튄다(24~33%). 데모 데이터 끝부분의 패턴 때문으로 보이며 확인 필요

### P1. 글로벌 모델

메뉴별 로컬 XGBoost(메뉴당 30~96행)를 전체 매장×메뉴를 함께 학습하는 모델 1개로 바꿨다 (Montero-Manso & Hyndman 2021, M5). lag·달력 정의(`weekday_lag`, `build_daily_calendar`)는 그대로다.

**구조** (`ml/demand_predictor.py`)
- 정답 = 판매량 / scale, scale = 메뉴 규모 × 매장 요일 비율
  - 매장 요일 비율(`feature_engineering.store_weekday_ratio`): 매장 전체 판매량 최근 28영업일 중 같은 요일 평균 / 전체 평균. 같은 매장 메뉴 판매량을 합쳐 추정하므로 메뉴 하나의 요일별 표본 4개보다 잡음이 적다
  - 메뉴 규모(level): 최근 28영업일 판매량을 그날의 매장 요일 비율로 나눈 평균. 이력이 주말에 몰린 신메뉴도 규모가 부풀지 않는다
- 피처: 요일·주말·공휴일, lag_7·lag_14·rolling(scale 로 나눈 비율), 매장 요일 비율, log(규모), 이력 길이, 매장·메뉴 ID(범주형), 날씨 6종(있을 때)
- L1 손실(`reg:absoluteerror`): wMAPE·MASE 가 절대오차 기준이라 평균보다 중앙값 예측이 맞다
- 깊이 3, 트리 100개, learning_rate 0.03, min_child_weight 100: scale 주변의 작은 보정만 학습
- month·day_of_month 제외: 이력이 3~4개월이라 연 계절성을 배울 수 없다
- 신메뉴: 이력 1일부터 같은 모델로 예측한다 (학습에 없던 메뉴 ID 는 결측 → 공통 패턴)
- 운영: 예측 요청마다 전체 이력을 한 번에 읽어(`data_service.get_all_sales_data`, 쿼리 2개 약 1초. 기존 `get_sales_data` 를 메뉴마다 부르면 54메뉴 18초라 대체·삭제) 매장별 과거 날씨와 함께 학습(약 1초) → 요청 매장의 활성 메뉴 예측·저장

**백테스트** (`backtest.py`): 예측 시점마다 그날까지의 전체 매장×메뉴 이력으로 글로벌 모델을 한 번 학습한다. 베이스라인에 "매장 요일비율×28일 평균"(모델 scale 을 단순화한 값)을 추가했다. `--store` 는 평가 대상만 줄이고 학습은 전체 매장으로 한다. `--cold-start` 추가. DB 백테스트 실행 시간 2분 → 24초

DB `SALES_DATA` (`--db --step 7`, 49개 메뉴 283개 시점 1,868 평가일 — P0 와 같은 평가셋):

| 방법 | wMAPE | MASE |
|---|---|---|
| 계절 나이브 | 14.7% | 1.266 |
| 요일 평균(4주) | 12.0% | 1.084 |
| 이동평균(7일) | 19.9% | 2.201 |
| 매장 요일비율×28일 평균 (신규 베이스라인) | 11.5% | 1.051 |
| DemandPredictor P0 (메뉴별 로컬) | 12.7% | 1.099 |
| **DemandPredictor P1 (글로벌)** | **11.6%** | **1.037** |
| 추천 발주량 커버리지 (목표 60%) | P0 64.1% → P1 64.7% | |

- **게이트 2 통과**: 요일 평균(4주) 대비 wMAPE −0.4%p, MASE −0.047
- 예측 시점을 1~6일씩 밀어(`--min-train 29`~`34`) 6번 더 돌려도 7번 모두 두 지표에서 요일 평균(4주)보다 낮다 (wMAPE −0.4~0.5%p, MASE −0.04~0.06)
- **이득의 대부분은 매장 단위 요일 패턴 공유에서 나온다.** 단순 베이스라인 "매장 요일비율×28일 평균"이 wMAPE 에서 모델과 같거나 0.1%p 낮고, 모델은 MASE(메뉴별 평균)에서만 0.01~0.03 낫다. wMAPE 는 판매량의 약 68%를 차지하는 매장 60005 가 좌우하는데 여기서는 모델 보정 효과가 거의 없다
- 선택 과정 주의: L1 손실, month 제외, scale 정의, 하이퍼파라미터는 같은 DB 백테스트를 보며 고른 값이다 (seed 3개, 시점 이동 6회로 일부 보완). 데이터가 늘면 다시 검증해야 한다
- 합성 데이터(`--synthetic`, 시계열 1개): 14.8% / 0.817 (P0 로컬 15.2% / 0.839, 요일 평균(4주) 15.1% / 0.831), 커버리지 69.8%

신메뉴 (`--db --cold-start`): 35영업일째 매장에 k일 전 출시한 메뉴로 보고 그 메뉴 이력만 최근 k일로 줄여 7일 예측 (41개 메뉴, wMAPE)

| 방법 | 이력 1일 | 이력 3일 | 이력 5일 |
|---|---|---|---|
| 요일 평균(4주) (= P0 신메뉴 처리, 반올림만 다름) | 26.5% | 20.1% | 17.4% |
| 매장 요일비율×28일 평균 | 22.4% | 14.0% | 11.8% |
| **DemandPredictor P1 (글로벌)** | **13.7%** | **11.4%** | 12.4% |

- 메뉴 규모를 단순 28일 평균으로 두면 21.7% / 14.7% / 12.7% 였다. 위 DB 백테스트 정확도는 두 방식이 같았다 (11.6% / 1.038 vs 1.037)
- 이력 5일에서는 단순 베이스라인보다 0.6%p 못하다

**7일차 오차 튐 (P0 의 "확인 필요")**: 데모 데이터의 부분 입력일 때문이다. 매장 전체 판매량이 그 매장 중앙값의 40% 미만인 날이 6개 있고(60005 의 05-22·06-05·06-18·06-19, 90001 의 05-15, 60004 의 10-16), 이날 판매량(예: 60005 06-05 매장 전체 13개, 평소 900~1,300개)을 수요로 평가해 모든 방법이 같이 틀린다. 이 22개 평가일만 빼면 요일 평균(4주)의 7일차 wMAPE 는 23.8% → 11.4%, 전체는 12.0% → 10.4% 다 (세션 내 분석, 공식 평가셋은 바꾸지 않음). 운영 데이터에서는 입력이 덜 된 날을 휴무처럼 표시할 방법이 필요하다
