# FoodGuard 에이전트 지령서 v2

## 현재 상태
- 현재 단계: STEP 8 (나머지 단계 완료 · 2026-10-30)
- 상태: BLOCKED        <!-- TODO | IN_PROGRESS | DONE | BLOCKED -->

## 목표
FoodGuard를 "효과를 숫자로 보여줄 수 있는 상태"로 만든다. DB 없이 할 수 있는 작업부터 처리하고, 하는 동안 발견한 문제는 모두 `agent/ISSUES.md`에 쌓는다.
배경 문서: 연구 방향 https://claude.ai/artifact/56ejsZG7JaMSuztGphueud · 계획 대비 점검 https://claude.ai/artifact/HKhTSQykqHUi54WRk6D6rz

## 실행 규칙 (매 실행마다)
1. 이 파일, `agent/ISSUES.md`, `agent/LOG.md` 마지막 기록을 먼저 읽는다.
2. "현재 단계" 하나만 수행한다. 시작할 때 상태를 IN_PROGRESS로 바꾼다.
3. 완료 기준을 모두 확인한 뒤에만 다음 단계로 넘기고 상태를 TODO로 되돌린다. 확인은 실제 명령 실행 결과로 한다(추정 금지).
4. 끝나면 `LOG.md` 맨 아래에 기록한다: 날짜, 단계, 결과, 바꾼 파일, 확인한 명령과 결과, 새로 등록한 이슈 ID.
5. 작업 중 범위 밖 문제를 발견하면 고치지 말고 `ISSUES.md`에 등록만 한다.
6. 막히면 상태를 BLOCKED로 바꾸고 이유를 `LOG.md`와 `ISSUES.md`에 적은 뒤 멈춘다.
7. 모든 주장에는 근거(`파일경로:라인` 또는 실행한 명령)를 붙인다.
8. CLAUDE.md의 원칙(최소 변경, 기존 스타일 유지)을 따른다.

## 실행 환경 메모
- 백엔드 빌드: PowerShell에서 `$env:JAVA_HOME="C:\Program Files\Java\jdk-17"` 후 `backend\gradlew.bat compileJava test` (기본 Java가 11이라 지정 필요)
- 프론트 검사: `frontend`에서 `npx tsc --noEmit -p .`
- AI 서비스: `ai-service\venv\Scripts\python.exe` 사용
- DB 접속 정보는 아직 비어 있다(I-12). DB가 필요한 단계는 "DB 대기"로 표시했고, 그 단계에 도달하면 BLOCKED로 멈춘다.

---

## STEP 1. 기준선 점검
- 할 일: 백엔드 빌드·테스트, 프론트 타입 검사, AI 서비스 문법 검사(`python -m compileall -q ai-service`)를 실행해 현재 상태를 기록한다.
- 완료 기준:
  - [ ] 세 검사의 결과(성공/실패, 실패 건수)를 LOG에 기록
  - [ ] 새로 발견한 실패는 ISSUES에 등록

## STEP 2. 프론트 타입 오류 정리 (I-01)
- 할 일: `tsc` 오류 4건(사용하지 않는 import/변수)을 제거한다. 기능 코드는 건드리지 않는다.
- 완료 기준:
  - [ ] `npx tsc --noEmit -p .` 오류 0건
  - [ ] 바뀐 줄이 미사용 선언 제거뿐임을 `git diff`로 확인

## STEP 3. 문서와 코드 불일치 정리 (I-02)
- 할 일: CLAUDE.md "모델 전략" 표를 실제 `ai-service/ml/demand_predictor.py` 분기에 맞춘다. `ai-service/main.py`의 "Random Forest" 설명, `uml/sequence-prediction.md`의 RandomForest 표기를 XGBoost 기준으로 고친다.
- 완료 기준:
  - [ ] `git grep -n -i "random ?forest" -- CLAUDE.md ai-service uml` 결과가 이력 설명(전환 기록) 외에는 없음
  - [ ] 모델 전략 표의 각 구간이 코드의 조건문과 1:1로 대응 (근거 라인 LOG에 기록)

## STEP 4. 누락된 매출 요약 API 3개 (I-03)
- 할 일: 프론트가 호출하지만 백엔드에 없는 `GET /api/sales/{storeId}/today-summary`, `GET /api/sales/{storeId}/weekly-summary`, `GET /api/sales/all-stores/weekly-summary`를 구현한다. 응답 형태는 `frontend/src/services/salesService.ts`와 이를 쓰는 화면(`AdminDashboard.tsx` 등)이 기대하는 모양에 맞춘다. 매장 소유 검사(`StoreAccessService`)와 본사 전용 권한을 기존 규칙대로 적용한다.
- 완료 기준:
  - [ ] 세 엔드포인트의 컨트롤러·서비스 추가, `compileJava` 성공
  - [ ] 각 엔드포인트의 응답 형태와 권한을 검증하는 테스트 추가, `test` 통과
  - [ ] 프론트가 읽는 필드 이름과 응답 필드 이름이 일치함을 LOG에 대조표로 기록

## STEP 5. 본사 통계 화면 가상 수치 표시 (I-04)
- 할 일: `frontend/src/pages/admin/Stats.tsx`의 하드코딩 수치가 실측으로 오해되지 않도록 화면 상단에 "예시 데이터" 표시를 넣는다. 실제 데이터 연결은 하지 않는다(별도 이슈로 남긴다).
- 완료 기준:
  - [ ] 화면에 예시 데이터임을 알리는 문구가 보임 (코드 근거 기록)
  - [ ] `tsc` 오류 0건 유지

## STEP 6. 예측일 기준 lag 피처 수정 (I-05)
- 할 일: `ai-service/ml/feature_engineering.py`의 `make_future_feature_row`가 2~7일 앞 예측에서 `lag_7`, `lag_14`를 "예측일 기준 7일·14일 전 실측값"으로 계산하도록 고친다. `lag_1`은 1일 앞에서만 실측값이 있으므로 처리 방식을 정하고 근거를 LOG에 적는다.
- 완료 기준:
  - [ ] 합성 시계열(요일 패턴이 뚜렷한 데이터)로 수정 전후를 비교하는 테스트 추가 (`ai-service/tests/`)
  - [ ] 테스트가 수정 후에 통과하고, 3일 뒤 예측의 `lag_7`이 같은 요일 값임을 단언

## STEP 7. 오프라인 시간순 백테스트 도구 (I-06, I-07)
- 할 일: DB 없이 판매 이력 DataFrame(`ds`, `y`)만으로 돌아가는 `ai-service/evaluation/backtest.py`를 만든다. 시간순 롤링으로 `DemandPredictor`를 학습·예측하고, 베이스라인 2종(지난주 같은 요일, 요일 평균)과 WAPE·MASE를 비교한다. 분위수 추천량의 충족률(실판매 ≤ 추천량 비율)도 계산한다.
- 완료 기준:
  - [ ] 합성 데이터로 실행되는 예시 명령과 결과 표를 LOG에 기록
  - [ ] 결과가 시간 순서를 지킴(학습 구간이 항상 예측일보다 앞섬)을 단언하는 테스트 통과

## STEP 8. (DB 대기) 실데이터 백테스트
- 할 일: DB 연결 복구 후 STEP 7 도구로 실제 SALES_DATA를 평가한다. DB 접속 정보가 비어 있으면 BLOCKED.
- 완료 기준:
  - [ ] 매장·메뉴별 WAPE, 매장 주간 합계 WAPE를 `agent/outputs/backtest_real.md`에 기록

## STEP 9. (설계만) 측정 기록 테이블 제안 (I-07, I-08, I-10)
- 할 일: 공용 DB를 바꾸는 일이라 구현하지 않는다. `PREDICTION_LOG`(예측 스냅샷), 실제 폐기 기록, 추천 승인·수정·거절 기록의 테이블 설계안과 이를 쓰는 API 흐름을 `agent/outputs/measurement_design.md`에 쓴다.
- 완료 기준:
  - [ ] 테이블별 컬럼·인덱스·누가 쓰고 읽는지 정리
  - [ ] 보고서 지표(정확도, 폐기율 절감, 추천 활용률) 각각이 어느 테이블에서 계산되는지 표로 연결

## STEP 10. 종합 보고
- 할 일: LOG와 ISSUES를 정리해 `agent/outputs/summary.md`에 쓴다. 해결된 이슈, 남은 이슈(심각도순), 사람이 결정해야 할 것을 나눈다.
- 완료 기준:
  - [ ] 위 세 구분이 모두 있음
  - [ ] 현재 단계를 `ALL`, 상태를 `DONE`으로 바꾸고 종료

---

## 금지 사항
- git commit, push, branch 생성 금지 (사람이 직접 지시할 때만)
- DB 쓰기, 학습·예측 API 호출 금지 (STEP 8의 읽기 전용 조회만 예외)
- `application-local.properties`, `ai-service/.env` 열람·수정·출력 금지. 비밀 값을 로그나 문서에 적지 않음
- 지정 범위 밖 파일 수정 금지 (발견한 문제는 ISSUES에 등록만)
- 이전 단계 산출물 덮어쓰기 금지 (보완은 "추가 확인" 섹션으로 덧붙임)
