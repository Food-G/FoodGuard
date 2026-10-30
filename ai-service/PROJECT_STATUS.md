# FoodGuard AI 수요예측 서비스 — 진행 현황

> 마지막 업데이트: 2026-10-21 (10절: P0 측정 기반, P1 글로벌 모델, P1-2 식자재 단위 안전재고)
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
| `ml/demand_predictor.py` | `DemandPredictor` — 전체 매장×메뉴 글로벌 점 추정 `XGBRegressor`, 추천량 = 점추정 × `safety_factor` | XGBoost 전환 (2026-09-11), 글로벌 모델로 교체 (2026-10-16), quantile 모델 제거 (2026-10-21, 10절 P1-2) |
| `ml/calibration.py` | 식자재 단위 conformal 안전재고 보정 비율 (`safety_factor`) | 신규 (2026-10-21) |
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
- `MODEL_VERSION = "xgb_global_v2.1"` (`prediction_service.py`, v2.1 = 식자재 단위 conformal 안전재고)
- XGBoost 파라미터: `n_estimators=100, max_depth=3, learning_rate=0.03, min_child_weight=100, subsample=0.8, colsample_bytree=0.8`, L1 손실 (선택 근거는 10절 P1)

## 4. 평가지표 — R² → wMAPE 전환

- 기존: `cross_val_score(scoring="r2")` 기반 confidence = `R²×85`
- 변경: `cross_val_predict`로 out-of-fold 예측을 구해 **wMAPE**(가중 평균 절대 백분율 오차) 계산 → `confidence = clip(100 - wMAPE, 15, 95)`
- 사유: R²는 통계적 설명력 지표라 "실무에서 이 예측이 몇 % 정도 틀리는지"를 직접 말해주지 않음. wMAPE는 발주 현장에서 바로 해석 가능.
- 2026-10-16 글로벌 모델부터: 전체 학습 행을 날짜순으로 나눈 5-fold out-of-fold 예측으로 메뉴별 wMAPE 를 낸다. 학습 행 10개 미만 메뉴는 보수적 고정값 25.0

## 5. 안전재고 — 뉴스벤더 비용함수 + 식자재 단위 conformal 보정

- 원가 데이터가 DB에 없어 **근사치**를 사용: `COST_RATIO = 0.4` (원가 ≈ 판매가의 40%, `config.py`)
- 뉴스벤더 모델의 critical fractile: `q* = Cu / (Cu + Co) = 1 - COST_RATIO = 0.6`
  - `Co`(폐기비용) = `COST_RATIO × price`, `Cu`(품절비용) = `(1-COST_RATIO) × price` — price 값 자체는 비율만 쓰므로 계산에 직접 필요 없음
- 2026-10-21부터: 메뉴·일자별 quantile 모델 대신, 식자재 7일 사용량 기준으로 0.6 분위수를 한 번만 적용한다. `recommended_order_qty = 점추정 × safety_factor` (10절 P1-2)
- 2026-09-11 ~ 10-20: XGBoost quantile 모델(`objective="reg:quantileerror", quantile_alpha=0.6`)을 메뉴·일자별로 학습했다. 백엔드가 이것을 7일·여러 메뉴에 걸쳐 더해 식자재 단위로는 0.6 분위수보다 크게 발주했다 (커버리지 75.7%)
- 모델을 학습할 수 없을 때(전체 학습 행 7개 미만)만 요일별 판매 이력의 **경험적 60번째 백분위수**(`np.percentile`)로 근사
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

### P1-2. 식자재 단위 분위수 + conformal 보정 (2026-10-21, 이슈 4)

**문제**: 메뉴·일자별 60% 분위수를 백엔드 `recommend()`가 7일·여러 메뉴에 걸쳐 더했다. 분위수는 더해지지 않아(오차가 서로 상쇄되는 위험 분산 무시) 식자재 7일 사용량 기준으로는 60%가 아니라 75.7% 분위수만큼 발주했다.

**방법** (`ml/calibration.py`, split conformal — Romano et al. 2019 의 보정 단계)
- 레시피가 있는 매장마다 최근 4개 주간 시점(영업일 7일 간격)에서 "그 시점까지의 이력으로 글로벌 모델 학습 → 다음 7일 예측"을 다시 한다
- 메뉴 점추정치와 실제 판매량을 레시피로 식자재 7일 사용량으로 합쳐 `실제 / 예측` 비율을 모은다 (전 매장·식자재 공통. 식자재마다 따로 하기엔 주 4개 표본이 너무 적다)
- 비율의 유한표본 보정 분위수 `ceil((n+1)·0.6)`번째 값이 `safety_factor`. 비율이 10개 미만이면 1.0
- `recommended_order_qty = 점추정 × safety_factor`. 비율 하나를 모든 메뉴에 곱하므로, 백엔드가 레시피로 합산한 식자재 필요량 = 식자재 점추정 × 분위수 비율이 된다 → **백엔드 수정 없음**
- 비율이 1에 가까워(≈1.01~1.05) 날마다 반올림하면 사라지므로, 메뉴별 7일 합계가 `round(합계 × 비율)`이 되게 남는 단위를 소수부가 큰 날부터 더한다 (최대잔여 방식)
- 보정용 재학습에는 날씨를 넣지 않는다 (과거 시점의 예보를 재현할 수 없음). 메뉴·일자 quantile 모델은 쓰지 않게 되어 삭제
- 비용: 예측 요청당 보정 재학습 약 11초 (데모 DB 는 매장별 마지막 날짜가 달라 시점 12개. 모든 매장 데이터가 오늘까지 있으면 4개). `train_global_model` 전체 약 24초, 백엔드 읽기 타임아웃 60초

**백테스트** (`--db --step 7`, 레시피 있는 매장 3곳, 보정 가능 시점 24개, 식자재×구간 284개). 각 시점의 보정 비율은 그 이전에 끝난 겹치지 않는 주간 구간 최대 4개로만 구했다 (평균 1.011, 범위 0.999~1.043)

| 식자재 7일 사용량 기준 | 커버리지 (목표 60%) | 평균 잉여율 | 평균 부족률 |
|---|---|---|---|
| 점추정 합 (안전재고 없음) | 47.2% | 4.2% | 4.4% |
| 메뉴·일자 분위수 합 (v2.0, 수정 전 모델 출력) | 75.7% | 6.1% | 3.0% |
| **식자재 단위 conformal (v2.1 모델 출력)** | **56.7%** | **4.7%** | 4.0% |

- 잉여율·부족률: 식자재×구간마다 (발주 기준량 − 실제 사용량)의 양수·음수 부분을 실제 사용량으로 나눈 평균 (단위가 kg·L·개로 섞여 있어 합이 아니라 비율 평균)
- 수정 전 행은 이 커밋 직전 코드(quantile 모델 있음)로 같은 스크립트를 돌린 값이다. 지금 코드로는 재현되지 않는다
- 점추정 정확도(wMAPE 11.6% / MASE 1.037)는 그대로. 메뉴·일자 단위 커버리지는 64.7% → 59.0%
- 게이트 2 의 "60% 분위수 실제 커버리지 60% 근처": 75.7% → 56.7%. 표본 284개의 표준오차 약 3%p 안이다
- 현재 DB 로 계산한 운영 보정 비율은 1.054 로 백테스트 범위보다 높다. 데모 데이터에서 매장 60004 의 메뉴 60001 이 5월에 주 74개 → 149개 → 253개로 계단식으로 뛰어 최근 구간 비율이 1.5~2.3 으로 나오기 때문이다

### P1-3. 보관기한·리드타임을 반영한 발주 기간 (2026-10-21, 이슈 5, 백엔드)

**문제**: `OrderRequestService.recommend()`가 상추든 쌀이든 예측 7일치를 한 번에 발주했다. 보관기한이 짧은 식자재는 뒷날 몫이 쓰기 전에 상한다.

**방법**
- `INGREDIENT`에 `shelf_life_days`(입고 후 사용 가능 일수), `lead_time_days`(발주 후 입고까지, 다음날 = 1), `order_cycle_days`(다음 입고까지) 추가. 식자재 관리 화면의 수정 행에서 입력한다
- 식자재마다 이번 발주가 책임질 기간 = `리드타임 − 1 + min(발주 주기, 보관기한)`일. 그 기간 안의 메뉴 추천 발주량만 레시피로 합산하고, 현재 재고·진행 중 발주를 뺀다
  - 입고 전 기간(리드타임 − 1일)은 현재 재고로 버티는 몫이라 합계에 넣고 재고를 빼는 방식으로 처리된다
  - 보관기한을 넘는 날의 수요는 이번에 받으면 폐기되므로 다음 발주로 미룬다
- 값이 비어 있으면 다음날 입고·7일 주기·보관기한 제한 없음 → 7일치 전부로, 이 기능 이전과 같다
- 검증: `OrderRequestServiceRecommendTest` (DB 없는 단위 테스트, `gradlew test --tests ...OrderRequestServiceRecommendTest`)

**한계**
- 예측은 7일치만 있어 책임 기간이 7일을 넘으면(예: 2주 주기) 7일치까지만 발주된다
- 현재 재고는 유통기한과 관계없이 전량 차감한다 (재고가 매장×식자재당 유통기한 1개, 로트 없음)
- 안전재고 비율(`safety_factor`)은 7일 구간으로 보정한 값이라, 책임 기간이 짧은 식자재(예: 2일)에서는 목표 분위수보다 조금 낮게 발주될 수 있다 (11절에서 책임 기간별로 따로 보정하는 실험을 했지만 비용 차이가 거의 없어 넣지 않았다)

## 11. 데이터 품질 · 발주 시뮬레이션 · 본사 통계 (2026-10-29)

### 부분 입력일 제외 (10절 "7일차 오차 튐")

`data_service.partial_entry_dates`: 매장 전체 판매량이 **직전** 28영업일 중앙값의 40% 미만인 날(직전 이력 7일 이상일 때만 판단)을 휴무처럼 학습·평가에서 뺀다. 그날 이후 데이터를 보지 않으므로 운영 중에 입력이 덜 끝난 당일 데이터도 학습에서 빠진다. DB 에서 걸리는 날은 10절에 적은 6일과 같다 (60005 의 05-22·06-05·06-18·06-19, 90001 의 05-15, 60004 의 10-16).

DB 백테스트 (`--db --step 7`, 49개 메뉴 258개 시점 1,765 평가일. **평가셋이 10절(1,868일)과 달라** 숫자를 직접 비교하지 않는다):

| 방법 | wMAPE | MASE | 7일 뒤 wMAPE |
|---|---|---|---|
| 계절 나이브 | 11.9% | 1.128 | 12.1% |
| 요일 평균(4주) | 9.9% | 0.952 | 9.9% |
| 이동평균(7일) | 18.3% | 2.136 | 18.1% |
| 매장 요일비율×28일 평균 | 9.3% | 0.922 | 9.9% |
| **DemandPredictor (글로벌)** | **9.2%** | **0.902** | 9.8% |
| 추천 발주량 커버리지 (목표 60%) | 60.7% | | |

- 7일차 튐이 사라졌다 (모델 23.6% → 9.8%)
- 같은 실행 안의 비교: 요일 평균(4주) 대비 wMAPE −0.7%p·MASE −0.050 (10절은 −0.4%p·−0.047), 매장 요일비율×28일 평균보다 처음으로 두 지표 모두 낮다 (−0.1%p·−0.020). 차이는 작다
- 식자재 7일 사용량: conformal 커버리지 55.4%, 평균 잉여율 4.3%, 부족률 3.0% (식자재×구간 258개, 보정 비율 평균 1.009)
- 합성 백테스트는 DB 를 거치지 않아 그대로 (14.8% / 0.817)

### 발주 시뮬레이션 (`simulate_orders.py`, 계획서 정량 목표 "폐기율 15~20% 절감")

같은 실제 수요 이력에 발주 정책을 각각 흘려 폐기·품절을 비교한다 (Huber et al. 2019 의 평가 설계). 정책은 발주 구조가 모두 백엔드 `recommend()`와 같고(책임 기간 필요량 − 재고 − 진행 중 발주) **예측값만 다르다**.
- FoodGuard: 발주일마다 그날까지의 이력으로 글로벌 모델을 학습, 추천 발주량(점추정 × conformal 보정 비율)을 레시피로 합산
- 관행 규칙: 메뉴마다 지난주 같은 요일 판매량 × (1 + 여유율 0·10·20%)
- 재고는 입고 로트별 FIFO, 보관기한이 지나면 폐기, 재고로 못 채운 수요는 품절. 비용 지수 = 폐기율 + 1.5 × 품절률 (품절 1단위 손실 = 마진 0.6 / 원가 0.4, `COST_RATIO` 와 같은 가정)
- 보관기한·리드타임·발주 주기는 `INGREDIENT` 에 값이 아직 없어 시나리오로 가정 (전 식자재 공통). 판매량을 수요로 쓰고(품절일은 실제 수요보다 작을 수 있음), 휴무일은 미리 안다고 본다

DB (레시피 있는 매장 3곳, 매장×식자재 36개, 폐기율·품절률은 식자재 총수요 대비 비율의 평균):

| 시나리오 | 정책 | 폐기율 | 품절률 | 비용 지수 |
|---|---|---|---|---|
| 주 1회 발주 · 보관 7일 | **FoodGuard** | **4.7%** | 11.0% | 21.2 |
| | 요일 평균(4주) | 4.3% | 11.4% | 21.5 |
| | 관행 ×1.0 | 2.8% | 11.8% | 20.5 |
| | 관행 ×1.1 | 9.7% | 9.6% | 24.1 |
| | 관행 ×1.2 | 18.2% | 9.0% | 31.8 |
| 3일마다 · 보관 4일 | **FoodGuard** | **0.8%** | 7.8% | 12.5 |
| | 요일 평균(4주) | 0.9% | 8.5% | 13.7 |
| | 관행 ×1.1 | 0.8% | 6.2% | 10.1 |
| | 관행 ×1.2 | 1.2% | 5.2% | 9.0 |
| 2일마다 · 보관 3일 | **FoodGuard** | **0.4%** | 6.7% | 10.5 |
| | 요일 평균(4주) | 0.6% | 7.6% | 12.0 |
| | 관행 ×1.1 | 0.7% | 4.7% | 7.7 |
| | 관행 ×1.2 | 1.0% | 3.7% | 6.6 |

**해석 — 보고서에 쓸 때 주의**
- 폐기량만 보면 관행 "지난주 × 1.1" 대비 FoodGuard 가 주 1회 발주에서 −52%, 2일 주기에서 −38%, 3일 주기에서 −5% 적게 버린다. 그러나 품절이 1.4~2.0%p 더 많다. **폐기와 품절을 합친 비용으로는 주 1회 발주에서만 관행 ×1.1 보다 낫고(21.2 vs 24.1), 주기가 짧으면 여유를 둔 관행 규칙이 낫다.** 같은 품절률에서 비교한 것이 아니므로 "폐기 52% 절감"만 따로 쓰면 과장이다
- 단순 통계 베이스라인 요일 평균(4주)보다는 세 시나리오 모두 비용이 낮다 (−0.3~−1.5). 예측 개선의 가치는 있지만 작다 (예측 정확도 차이가 0.7%p 이므로)
- 주기가 짧으면 관행 ×1.2 가 이기는 이유: 보관기한이 발주 주기보다 길어 남은 재고가 다음 발주에서 차감되고 버려지지 않는다. 과잉의 실제 비용이 단일 기간 뉴스벤더 가정(남으면 전부 폐기)보다 작으므로, 목표 분위수 0.6 이 낮다. 목표 분위수·`COST_RATIO` 는 사업 가정이라 바꾸지 않았다. 바꾼다면 이 시뮬레이션으로 확인할 것
- 품절률 수준(7~11%)은 매장 60004 가 끌어올린다. 주 1회 시나리오에서 60004 는 품절 29%·폐기 17%, 60005·60006 은 품절 7~8%·폐기 1~2% 다. 60004 는 5월에 주 74 → 149 → 253개로 계단식으로 뛰는 데모 데이터라 어느 정책이든 따라가지 못한다. 부분 입력일 제외 전 실행(60004 기간이 10-16 까지)에서는 주 1회 품절률이 7.4% 였다. 정책 간 순위는 두 실행에서 거의 같았다 (이전 실행은 주 1회에서 FoodGuard 와 요일 평균(4주)이 16.9 로 동률)
- 실험(기각): 책임 기간 k일마다 따로 conformal 비율을 구해 쓰면 짧은 주기 안전재고가 맞춰질 것으로 봤지만 비용 지수 변화가 0~0.4 로 작아 넣지 않았다
- 합성 매장(`--synthetic`, 메뉴 3개·식자재 3개)도 순위가 같다: 주 1회에서 FoodGuard 9.2 / 관행 ×1.1 13.3, 2일 주기에서 6.2 / 4.5

### 본사 통계 페이지 실데이터화

- `GET /api/stats/hq` (`StatsService`): 월별 매출(SALES × 메뉴 가격)·폐기 기록 건수, 가맹점별 폐기 건수·입고 대비 폐기율(식자재마다 `WASTE_RECORD` 폐기량 / 입고 완료(DONE) 발주량의 평균), 추천 적용률(`order_source` 기록 발주 중 AUTO 비율, MANUAL 의 추천 대비 평균 수정 폭)
- `admin/Stats.tsx` 의 하드코딩 값("폐기율 12.5% 감소·소나무 124그루", 가짜 가맹점·월별 수치)을 위 API 로 교체. 기록이 없으면 "아직 기록이 없습니다"
- 본사 대시보드의 가맹점별 주간 매출 API(`/api/sales/all-stores/weekly-summary`)가 2026-05 머지(`9bf9807`) 때 백엔드에서 빠져 프론트가 빈 값을 보이던 것을 복구
- 검증: `StatsServiceTest` (DB 없는 단위 테스트). JPQL `YEAR()/MONTH()` 쿼리와 화면은 백엔드를 띄워야 확인된다 (아직 안 함)

## 12. 모델 비교 실험 · 미완성 기능 정리 (2026-10-29)

### 모델 비교 (계획서 "LSTM·XGBoost·Prophet")

`python backtest.py --db --step 7 --compare` (`compare_models.py`, 설치: `pip install -r requirements-experiment.txt`, 약 15분). 운영 서비스와 CI 에는 들어가지 않는다. 기존 백테스트와 같은 시점·평가일, 각 시점까지의 이력만 사용, 날씨 제외.
- Prophet: 메뉴마다 따로 학습, 요일 계절성 + 한국 공휴일 (연 계절성은 이력 3~4개월이라 끔), 품절일 제외
- LSTM: 전체 매장×메뉴를 함께 학습하는 글로벌 모델 (XGBoost 와 같은 cross-learning 조건). 최근 28일 달력(판매량/구간 평균, 영업 여부, 요일) → 다음 7일 직접 예측, L1 손실, 은닉 32, 150 epoch, seed 42

DB (49개 메뉴, 258개 시점, 1,765 평가일 — 11절과 같은 평가셋):

| 모델 | wMAPE | MASE | 1일 뒤 | 7일 뒤 |
|---|---|---|---|---|
| **XGBoost 글로벌 (운영)** | **9.2%** | **0.902** | 8.1% | 9.8% |
| Prophet (메뉴별) | 9.7% | 0.965 | 8.5% | 10.4% |
| LSTM (글로벌) | 12.6% | 1.490 | 8.3% | 17.1% |
| 요일 평균(4주) | 9.9% | 0.952 | 8.6% | 9.9% |

- XGBoost 가 두 지표 모두 가장 낫다. Prophet 은 요일 평균(4주)과 비슷하고(wMAPE −0.2%p, MASE +0.013), LSTM 은 2일차부터 오차가 커져 가장 나쁘다
- 문헌과 같은 방향이다: 메뉴당 이력 30~100일 규모에서는 복잡한 모델의 이득이 작고 여러 시계열을 함께 학습한 트리 모델이 낫다 (M5, Montero-Manso & Hyndman 2021)
- **공정성 한계**: XGBoost 하이퍼파라미터는 같은 DB 백테스트를 보며 골랐고(10절 P1 "선택 과정 주의"), LSTM 은 설정 하나만 돌렸다. LSTM 을 튜닝하면 차이가 줄 수 있다. 다만 같은 평가셋으로 튜닝하면 선택 편향이 생기므로 하지 않았다
- 합성 데이터(`--synthetic --compare`, 시계열 1개): Prophet 14.3% / 0.791, XGBoost 14.8% / 0.817, LSTM 14.8% / 0.816. 합성 데이터가 "선형 추세 + 요일 패턴"으로 Prophet 의 가정과 같아 Prophet 이 가장 낫다. 실데이터에서는 순위가 바뀐다
- 비교를 켜도 기존 방법들의 수치는 11절과 같다 (운영 모델에 영향 없음)
- 참고: 합성 데이터의 추천 발주량 커버리지는 50.3% 다. 합성 매장에는 레시피가 없어 안전재고 비율이 1.0 (점추정 그대로)이기 때문이다. 10절의 69.8% 는 P1-2 이전(메뉴·일자 분위수) 값이다

### 하다 만 기능 정리 (백엔드·프론트)

- **기부**: 기부 예정(PLANNED) 수량을 폐기 예측량에서 빼고(`WastePredictionService`), 등록 수량은 `재고 − 이미 기부 예정인 양` 이하만 허용한다(`DonationService`, 화면에도 기부 가능 수량 표시). 전에는 같은 재고를 여러 번 기부로 등록할 수 있었다. 본사 통계에 기부 완료 건수 추가. 검증: `DonationServiceTest`
- **프로필 이름 수정·비밀번호 변경**: 프론트(`UserDropdown.tsx`)가 부르는 `/api/users/me`(GET·PUT), `/api/users/me/password`(PUT)가 커밋 `aafa11b` 에서 `UserController` 와 함께 지워져 동작하지 않았다. 세 개만 복구했고, 예전에 있던 전체 유저 조회(비밀번호 해시까지 응답)와 계정 삭제는 쓰는 곳이 없어 되살리지 않았다. 검증: `UserServiceTest`
- **본사 발주 관리 진입점**: `/admin/orders`(발주 승인·발송·QR)로 가는 메뉴가 없었다. 본사 타일 홈에 "발주 관리" 타일 추가
- **가게 등록**: `/store` 라우트가 커밋 `61f0aa7` 에서 빠져 `StoreRegister` 화면에 갈 수 없었다. 라우트 복구 + 점주 타일 홈에 "가게 등록" 타일 추가
- 사이드바(`layouts/main-layout/Sidebar`)는 `61f0aa7` 부터 레이아웃에서 그려지지 않는다 (이동은 타일 홈과 상단 로고). 사이드바 메뉴 목록도 맞춰 고쳤지만 화면에는 보이지 않는다
- 브라우저 확인 (2026-10-29, 검증용 계정): 본사 타일 → 발주 관리(진행 중 48건 실데이터), 통계 페이지 월별 매출 차트, 프로필 API·비밀번호 변경
- 남은 정리 대상 (쓰는 곳 없음, 지우지 않음 → 16절에서 `getTodaySummary·getWeeklySummary` 를 뺀 나머지 삭제): `layouts/main-layout/Sidebar`, `pages/admin/AdminDashboard.tsx`, `pages/Profile.tsx`, `pages/SalesStats.tsx` (라우트 없음), `salesService.getTodaySummary·getWeeklySummary` (백엔드 API 없음)

## 13. 계획서 대비 보완 · 권한 검사 (2026-10-30)

계획서(「26학년도 캡스톤 디자인 1조 최종본」)의 결과물 4개·정량 목표 3개와 배포 안정성을 다시 점검해 빈 곳을 채웠다.

### 정량 목표 "메뉴별 판매량 예측 정확도: 주간 단위 ±10% 오차 이내"

`backtest.py` 에 주간 합계 지표를 추가했다 (메뉴×예측 시점마다 7일 예측 합계 vs 실제 합계). `--db --step 7`, 메뉴×7일 258개:

| 방법 | 주간 wMAPE | 주간 오차 중앙값 | ±10% 이내 비율 |
|---|---|---|---|
| 계절 나이브 | 5.4% | 3.6% | 85.7% |
| 요일 평균(4주) | 4.7% | 2.8% | 86.0% |
| 매장 요일비율×28일 평균 | 4.8% | 2.9% | 86.4% |
| **DemandPredictor (글로벌)** | **4.7%** | **2.9%** | **87.2%** |

- 목표(±10%)는 메뉴-주의 87% 에서 만족한다. 다만 주간 합계로 보면 일별 오차가 상쇄되어 단순 베이스라인도 85~86% 로 거의 같다. 보고서에는 "주간 ±10% 달성(87%)"과 함께 베이스라인과 차이가 작다는 점, 데모 데이터라는 점을 같이 쓴다
- 같은 실행의 일별 정확도: 글로벌 모델 9.2% / MASE 0.900 (11절 기준 수치 0.902 와 소수 셋째 자리만 다름)

### 결과물 3 "매출 계획 수립 지원" — 만들었다가 뺌

- 주간 목표 매출 vs (지난 날 실제 + 남은 날 AI 예측) 매출 카드를 만들었으나(`0225c32`), 팀 판단으로 이 기능은 넣지 않기로 하고 코드를 지웠다 (2026-10-30)
- 공유 DB 에 그때 생긴 빈 `SALES_TARGET` 테이블이 남아 있다 (Hibernate 는 지우지 않음). 쓰는 코드는 없다
- 결과보고서에서는 계획서 결과물 3 을 "미구현(범위 제외)"으로 적는다

### 권한 검사 (배포 차단 문제였음)

이전에는 로그인만 하면 다른 가맹점의 매출·재고·발주를 조회·수정할 수 있었고, 회원가입에서 본사 관리자(HQ_ADMIN)를 스스로 고를 수 있었다.
- 회원가입은 점주(OWNER)만. 본사 관리자 계정은 DB 에서 직접 만든다 (기존 5개 유지)
- JWT 의 role 을 권한(`ROLE_HQ_ADMIN`/`ROLE_OWNER`)으로 반영. 본사 전용: 전체 발주(`/api/orders/admin/**`)·통계(`/api/stats/**`)·전 매장 매출(`/api/sales/all-stores/**`)·매장 목록(`GET /api/stores`)·발주 승인/거절(`PUT /api/orders/*/status`)·발송(`POST /api/orders/*/hq-send`)
- 매장 소유 검사 (`security/StoreAccess`): 경로의 `{storeId}`·`{userId}`·`?storeId=`·엔티티 `{id}` 는 `StoreAccessInterceptor`, 요청 본문의 `storeId`·`userId`·`menuId` 는 `StoreAccessBodyAdvice` 가 검사. 점주는 자기 매장만, 본사는 전체. 위반 시 403
- 매장이 없는 공용 데이터(`store_id` 가 빈 기존 식자재 29개)는 누구나 수정할 수 있다 — 공용 식자재를 본사 전용으로 할지는 정해야 한다
- 새 컨트롤러에 엔티티 `{id}` 경로를 만들면 `StoreAccessInterceptor.ID_ENTITY` 에 추가해야 검사된다
- `StoreAccessTest`, `UserServiceTest`(회원가입 제한). CI 백엔드 job 에 security 패키지 테스트 추가

## 14. 발주 추천 근거 설명 — claude CLI 에이전트 (2026-10-30)

시제품 단계라 Claude API 대신 로그인된 Claude Code CLI(`claude -p`)를 AI 서비스가 하위 프로세스로 호출한다.

**원칙**: 발주량은 지금처럼 수요 예측 모델(XGBoost)과 발주 규칙이 정하고, LLM 은 그 계산 근거를 문장으로만 쓴다. 숫자를 새로 계산·변경하지 않도록 시스템 프롬프트로 막고, 입력에 없는 식자재 설명은 버린다.

**XGBoost 에 에이전트를 붙일지**: 붙이지 않는다. 숫자 시계열 예측은 백테스트로 검증된 XGBoost 가 낫고(일별 9.2%, 주간 ±10% 87%), LLM 이 예측을 고치면 재현이 안 되고 판단 수정은 대개 손해다(Fildes et al. 2009). 에이전트는 예측 주변(설명·데이터 점검·이벤트 후보 정리)에만 둔다.

**구성**
- AI 서비스 `services/claude_cli.py`: `claude -p --output-format json --tools "" --system-prompt <짧은 프롬프트> --json-schema <스키마> --no-session-persistence`, 임시 폴더에서 실행(프로젝트 CLAUDE.md 가 섞이지 않게), 50초 제한. 기본 Claude Code 시스템 프롬프트(약 2.5만 토큰)를 짧은 것으로 바꿔 호출당 비용이 $0.21 → 약 $0.01
- `--bare` 는 로그인(OAuth)을 건너뛰어 쓸 수 없다. Windows 는 `claude.cmd` 대신 `claude.exe` 경로를 `CLAUDE_CLI` 에 둔다 (`.env.example`)
- AI 서비스 `POST /api/explain/order` (`routers/explain.py`): 식자재별 설명 + 전체 요약 (구조화 출력)
- 백엔드 `recommend()` 결과에 근거 필드 추가(발주량 계산에는 안 씀): `pendingQty`, `pointQty`(안전재고 전), `coverageDays`·`shelfLifeDays`·`leadTimeDays`·`orderCycleDays`, `contributions`(메뉴별 수량·1개당 사용량)
- 백엔드 `POST /api/orders/recommend/{storeId}/explain` (`OrderExplainService`): 매장 소유 검사 적용
- 프론트 발주 화면 "AI 추천 근거 보기" 대화상자 (`components/OrderExplainDialog.tsx`)
- 백엔드 `RestTemplate` 을 HTTP/1.1(`SimpleClientHttpRequestFactory`)로 고정: 기본 JDK HttpClient 의 h2c 업그레이드 요청에서 uvicorn 이 POST 본문을 버려 422 가 났다 (본문 없는 예측 호출은 영향 없었음)

**확인**: 실제 CLI 로 식자재 2개 설명 약 12초, 입력 숫자만 써서 설명(보관기한 때문에 2일분만, 재고 0.4kg 차감 등). 백엔드→AI→CLI 연결과 화면 대화상자 확인. 다만 지금 데모 DB 는 세 매장 모두 재고·진행 중 발주가 예측을 덮어 추천이 0건이라, 실제 추천이 있는 상태의 화면은 아직 못 봤다. 테스트: `tests/test_claude_cli.py`(가짜 subprocess), `OrderRequestServiceRecommendTest`(근거 필드)

## 15. 점주 특이사항 → claude → XGBoost 피처 (2026-10-30)

XGBoost 는 데이터에 없는 일(단체 예약, 주변 행사, 태풍 예보)을 모른다. 점주가 적은 메모를 claude 가 숫자로 바꾸고, 예측은 여전히 XGBoost 가 한다.

**흐름**
1. 매출 입력 화면 "특이사항" 카드에서 날짜별 메모 입력 (`STORE_EVENT_NOTE`, `POST /api/event-notes`, 매장 소유 검사 적용)
2. 저장 시 백엔드가 AI 서비스 `POST /api/events/parse` 호출 → `claude -p` 가 `{eventType, lift(평소 대비 매장 전체 판매 배율, 0.3~3.0), reason}` 로 변환. 매장의 평소 하루 판매량(최근 28영업일 평균)을 함께 넘겨 인원·수량을 배율로 바꾼다. 결과는 메모와 함께 저장 → 같은 데이터로 다시 학습하면 같은 결과
3. 수요 예측 때 `data_service.get_event_lifts` → `DemandPredictor.fit(..., events=)`. 학습 이력에 특이사항 날이 있을 때만 `event_lift` 피처를 쓰고(미래 날짜 메모는 예측 행에 들어감), 그때는 `min_child_weight` 를 100 → 10 으로 낮춘다
4. 배율을 예측에 곱하지 않는다. XGBoost 가 과거 특이사항 날의 실제 판매로 배율을 얼마나 믿을지 배운다

**합성 실험** (`python backtest.py --events`): 매장 3곳×메뉴 4개×180일, 약 8% 의 날에 특이사항(1.3~2.0배 또는 0.5~0.8배), claude 추정은 실제 배율 ±15% 오차로 흉내. 90일째부터 주간 시점 12개

| 방식 | 전체 wMAPE | 특이사항 날 | 평소 날 |
|---|---|---|---|
| 특이사항 피처 없음 | 16.4% | 38.1% | 13.6% |
| 피처만 (min_child_weight 100 그대로) | 16.4% | 37.1% | 13.7% |
| (A) 배율을 기준값(scale)에 곱함 + 피처 | 14.0% | 18.1% | 13.5% |
| **채택: 피처 + min_child_weight 10** | **14.0%** | **17.8%** | **13.5%** |
| 피처 없이 min_child_weight 10 만 | 16.4% | 38.3% | 13.6% |

- 개선은 피처에서 나오고 규제 완화만으로는 없다. (A) 와 성능이 비슷하지만 채택안은 LLM 배율을 예측에 직접 곱하지 않는다
- **한계**: 실제 DB 에는 아직 특이사항이 없어 실데이터 효과는 측정하지 못했다. 과거 특이사항 날이 매장당 10일 안팎 쌓인 뒤 `backtest.py --db` 에 events 를 넣어 다시 확인해야 한다 (지금 `--db` 백테스트는 특이사항을 넣지 않으므로 기존 수치 그대로). 미래 날짜 메모만 있으면 학습 행에 특이사항 날이 없어 피처를 쓰지 않는다
- 실제 CLI 변환 예: "토요일 점심 단체 예약 30명"(평소 150) → RESERVATION ×1.2, "근처 대학교 축제 3일째" → LOCAL_EVENT ×1.3, "태풍 예보로 손님 적을 듯" → WEATHER ×0.6, "그냥 평범한 날" → OTHER ×1.0. 호출당 3~10초
- 테스트: `tests/test_events.py` (특이사항 없을 때 피처셋 그대로, 학습된 피처가 예정된 특이사항 날 예측을 올림, 배율 범위 제한·오류 처리)

## 16. 불필요 코드·파일 검사 (2026-10-30)

`.claude/agents/` 의 dead-code-scout(수색) → dead-code-verifier(반박, 주장만 받음) → dead-code-final-reviewer(확정·보류 재확인) 3단계로 검사했다. 다음 검사는 이 절을 기준으로 아래 "다음 검사 대상"과 새로 바뀐 부분만 본다. "최종 확정" 항목은 2026-10-30 에 모두 지웠다 (그로 인해 쓰이지 않게 된 import·필드·서비스 메서드, `StoreAccessInterceptor` 의 `/api/inventory/{id}`·`/api/orders/{id}/owner-receive`·`/api/sales/{id}` 항목, `predict_and_save_menu` 포함). `.idea/`·`.claude/settings.local.json` 은 추적만 해제하고 로컬 파일은 남겼다.

### 최종 확정 (삭제 완료)
- 프론트 파일: `layouts/main-layout/Sidebar/`(Sidebar·NavItem), `pages/admin/AdminDashboard.tsx`, `pages/Profile.tsx`, `pages/SalesStats.tsx`, `routes/paths.ts`, `components/base/Image.tsx`, `helpers/format-functions.ts`·`string-avatar.ts`, `src/index.css`·`App.css`, `theme/styles/swiper.ts`(+ `CssBaseline.tsx:6,36`), 이미지 `assets/{hero.png,react.svg,vite.svg}`·`public/{homepage.png,homepage_2.png,icons.svg}`, `main-layout/index.tsx` 의 `drawerOpenWidth/drawerCloseWidth` export
- 프론트 서비스 메서드: `authService.isLoggedIn`, `inventoryService.create/update/delete`, `orderService.scanQrByToken/driverReceiveGroup/ownerReceive/recommend`, `salesService.delete`, `storeService.delete`
- 프론트 의존성: `@mui/icons-material`, `swiper`, `vite-tsconfig-paths`, `simplebar-react`(Sidebar 삭제 후). 지울 때 `package-lock.json` 도 갱신 (CI 가 `npm ci --legacy-peer-deps`)
- `frontend/README.md`: 지우지 않고 프로젝트 설명 + 템플릿 출처(Nickelfox)로 교체
- 백엔드 엔드포인트(+ 그 컨트롤러에서만 쓰는 서비스 메서드): `GET /api/orders/scan`, `POST /api/orders/{id}/owner-receive`, `POST /api/delivery/group/{token}/driver-receive`, `POST /api/inventory`, `PUT/DELETE /api/inventory/{id}`, `DELETE /api/sales/{id}`, `DELETE /api/stores/{id}`, `GET /api/waste-records/{storeId}`. `owner-receive` 는 `StoreAccessInterceptor:33`·`StoreAccessTest:88` 같이 수정. **`SecurityConfig:37` 의 `/api/orders/scan` permitAll 은 남긴다** (POST 를 공개 페이지 `DeliveryDriverGroup.tsx:50` 이 씀)
- 백엔드: `dto/SaleRequest.java`·`SaleResponse.java`, 미사용 import(`OrderRequestController` Inventory, `OrderRequest` JsonIgnore, `PredictionService` PredictionResult), `PredictionService.salesDataRepository` 필드(+ import), `backend/postman/` 빈 파일 3개
- AI 서비스: `database.py` 의 `text`·`class Base`(+ `DeclarativeBase` import), `data_service.py` 의 `datetime` import·`get_store_sales_last_n_days`, `POST /api/predict/store/{id}/menu/{menu_id}`(+ `SingleMenuPredictionResponse`)
- 저장소: 커밋된 루트 `node_modules/`(@google/generative-ai, 깨진 `.package-lock.json`), `sample/` 전체, 커밋된 `.idea/` 4개, `.claude/settings.local.json`, 루트 `기상청_단기예보_조회서비스`(0바이트), `.gitignore` 에 `node_modules/`·`.gradle/`·`.claude/settings.local.json` 추가. 디스크만: 루트 미추적 `node_modules/*`, 루트 `*.log` 6개. 참고: `hyeon-backup` 의 d639525 가 같은 정리를 담고 있음(루트 package.json 추가분 제외)

### 사용자 확인 필요
- 팀원 브랜치 머지 여부에 달림 (junho·feat/security-agent·jhy 가 사용): `salesService.getTodaySummary·getWeeklySummary`, `getByDateRange`, `getAllStoreWeeklySummary`, `menuService.update`, `orderService.driverReceive`, `PUT /api/menus/{id}`, `POST /api/orders/{id}/driver-receive`, `GET /api/sales/{storeId}/range`
- junho `DEV_ROADMAP.md` 계획과 겹침: `wastePredictionService.summary`·`GET /api/waste-prediction/{id}/summary`(AG-2), `POST /api/notifications`(에이전트 알림)
- `frontend/eslint.config.js`: eslint 8.57.1 과 맞지 않아 `npm run lint` 실패. 되살릴지(TS 용 설정) 버릴지(설정·lint 스크립트·eslint 관련 의존성 삭제). `@typescript-eslint/*` 도 이 결정을 따름
- `backend/src/main/resources/db/schema.sql`: 실행 안 되고 엔티티와 다르지만 팀 포트폴리오가 설계 산출물로 인용. 갱신/이동/삭제
- `backend/.postman/resources.yaml`: jihwan 의 Postman 워크스페이스 연결 설정
- `GET /api/predict/store/{id}`: 코드 호출 없음, 수동 점검용으로 남길지
- 비밀값: 예전 DB 비밀번호·JWT secret 리터럴이 git 이력과 origin/dev·dev2·junho·feat/security-agent 에 남아 있고 지금 값과 같다. 교체 담당·시점, 이력 정리 여부

### 기각 (쓰임)
`GET /api/orders/recommend/{storeId}`(HANDOFF 확인 절차, fgcli), `@mui/system`(x-data-grid peer, 대신 ^9 → 범위 내 버전 조정 필요), `GET /api/sales/all-stores/weekly-summary`(fgcli), `POST /api/train/store/{id}`(운영 절차), `uml/`(지우지 않고 junho 의 2026-09-11 수정본으로 갱신)

### 다음 검사 대상 (이번에 확정하지 않음)
- 로컬 브랜치(hyeon-backup·hyeon-remote-backup·jhy·jihwan)와 stash 4개
- `theme/styles/simplebar.ts`·`CssBaseline.tsx:4,35` (Sidebar 삭제 후 대상 없는 스타일)
- 이 문서 82행 재학습 경로 오기(실제 `/api/train/store/{store_id}`), 291행 복구 근거(본사 대시보드는 라우트 없음)
- `react-leaflet` 로컬 설치(5.0.0)와 lock(4.2.1) 불일치
- junho·feat/security-agent 가 루트 로그 4개와 `.claude/settings.local.json` 을 아직 추적 — 머지 시 다시 들어옴
- TSX 내부 죽은 분기, Java 와일드카드·리플렉션 참조, 실험 스크립트(backtest·compare_models·simulate_orders) 필요성은 보지 않음
