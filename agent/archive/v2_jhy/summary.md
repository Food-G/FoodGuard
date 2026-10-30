# 에이전트 지령서 v2 실행 결과 요약

실행일: 2026-10-30 · 브랜치: `jhy` (커밋하지 않음) · 상세 기록: `agent/LOG.md` · 문제 목록: `agent/ISSUES.md`

## 단계별 결과

| 단계 | 결과 | 핵심 |
|---|---|---|
| STEP 1 기준선 점검 | 완료 | 백엔드 컴파일 성공, 테스트 8개 중 7개 통과(1개는 DB 미입력). 프론트 타입 오류 4건. AI 서비스 xgboost 미설치 |
| STEP 2 프론트 타입 오류 | 완료 | 미사용 선언 4건 제거 → `tsc` 오류 0건 |
| STEP 3 문서 불일치 | 완료 | CLAUDE.md 모델 표, `main.py`, `uml/` 2개를 실제 XGBoost 코드에 맞춤 |
| STEP 4 매출 요약 API | 완료 (범위 조정) | 실제로 호출되는 본사용 주간 매출 API 1개만 구현, 테스트 3개 추가. 호출처 없는 2개는 보류(I-21) |
| STEP 5 본사 통계 화면 | 완료 | "예시 데이터" 안내 표시 |
| STEP 6 lag 피처 버그 | 완료 | 2~7일 예측의 lag_7 수정. 합성 데이터 7일 예측 WAPE **29.6% → 7.0%** |
| STEP 7 백테스트 도구 | 완료 | DB 없이 도는 시간순 백테스트. 합성 데이터에서 모델 11.8%, 지난주 같은 요일 12.1%, **요일 평균 8.9%**. 추천량 충족률 59.8%(목표 60%) |
| STEP 8 실데이터 백테스트 | **막힘** | DB 접속 정보 미입력(I-12) |
| STEP 9 측정 테이블 설계 | 완료 | `outputs/measurement_design.md` — 예측 기록, 실제 폐기, 추천 승인 기록 |
| STEP 10 종합 보고 | 완료 | 이 문서 |

검증: 백엔드 테스트 11개 중 10개 통과(실패 1개는 DB 필요한 `contextLoads`), AI 서비스 테스트 7개 모두 통과, 프론트 타입 오류 0건.

## 바뀐 코드 (커밋 전)
- 프론트: `AdminDashboard.tsx`, `AdminOrders.tsx`, `Ingredients.tsx`(미사용 선언), `Stats.tsx`(예시 안내)
- 백엔드: `SalesDataRepository.java`, `SalesDataService.java`, `SalesDataController.java` + 테스트 `SalesSummaryApiTest.java`, `SalesDataServiceTest.java`
- AI 서비스: `ml/feature_engineering.py`(lag 수정), `ml/demand_predictor.py`(`predict`의 `base_date` 선택 인자), `main.py`(설명) + 신규 `evaluation/backtest.py`, `tests/test_future_lag.py`, `tests/test_backtest.py`
- 문서: `CLAUDE.md`, `uml/architecture.md`, `uml/sequence-prediction.md`
- 환경: AI 서비스 venv에 `xgboost==3.2.0` 설치

## 해결된 이슈
I-01 프론트 타입 오류 · I-02 문서 불일치 · I-05 lag 버그 · I-17 xgboost 미설치
부분 해결: I-03 매출 API(쓰이는 1개만) · I-04 통계 화면(안내만) · I-06 신뢰도 계산(백테스트로 대체 측정)

## 남은 이슈 (심각도순)

**상**
- **I-24 모델이 단순 요일 평균보다 나쁨** (합성 데이터 11.8% vs 8.9%). 팀 더미 데이터가 같은 구조라 보고서에 "AI가 정확하다"고 쓰기 전에 확인 필요
- I-12 DB 접속 정보 미입력 → 서버 기동 불가, STEP 8 막힘
- I-14 옛 비밀 값이 git 이력에 남음 (TiDB 비밀번호 교체 여부 미확인)
- I-07 지난 예측이 남지 않음 · I-08 실제 폐기 기록 없음 → 보고서 정확도·폐기율 측정 불가 (설계안 있음)

**중**
- I-09 발주 추천이 7일 분위수 합산, 유통기한 미반영 → 과잉 발주 경향
- I-10 추천 미리보기·승인 기록 없음 (설계안 있음)
- I-11 더미 데이터 생성기가 저장소에 없음
- I-13 의존성 취약점 131개
- I-22 새 매출 집계 쿼리 DB 검증 안 됨
- I-23 학습 lag가 날짜가 아닌 행 기준

**하**
- I-15 판매 시각 없음 · I-16 `contextLoads`가 DB 필요 · I-18 Python 3.13 vs 문서 3.11 · I-19 본사 기사 수령 버튼 없음 · I-20 다이어그램 호출 흐름 불일치 · I-21 안 쓰이는 매출 요약 정의 2개

## 사람이 결정해야 할 것
1. **DB를 어떻게 할지 (I-12, I-14):** TiDB Cloud 접속 정보를 받아 입력할지, 로컬 MySQL로 갈지. 정해지면 STEP 8 재개
2. **공용 DB에 측정 테이블 추가 (I-07, I-08, I-10):** `measurement_design.md` 검토 후 팀 합의. 추천 구현 순서: 예측 기록 → 추천 승인 → 폐기 기록
3. **모델 방향 (I-24):** 요일 평균을 베이스라인으로 두고 모델이 그보다 나은지 보고할지, 글로벌 모델 등으로 개선할지
4. **더미 데이터 생성기 (I-11):** 가진 팀원에게 받아 저장소에 넣기
5. **이번 변경 커밋 여부:** 위 "바뀐 코드"를 `jhy`에 커밋할지
6. 작은 결정: 본사 기사 수령 버튼(I-19), 안 쓰이는 매출 요약 정의(I-21), 학습 lag 날짜 기준 전환(I-23)
