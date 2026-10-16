# FoodGuard AI 수요예측 서비스 — 진행 현황

> 마지막 업데이트: 2026-09-11
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
| `ml/demand_predictor.py` | `DemandPredictor` — 점 추정 `XGBRegressor` + 안전재고용 quantile `XGBRegressor` | XGBoost 전환 완료 (2026-09-11) |
| `ml/feature_engineering.py` | 날짜/lag/rolling/날씨 피처 (총 22개) | 변경 없음 — 기존 피처셋으로 충분하다고 판단 |
| `services/weather_service.py` | Open-Meteo(과거) + 기상청 단기·중기예보(미래) | 변경 없음 |
| `services/prediction_service.py` | 학습→예측→저장 오케스트레이션 | score 스케일 수정 |
| `services/data_service.py` | TiDB 순수 SQL 읽기/쓰기 | `recommended_order_qty` 컬럼 추가 |
| `routers/prediction.py`, `routers/training.py` | `/api/predict/*`, `/api/train/*` | `recommended_order_qty` 필드 추가 |
| `schemas/schemas.py` | Pydantic 응답 스키마 | `PredictionItem.recommended_order_qty` 추가 |
| `config.py` | 환경설정 | `COST_RATIO` (원가 근사치) 추가 |
| `trained_models/*.joblib` | 매장×메뉴별 학습된 모델 | 구 RandomForest 모델 전량 삭제 — 재학습 필요 |

## 3. 모델 전략 (데이터량에 따라 3단계)

| 판매 이력 개수 | 전략 | 피처셋 |
|---|---|---|
| < 7개 | 예측 불가 (0 반환) | — |
| 7 ~ 14개 | 요일별 평균 + 요일별 경험적 분위수(안전재고) | — |
| 15 ~ 29개 | XGBoost, 중간 피처셋 | `MID_FEATURE_COLS` |
| ≥ 30개 | XGBoost, 전체 피처셋 + 날씨 | `FULL_FEATURE_COLS` + 날씨 6종 |

- `MODEL_VERSION = "xgb_weather_v1.0"` (`prediction_service.py`)
- XGBoost 파라미터: `n_estimators=200, max_depth=4, learning_rate=0.1, min_child_weight=2, subsample=0.8, colsample_bytree=0.8` — 데이터가 적어(7~30건) 과적합 방지를 위해 depth를 얕게 설정.

## 4. 평가지표 — R² → wMAPE 전환

- 기존: `cross_val_score(scoring="r2")` 기반 confidence = `R²×85`
- 변경: `cross_val_predict`로 out-of-fold 예측을 구해 **wMAPE**(가중 평균 절대 백분율 오차) 계산 → `confidence = clip(100 - wMAPE, 15, 95)`
- 사유: R²는 통계적 설명력 지표라 "실무에서 이 예측이 몇 % 정도 틀리는지"를 직접 말해주지 않음. wMAPE는 발주 현장에서 바로 해석 가능.
- 데이터 7~9개(CV 불가)는 보수적 고정값 25.0 사용.

## 5. 안전재고 — Quantile Regression + 뉴스벤더 비용함수

- 원가 데이터가 DB에 없어 **근사치**를 사용: `COST_RATIO = 0.4` (원가 ≈ 판매가의 40%, `config.py`)
- 뉴스벤더 모델의 critical fractile: `q* = Cu / (Cu + Co) = 1 - COST_RATIO = 0.6`
  - `Co`(폐기비용) = `COST_RATIO × price`, `Cu`(품절비용) = `(1-COST_RATIO) × price` — price 값 자체는 비율만 쓰므로 계산에 직접 필요 없음
- XGBoost quantile 모델(`objective="reg:quantileerror", quantile_alpha=0.6`)을 점 추정 모델과 별도로 학습 → `recommended_order_qty`
- 데이터 부족(7~14건) 구간은 quantile 모델 대신 요일별 판매 이력의 **경험적 60번째 백분위수**(`np.percentile`)로 근사
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
