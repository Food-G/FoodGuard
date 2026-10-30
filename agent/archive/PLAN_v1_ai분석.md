# AI 서비스 예측 로직 분석 지시서

## 현재 상태
- 현재 단계: STEP 1
- 상태: TODO        <!-- TODO | IN_PROGRESS | DONE | BLOCKED -->

## 목표
`ai-service`의 수요 예측 로직을 코드 기준으로 분석하고, CLAUDE.md에 적힌 명세와 실제 구현의 차이 및 문제점을 정리한 뒤 개선 계획을 세운다. **코드는 수정하지 않는다.**

## 실행 규칙 (매 실행마다 지킬 것)
1. 이 파일을 먼저 읽고 "현재 단계"만 수행한다.
2. 한 번 실행에 한 단계만 처리한다.
3. 시작할 때 상태를 IN_PROGRESS로, 완료 기준을 모두 충족하면 다음 단계로 바꾸고 상태를 TODO로 되돌린다.
4. 단계를 마치면 LOG.md 맨 아래에 기록을 추가한다.
5. 완료 기준을 충족하지 못하면 다음 단계로 넘어가지 않는다.
6. 모든 주장에는 근거(`파일경로:라인`)를 붙인다. 근거 없는 추측은 "추정"으로 표시한다.
7. 판단이 불확실하거나 파일이 없으면 상태를 BLOCKED로 바꾸고 이유를 LOG.md에 적은 뒤 멈춘다.
8. 마지막 단계가 끝나면 현재 단계를 `ALL`, 상태를 `DONE`으로 바꾸고 루프를 종료한다.

## 참고 명세
- `CLAUDE.md`의 "FoodGuard 프로젝트 컨텍스트" 섹션 (예측 흐름, 모델 전략, 신뢰도, 날씨 피처)

---

## STEP 1. 전체 흐름 분석
- 입력: `ai-service/main.py`, `ai-service/routers/prediction.py`, `ai-service/routers/training.py`, `ai-service/services/prediction_service.py`
- 할 일: API 엔드포인트부터 DB 저장까지 호출 흐름 추적
- 출력: `agent/outputs/01_flow.md`
- 완료 기준:
  - [ ] 엔드포인트 목록 (경로, 메서드, 호출 함수)
  - [ ] `POST /api/predict/store/{id}` 호출 순서를 함수 단위로 정리
  - [ ] 파일별 역할 요약
  - [ ] CLAUDE.md "AI 예측 흐름"과 다른 점

## STEP 2. 데이터 조회/저장 분석
- 입력: `ai-service/services/data_service.py`, `ai-service/database.py`, `ai-service/config.py`
- 할 일: 어떤 테이블을 어떤 조건으로 읽고 쓰는지 정리
- 출력: `agent/outputs/02_data.md`
- 완료 기준:
  - [ ] 테이블별 SQL 요약 (MENU, SALES_DATA, STORE, PREDICTION_RESULT)
  - [ ] 판매 이력 조회 기간/필터 조건
  - [ ] 예측 결과 저장 방식 (insert/upsert, 기존 데이터 처리)
  - [ ] 의문점/문제점 목록

## STEP 3. 날씨 데이터 분석
- 입력: `ai-service/services/weather_service.py`
- 할 일: 기상청 단기/중기예보와 Open-Meteo 사용 방식 정리
- 출력: `agent/outputs/03_weather.md`
- 완료 기준:
  - [ ] 단기(1~3일)/중기(4~7일)/과거 날씨 각각의 조회 방식과 반환 형태
  - [ ] region → 좌표 변환 방식
  - [ ] API 실패 시 동작 (fallback, 기본값)
  - [ ] 의문점/문제점 목록

## STEP 4. 피처 엔지니어링 분석
- 입력: `ai-service/ml/feature_engineering.py`, `agent/outputs/03_weather.md`
- 할 일: 생성되는 피처 전체와 생성 방식 정리
- 출력: `agent/outputs/04_features.md`
- 완료 기준:
  - [ ] 피처 전체 목록 (이름, 계산식, 분류: 날짜/날씨/lag/rolling)
  - [ ] 날씨 피처 6개가 명세와 일치하는지 (`is_hot`, `is_cold`, `is_rainy` 임계값 포함)
  - [ ] 예측 시점 lag/rolling 피처를 어떻게 채우는지 (미래 값 누수 여부)
  - [ ] 의문점/문제점 목록

## STEP 5. 모델 전략/신뢰도 분석
- 입력: `ai-service/ml/demand_predictor.py`, `ai-service/services/prediction_service.py`
- 할 일: 데이터 수에 따른 전략 분기와 신뢰도 계산 검증
- 출력: `agent/outputs/05_model.md`
- 완료 기준:
  - [ ] 데이터 수 구간별 분기 조건 (<7, 7~29, ≥30) 실제 코드와 명세 비교
  - [ ] RandomForest 하이퍼파라미터, 학습/검증 분할 방식, R² 계산 방식
  - [ ] 신뢰도 계산식 (R²×85%, 최대 95%, 하루당 1.5% 감소, 최소 15%) 명세 일치 여부
  - [ ] 모델 저장/재사용 여부 (매 요청마다 재학습하는지)
  - [ ] 의문점/문제점 목록

## STEP 6. 문제점 종합 및 우선순위
- 입력: `agent/outputs/01_flow.md` ~ `agent/outputs/05_model.md`
- 할 일: 각 단계의 문제점을 모아 중복 제거 후 우선순위 분류
- 출력: `agent/outputs/06_issues.md`
- 완료 기준:
  - [ ] 문제점 통합 표 (ID, 내용, 근거, 심각도: 상/중/하, 영향 범위)
  - [ ] 명세-구현 불일치 항목 별도 표시
  - [ ] 상위 3개 선정 이유

## STEP 7. 개선 계획
- 입력: `agent/outputs/06_issues.md`
- 할 일: 우선순위 상위 항목의 개선 방안 작성 (코드 수정 X)
- 출력: `agent/outputs/07_plan.md`
- 완료 기준:
  - [ ] 항목별 수정 방안, 수정 대상 파일, 예상 영향
  - [ ] 항목별 검증 방법 (테스트 또는 확인 절차)
  - [ ] 전체 분석 요약 (5줄 이내)

## STEP 8. 커밋 및 푸시
- 입력: `agent/` 폴더 전체
- 할 일: 분석 결과를 jhy 브랜치에 커밋 후 푸시
- 완료 기준:
  - [ ] 현재 브랜치가 jhy인지 확인 (아니면 BLOCKED)
  - [ ] `agent/` 폴더만 stage (`git add agent/`), 다른 파일은 포함하지 않음
  - [ ] 커밋 메시지: "docs: AI 서비스 예측 로직 분석 결과 추가"
  - [ ] `git push origin jhy`
  - [ ] push 실패 시 BLOCKED로 바꾸고 에러 내용 기록 (force push 금지)

---

## 금지 사항
- `ai-service` 코드 수정 금지 (분석만 수행)
- DB 쓰기, 학습/예측 API 호출 금지 (`mcp__foodguard-ai__train_store`, `predict_*` 포함)
- `.env` 내용(DB 접속 정보, API 키)을 출력물에 기록 금지
- STEP 8 이외의 git commit/push 금지 (STEP 8에서도 `agent/` 외 파일 커밋, force push, jhy 외 브랜치 push 금지)
- 이전 단계 출력물 덮어쓰기 금지 (보완이 필요하면 해당 파일 끝에 "추가 확인" 섹션으로 덧붙임)
