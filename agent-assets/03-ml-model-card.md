# 03. 모델 카드 — FoodGuard 수요 예측기

> 출처: `ai-service/ml/demand_predictor.py`, `ml/feature_engineering.py`, `services/prediction_service.py`, `services/weather_service.py`
> 버전 문자열: **`rf_weather_v1.0`** (`MODEL_VERSION`, DB `PREDICTION_RESULT.model_version`에 기록)

## 1. 개요

| 항목 | 값 |
|---|---|
| 과제 | 매장×메뉴 단위 **일별 판매수량** 회귀 |
| 알고리즘 | `RandomForestRegressor(n_estimators=200, max_depth=8, min_samples_leaf=2, random_state=42)` |
| 예측 지평 | 7일 (`PREDICTION_DAYS`) — **재귀적 multi-step** (예측값을 다음 스텝의 lag로 재투입) |
| 학습 단위 | **모델 1개 = (store_id, menu_id) 1쌍** — 글로벌 모델 아님 |
| 산출물 | `ai-service/trained_models/store_{sid}_menu_{mid}.joblib` (joblib으로 Predictor 객체 통째 직렬화) |
| 검증 | `cross_val_score(cv=min(5, n//2), scoring="r2")`, 샘플 10개 미만이면 score=0.5 고정 |

## 2. 3단계 폴백 전략 (데이터 양 기준)

| 데이터 행 수 | 전략 | 피처 세트 |
|---|---|---|
| n ≥ 30 | RandomForest (full) | `FULL_FEATURE_COLS` + 가용 날씨 |
| 7 ≤ n < 30 | RandomForest (minimal) | `MINIMAL_FEATURE_COLS` + 가용 날씨 |
| n < 7 | **요일별 평균** (학습 없음) | — (confidence 40에서 시작) |
| 이력 0행 | 전부 0 예측, confidence 0 | — |

## 3. 피처

**FULL (16)**
`day_of_week, day_of_month, month, week_of_year, is_weekend, is_holiday, is_monday, is_friday, is_saturday, is_sunday, lag_1, lag_7, lag_14, rolling_mean_7, rolling_mean_14, rolling_std_7`

**MINIMAL (8)**
`day_of_week, day_of_month, month, is_weekend, is_holiday, is_saturday, is_sunday, rolling_mean_7`

**WEATHER (6, 조건부)**
`temp_max, temp_min, precipitation, is_rainy, is_hot, is_cold`
→ 학습 데이터에 실제 non-null 값이 하나라도 있는 컬럼만 `feature_cols`에 편입 (`use_weather` 플래그).

세부 규칙:
- `is_holiday`: `holidays` 패키지의 한국 공휴일(2023~2029). 패키지 없으면 조용히 전부 0.
- rolling은 `shift(1)` 후 계산 → **누수(leakage) 방지됨**.
- 미래 행의 lag는 `make_future_feature_row()`가 이력 꼬리에서 가져오고, 부족하면 평균으로 대체.

## 4. 날씨 파이프라인

| 용도 | 소스 | 키 | 비고 |
|---|---|---|---|
| 학습 (과거) | Open-Meteo Archive API | 불필요 | **어제까지만** 조회 가능 |
| 예측 (미래 7일) | 기상청 단기예보 + 중기예보 (data.go.kr) | `KMA_API_KEY` | 키 없으면 빈 DF → 날씨 없이 예측 |

- 좌표는 `STORE.region` 문자열의 **부분 문자열 매칭**으로 결정 (17개 시·도 하드코딩, 기본값 서울).
  → `region`이 "경기도 성남시"면 "경기"에 매칭. **매칭 실패 시 조용히 서울 좌표** 사용.
- 날씨 API는 매장당 1회만 호출하고 모든 메뉴가 공유 (`predict_and_save_store`).
- 모든 외부 호출은 예외를 삼키고 빈 DataFrame 반환 → **실패해도 예측은 진행**되며 로그도 남지 않음.

## 5. Confidence 산식 (⚠️ 통계적 신뢰구간 아님)

`PREDICTION_RESULT.confidence`는 **0~100 스케일의 휴리스틱 점수**입니다.

```
base = cv_r2_score × 85
if |pred - mean(history)| <= 2σ:  base = min(base + 10, 95)
base = max(base, 15)
confidence = max(15, base - (horizon_day - 1) × 1.5)
```

- 1일차 대비 7일차는 **-9%p** 감쇠 (`CONFIDENCE_DECAY_PER_DAY = 1.5`).
- 데이터 부족(n<7) 경로는 40에서 시작해 동일 감쇠.
- 하한 15, 상한 95.
- **에이전트에게 중요**: 이 값을 확률로 해석하면 안 됩니다. "상대적 신뢰 순위" 정도로만 쓰세요.

## 6. 학습·추론 실행 경로

```
POST /api/predict/store/{sid}
 └ get_active_menus(sid)                      # MENU where is_active=1
 └ fetch_forecast_weather(region, KMA key)    # 매장 1회
 └ get_coords(region)                         # 매칭 실패 시 경고 로그 후 서울
 └ fetch_historical_weather(...)              # 매장 1회 (전 메뉴 공유)
 └ for each menu:
     get_sales_data(sid, mid)                 # SALES_DATA, is_deleted=0, GROUP BY date
     DemandPredictor.load()
     if 저장된 모델이 같은 이력으로 학습됨: 재학습 생략   # matches_history()
     else: .fit(sales_df, weather_df) → .save()
     .predict(days=7, forecast_df)
     save_predictions_bulk()                  # DELETE target_date>=CURDATE() → INSERT
```

> ⚠️ 모델 캐시 주의: 판매 이력이 그대로면 재학습을 건너뛰므로, 이전에 날씨 API가 실패해 날씨 없이 학습된 모델은 그대로 재사용됩니다. 날씨를 반영해 다시 학습하려면 `POST /api/train/store/{id}`로 강제 재학습하세요.

## 7. 알려진 한계 / 개선 후보 (에이전트화 시 기회)

| # | 이슈 | 근거 | 임팩트 |
|---|---|---|---|
| 1 | ~~저장된 모델을 로드해도 즉시 `fit()`으로 덮어씀~~ | — | ✅ **수정됨(2026-09-11)** — `matches_history()`로 판매 이력이 동일하면 재학습 생략. 강제 재학습은 `POST /api/train/store/{id}` |
| 2 | ~~과거 날씨 API를 메뉴 수만큼 중복 호출~~ | — | ✅ **수정됨(2026-09-11)** — 매장 전체 기간에 대해 1회 조회 후 전 메뉴가 공유 |
| 3 | 예측 정확도 사후 평가 불가 | 재예측 시 미래 예측 DELETE, 실제값 대조 저장 없음 | MAPE/정확도 리포트 불가 |
| 4 | confidence가 검증되지 않은 휴리스틱 | §5 | 의사결정 근거로 약함 |
| 5 | 프로모션·휴점·이벤트 피처 없음 | 피처 목록 | 이상치 설명 불가 |
| 6 | region 매칭 실패 시 서울로 폴백 | `get_coords` fallback | ⚠️ **경고 로그 추가됨(2026-09-11)**. 폴백 자체는 유지 — 로그를 확인해 `STORE.region` 값을 고칠 것 |
| 7 | 신규 메뉴 콜드스타트 = 요일평균 | §2 | 유사 메뉴 전이학습 여지 |

## 8. 현재 학습된 모델 인벤토리

`ai-service/trained_models/` — 11개 파일, 전부 `store_60005`:
`menu_120001`, `menu_150001` ~ `menu_150010`
→ 실제 학습이 돌아간 매장은 **1곳**뿐입니다.
