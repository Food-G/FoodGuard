# 측정 기록 테이블 설계안 (STEP 9)

작성: 2026-10-30 · 상태: **제안 (구현 전 팀 합의 필요)**
관련 이슈: I-07(지난 예측 소실), I-08(실제 폐기 기록 없음), I-10(추천 승인 기록 없음)

## 왜 필요한가
결과보고서의 정량 목표 세 가지는 지금 DB 구조로는 계산할 수 없다.

| 보고서 목표 | 지금 막힌 이유 | 해결할 테이블 |
|---|---|---|
| 예측 정확도 ±10% | 재예측 때 미래 예측을 지우고 다시 써서(`data_service.py:77`) 지난 예측이 남지 않음 | ① `PREDICTION_LOG` |
| 폐기율 15~20% 절감 | 실제 버린 양을 저장하는 곳이 없음 (`Inventory`에 폐기 필드 없음) | ② `WASTE_RECORD` + `INGREDIENT.unit_cost` |
| 발주 추천 활용률 80% | 추천을 보여주지 않고 바로 발주를 만들며, 수정·거절이 남지 않음 | ③ `ORDER_RECOMMENDATION` |

> 주의: 백엔드는 `spring.jpa.hibernate.ddl-auto=update`라서 엔티티를 추가하면 **다음 기동 때 공용 TiDB에 테이블이 바로 생긴다.** 팀원 모두 같은 DB를 쓰므로 머지 전에 합의한다.

---

## ① PREDICTION_LOG — 예측 스냅샷 (지우지 않음)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| log_id | BIGINT PK AI | |
| run_id | VARCHAR(36) | 한 번의 예측 실행 묶음 (UUID) |
| store_id | BIGINT | |
| menu_id | BIGINT | |
| run_date | DATE | 예측을 만든 날 |
| target_date | DATE | 예측 대상 날 |
| horizon_days | TINYINT | target_date − run_date (1~7) |
| predicted_qty | INT | 점예측 |
| recommended_order_qty | INT | 분위수 추천량 |
| confidence | DECIMAL(5,2) | |
| model_version | VARCHAR(50) | 예: `xgb_weather_v1.1` |
| created_at | DATETIME | |

- 인덱스: `(store_id, menu_id, target_date)`, `(run_date)`
- **쓰는 곳:** AI 서비스 `save_predictions_bulk`. 기존 `PREDICTION_RESULT` 삭제·삽입은 그대로 두고, 같은 값을 이 테이블에 **추가로 INSERT만** 한다(화면 동작 변화 없음).
- **읽는 곳:** 정확도 계산 API, 오프라인 백테스트(`evaluation/backtest.py`)의 실데이터 검증.

**정확도 계산 (보고서 "주간 ±10%")**
```
매장 주간 WAPE = Σ|실제 판매 − 예측| / Σ실제 판매   (같은 주, 매장 내 전체 메뉴)
- 실제 판매: SALES_DATA (is_deleted=0) 를 (store, menu, sales_date)로 합산
- 예측: 각 target_date에 대해 horizon_days = 1 인 기록 (발주에 쓰는 기준이 다르면 그 horizon으로)
```

---

## ② WASTE_RECORD — 실제 폐기 기록

| 컬럼 | 타입 | 설명 |
|---|---|---|
| waste_id | BIGINT PK AI | |
| store_id | BIGINT | |
| ingredient_id | BIGINT | |
| waste_date | DATE | 버린 날 |
| quantity | DECIMAL(10,2) | 버린 양 (식자재 기본 단위 kg·L·개) |
| unit | VARCHAR(20) | `INGREDIENT.unit`과 같아야 함 |
| reason | VARCHAR(20) | `EXPIRED` 유통기한 / `SPOILED` 변질 / `OVERPREP` 과잉 조리 / `OTHER` |
| user_id | BIGINT | 기록한 점주 |
| created_at | DATETIME | |

- 인덱스: `(store_id, waste_date)`
- 함께 추가: `INGREDIENT.unit_cost DECIMAL(10,2) NULL` — 단위당 원가. 폐기 **금액**과 뉴스벤더 기준(원가 비율) 계산에 사용. 없으면 기존처럼 `COST_RATIO=0.4` 근사
- **쓰는 곳:** 점주 화면의 간단한 "폐기 기록" 입력 (`POST /api/waste-records`, 매장 소유 검사 적용). 기록하면 재고(`INVENTORY.current_qty`)에서 같은 양을 뺀다
- **읽는 곳:** 폐기율 API, 본사 통계 화면(`Stats.tsx`의 예시 데이터를 실제 값으로 교체, I-04)

**폐기율 계산 (보고서 "폐기율 15~20% 절감")**
```
식자재 폐기율 = 기간 폐기량 / 기간 입고량
- 폐기량: WASTE_RECORD.quantity 합
- 입고량: ORDER_REQUEST 중 status = DONE 인 ordered_qty 합 (owner_received_at 기준 기간)
절감률 = (도입 전 폐기율 − 도입 후 폐기율) / 도입 전 폐기율
```
- 현장 실측이 없는 지금은 **발주 시뮬레이션 추정치**로 보고하고, 측정 방법을 FLW Standard 용어(직접 계량, 기간, 범위)로 밝힌다.

---

## ③ ORDER_RECOMMENDATION — 추천과 점주 결정

| 컬럼 | 타입 | 설명 |
|---|---|---|
| rec_id | BIGINT PK AI | |
| batch_id | VARCHAR(36) | 한 번 미리보기에서 나온 추천 묶음 |
| store_id | BIGINT | |
| ingredient_id | BIGINT | |
| required_qty | DECIMAL(10,2) | 예측 기반 필요량 |
| current_stock | DECIMAL(10,2) | 당시 재고 |
| pending_qty | DECIMAL(10,2) | 당시 미처리 발주량 |
| recommended_qty | DECIMAL(10,2) | 추천 발주량 |
| decision | VARCHAR(20) | `PENDING` / `ACCEPTED` 그대로 승인 / `MODIFIED` 수정 승인 / `REJECTED` 거절 |
| final_qty | DECIMAL(10,2) NULL | 실제 발주한 양 |
| order_id | BIGINT NULL | 생성된 `ORDER_REQUEST` |
| decided_at | DATETIME NULL | |
| created_at | DATETIME | |

- 인덱스: `(store_id, created_at)`, `(batch_id)`
- **흐름 (지금 "자동 발주" 버튼을 바꾸는 부분)**
  1. 점주가 발주 화면을 열면 `GET /api/orders/recommend/{storeId}` → 추천을 `PENDING`으로 저장하고 미리보기 표시 (필요량·현재고·미처리·품절 위험)
  2. 점주가 품목별로 그대로 / 수량 수정 / 빼기 선택 → `POST /api/orders/recommend/{batchId}/decide`
  3. 승인된 품목만 `ORDER_REQUEST` 생성, `decision`·`final_qty`·`order_id` 기록
- **읽는 곳:** 추천 활용률 API, 에이전트 평가

**추천 활용률 계산 (보고서 "점주 80% 이상 활용")**
```
활용률     = (ACCEPTED + MODIFIED) / (ACCEPTED + MODIFIED + REJECTED)
그대로 승인률 = ACCEPTED / 같은 분모           ← 국내 사례 비교치: 육수당 60% 이상
평균 수정 폭  = 평균 |final_qty − recommended_qty| / recommended_qty   (MODIFIED만)
```
- 사후 평가(선택): 수정·거절한 품목이 이후 폐기 또는 품절로 이어졌는지 ②와 비교 → "틀린 추천을 거절한 비율"

---

## 선택: 품절 기록 (I-15 연계)
판매 기록에 시각이 없어 품절을 추정할 수 없다. 최소안으로 `SALES_DATA`와 별도로 `STOCKOUT_RECORD(store_id, menu_id, date, noted_at)`를 두고 점주가 "오늘 품절" 버튼으로 남긴다. 품절된 날의 판매량은 실제 수요보다 작으므로 학습·평가에서 표시해 두면 과소예측을 줄일 수 있다(연구 문서 D축).

---

## 보고서 지표 ↔ 테이블 연결

| 보고서 지표 | 계산식 | 필요한 테이블 |
|---|---|---|
| 예측 정확도 (주간 ±10%) | 매장 주간 WAPE | ① PREDICTION_LOG + SALES_DATA |
| 폐기율 절감 (15~20%) | (도입 전 − 후) 폐기율 / 도입 전 폐기율 | ② WASTE_RECORD + ORDER_REQUEST(DONE) (+ INGREDIENT.unit_cost) |
| 추천 활용률 (80%) | (그대로 + 수정) / 전체 결정 | ③ ORDER_RECOMMENDATION |
| 의사결정 지원 (정성) | 그대로 승인률, 수정 폭, 사후 폐기·품절 | ③ + ② (+ 품절 기록) |

## 구현 순서 제안
1. ① PREDICTION_LOG — AI 서비스에 INSERT 한 줄 추가, 화면 변화 없음. **가장 먼저, 가장 위험이 적음**
2. ③ ORDER_RECOMMENDATION — 자동 발주를 "미리보기 → 승인"으로 바꾸는 화면 작업 포함
3. ② WASTE_RECORD — 점주 입력 화면 필요, 실제 데이터가 쌓여야 의미 있음

## 팀이 정할 것
- 공용 TiDB에 테이블 4개(+컬럼 1개) 추가에 동의하는지
- 정확도를 어느 horizon 기준으로 보고할지 (1일 전 예측 vs 발주에 쓰는 예측)
- 자동 발주 버튼을 승인 단계가 있는 흐름으로 바꿀지
