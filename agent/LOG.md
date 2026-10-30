# 실행 기록

<!-- 형식:
## YYYY-MM-DD | STEP N | DONE/BLOCKED
- 수행:
- 바꾼 파일:
- 확인한 명령과 결과:
- 새 이슈:
- 다음:
-->

## 2026-10-30 | STEP 1 기준선 점검 | DONE
- 수행: 백엔드 빌드·전체 테스트, 프론트 타입 검사, AI 서비스 문법·import 검사
- 바꾼 파일: 없음 (agent/ 문서만)
- 확인한 명령과 결과:
  - 백엔드 `gradlew compileJava test --continue` (JDK 17): 컴파일 성공. 테스트 8개 중 7개 통과(AccessControlTest 5, UserServiceTest 2). `FoodguardApplicationTests.contextLoads` 실패 — 원인 `UnknownHostException: <host>` (DB 접속 정보 자리표시자, I-12)
  - 프론트 `npx tsc --noEmit -p .`: 오류 4건 (I-01과 동일, 새 오류 없음)
  - AI `python -m compileall ai-service`: 성공
  - AI `import ml.demand_predictor`: 실패 — `ModuleNotFoundError: xgboost`. requirements.txt 중 미설치는 `xgboost==3.2.0` 하나 (설치 패키지 45개, mcp 설치됨)
  - venv Python 3.13.9
- 새 이슈: I-16, I-17, I-18
- 다음: STEP 2 (프론트 타입 오류 정리). 참고로 STEP 6·7은 xgboost가 있어야 실행 가능 → I-17 해결 필요

## 2026-10-30 | STEP 2 프론트 타입 오류 정리 | DONE
- 수행: 미사용 선언 4건 제거
- 바꾼 파일: `frontend/src/pages/admin/AdminDashboard.tsx`(Button import), `frontend/src/pages/admin/AdminOrders.tsx`(STAGE_LABELS 상수, handleDriverReceive 함수), `frontend/src/pages/Ingredients.tsx`(storeLoading 구조분해)
- 확인한 명령과 결과:
  - `npx tsc --noEmit -p .`: 오류 0건 (이전 4건)
  - `git diff --stat -- frontend/src`: 3개 파일, +2 −12. 바뀐 줄은 모두 미사용 선언 제거
- 새 이슈: I-19 (본사 화면의 기사 수령 수동 처리 버튼 부재)
- 다음: STEP 3 (문서와 코드 불일치 정리)

## 2026-10-30 | STEP 3 문서와 코드 불일치 정리 | DONE
- 수행: 모델 설명을 실제 코드(XGBoost, 데이터 양별 4구간)에 맞춤
- 바꾼 파일: `CLAUDE.md`(모델 전략 표), `ai-service/main.py:12`(API 설명), `uml/architecture.md`(모델 박스, 기술 스택), `uml/sequence-prediction.md`(분기)
- 근거 (`ai-service/ml/demand_predictor.py`): 0개 → `_zero_predictions`(:179-180), 1~6개 → `fit`에서 `is_trained=False`(:92-95) 후 `_simple_avg_predictions`(:186-187), 7~14 → MINIMAL(:102-103), 15~29 → MID(:100-101), ≥30 → FULL(:98-99), 날씨는 데이터가 있으면 모든 XGBoost 구간에 추가(:107-113)
- 확인한 명령과 결과:
  - `git grep -n -i "random ?forest" -- CLAUDE.md ai-service uml`: `PROJECT_STATUS.md`의 전환 이력 2곳만 남음
  - `py_compile ai-service/main.py`: 성공
  - `git diff --stat`: 4개 파일, +15 −10
- 새 이슈: I-20 (시퀀스·아키텍처 다이어그램의 호출 흐름 불일치)
- 다음: STEP 4 (누락된 매출 요약 API 3개)

## 2026-10-30 | STEP 4 누락된 매출 요약 API | DONE (범위 조정)
- 범위 조정: 지령서는 3개 API 구현이었으나, 확인해 보니 프론트에서 실제 호출하는 것은 `GET /api/sales/all-stores/weekly-summary` 하나뿐(`AdminDashboard.tsx:35`). `today-summary`, `weekly-summary`는 `salesService.ts`에 정의만 있고 호출처 0건 → CLAUDE.md "요청되지 않은 기능 금지" 원칙에 따라 구현하지 않고 I-21로 등록
- 수행: 전체 가맹점 최근 7일(오늘 포함) 매출 합계 API 구현. 매출액 = 판매 수량 × 메뉴 가격(SALES_DATA에 가격이 없어 MENU.price 사용). 본사 관리자 전용(`StoreAccessService.checkHqAdmin`)
- 바꾼 파일: `SalesDataRepository.java`(집계 쿼리), `SalesDataService.java`(getAllStoreWeeklyRevenue), `SalesDataController.java`(엔드포인트), 테스트 추가 `SalesSummaryApiTest.java`, `service/SalesDataServiceTest.java`
- 응답 대조표:
  | 프론트 사용 (`AdminDashboard.tsx`) | 백엔드 응답 |
  |---|---|
  | `weeklyRevenue: Record<string, number>` | `Map<Long, Long>` → JSON `{"1": 150000, ...}` |
  | `weeklyRevenue[s.id]` (매장 id로 조회) | 키 = storeId |
  | `Object.values(...).reduce(합계)` | 값 = 금액(원) |
- 확인한 명령과 결과: `gradlew compileJava test --continue` (JDK 17) → 컴파일 성공, 테스트 11개 중 10개 통과. 새 테스트 3개 모두 통과(SalesSummaryApiTest 2, SalesDataServiceTest 1). 실패 1개는 기존 `contextLoads`(I-16, DB 미입력)
- 미검증: 집계 JPQL은 DB 없이 실행 확인 불가 → I-22
- 새 이슈: I-21, I-22
- 다음: STEP 5 (본사 통계 화면 가상 수치 표시)

## 2026-10-30 | STEP 5 본사 통계 화면 가상 수치 표시 | DONE
- 수행: `Stats.tsx` 상단에 "예시 데이터로 구성된 화면" 안내(MUI `Alert`, info)를 추가. 차트·문구 데이터는 그대로 둠
- 바꾼 파일: `frontend/src/pages/admin/Stats.tsx` (import에 Alert 추가, 안내 3줄)
- 확인한 명령과 결과: `npx tsc --noEmit -p .` 오류 0건. `git diff`로 바뀐 줄이 import 1줄과 안내 3줄뿐임을 확인
- 미검증: 브라우저 렌더링은 확인 못 함 (백엔드가 DB 없이 기동 불가 → 본사 로그인 불가, I-12)
- 새 이슈: 없음. 실제 폐기 데이터 연결은 폐기 기록 테이블(I-08)이 생긴 뒤 가능
- 다음: STEP 6 (예측일 기준 lag 피처 수정). xgboost 미설치(I-17) 상태라 테스트 실행 전에 설치 필요

## 2026-10-30 | STEP 6 예측일 기준 lag 피처 수정 | DONE
- 사전 작업: I-17 해결 — `pip install xgboost==3.2.0`, `import ml.demand_predictor` 성공
- 수행: `make_future_feature_row`의 `_get_lag`를 "마지막 실측일 기준 n번째 값"에서 "예측일 기준 n일 전 실측값"으로 변경
- lag_1 처리 결정: 2일 이상 뒤 예측에서는 예측일 하루 전이 아직 미래라 실측이 없으므로 마지막 실측값을 쓴다(기존 동작 유지). 예측값을 lag로 재사용하면 오차가 누적되는 문제가 있어(기존 주석 #1) 그 방식은 쓰지 않음. lag_7·lag_14는 7일 이내 예측에서 항상 실측값이 존재
- 바꾼 파일: `ai-service/ml/feature_engineering.py` (`_get_lag`), 테스트 추가 `ai-service/tests/test_future_lag.py`
- 확인한 명령과 결과:
  - 수정 전 `python -m unittest discover -s tests`: 2~7일 뒤 6개 하위 케이스 모두 실패 (lag_7이 예측일과 무관하게 항상 20.0)
  - 수정 후 같은 명령: 3개 테스트 모두 통과
  - 모델 단위 비교 (합성 요일 패턴 + 10% 노이즈, 60일 학습, 날씨 없음, 20회 반복): 7일 예측 WAPE 평균 수정 전 29.6% → 수정 후 7.0%. 스크립트는 세션 scratchpad의 lag_compare.py (저장소 밖)
- 새 이슈: I-23 (학습 lag가 날짜가 아닌 행 기준)
- 다음: STEP 7 (오프라인 시간순 백테스트 도구)

## 2026-10-30 | STEP 7 오프라인 시간순 백테스트 도구 | DONE
- 수행: DB 없이 판매 이력 DataFrame으로 도는 롤링 백테스트 작성. 예측 시점을 7일씩 옮기며 그 이전 데이터로만 학습 → 다음 7일 예측 → 실제와 비교. 베이스라인 2종(지난주 같은 요일, 학습 기간 요일 평균), 지표 WAPE·MASE·추천량 충족률
- 필요한 변경: `DemandPredictor.predict()`가 시작일을 항상 max(마지막 판매일, 오늘)로 정해 과거 시점 예측이 불가 → 선택 인자 `base_date` 추가 (생략 시 기존 동작 그대로)
- 바꾼 파일: `ai-service/ml/demand_predictor.py`(predict 인자), 추가 `ai-service/evaluation/__init__.py`, `ai-service/evaluation/backtest.py`, `ai-service/tests/test_backtest.py`
- 확인한 명령과 결과:
  - `python -m unittest discover -s tests`: 7개 모두 통과 (백테스트 4: 학습 종료일 < 예측일, 예측일 = 학습 종료일 + h, 평가일 누락·중복 없음, 요약 표 구성 / lag 3)
  - `python -m evaluation.backtest` (합성 120일, 예측 시점 14개, 평가 92일):
    | 방법 | WAPE(%) | MASE |
    |---|---|---|
    | FoodGuard 모델 | 11.8 | 0.91 |
    | 지난주 같은 요일 | 12.1 | 0.94 |
    | 요일 평균 | 8.9 | 0.69 |
    추천 발주량 충족률 59.8% (목표 60%)
- 해석: 분위수 추천량은 목표대로 보정됨. 다만 모델이 단순 요일 평균보다 나쁨. 이 합성 데이터는 요일 평균에 이상적인 구조이며, 팀 더미 데이터도 같은 구조임
- 한계: 날씨 미사용(학습·예측 모두 계절 평균값), 실제 판매가 없는 날짜는 평가 제외
- 새 이슈: I-24 (모델이 요일 평균보다 나쁨)
- 다음: STEP 8 (실데이터 백테스트) — DB 접속 정보 미입력(I-12)이면 BLOCKED

## 2026-10-30 | STEP 8 실데이터 백테스트 | BLOCKED
- 이유: DB 접속 정보 미입력(I-12). `backend/.../application-local.properties`와 `ai-service/.env`의 DB 값이 자리표시자 상태
- 사람 결정: 사용자 지시로 STEP 8은 건너뛰고 STEP 9부터 진행. DB가 준비되면 STEP 8로 돌아온다
- 할 일 (재개 시): STEP 7 도구로 SALES_DATA를 메뉴별로 평가, I-22(집계 JPQL) 검증, I-24(모델 < 요일 평균) 재확인

## 2026-10-30 | STEP 9 측정 기록 테이블 설계안 | DONE
- 수행: 공용 DB 변경 없이 설계 문서만 작성 → `agent/outputs/measurement_design.md`
- 내용: ① PREDICTION_LOG(예측 스냅샷, 기존 저장에 INSERT만 추가) ② WASTE_RECORD + INGREDIENT.unit_cost(실제 폐기·원가) ③ ORDER_RECOMMENDATION(추천 → 점주 승인·수정·거절 기록), 선택안 STOCKOUT_RECORD. 테이블별 컬럼·인덱스·쓰는 곳·읽는 곳, 보고서 지표 3개 계산식, 구현 순서, 팀 결정 사항
- 완료 기준 확인: 테이블별 컬럼·인덱스·쓰고 읽는 곳 정리됨 / 정확도·폐기율 절감·추천 활용률이 각각 어느 테이블에서 계산되는지 연결 표 포함
- 근거: 기존 엔티티 `PredictionResult`, `Inventory`, `OrderRequest`, `Ingredient` 컬럼 확인. `ddl-auto=update`라 엔티티 추가 시 공용 DB에 즉시 생성됨을 문서에 경고
- 바꾼 파일: 없음 (agent/outputs 문서만)
- 새 이슈: 없음 (I-07, I-08, I-10은 설계안이 나왔고 팀 결정 대기)
- 다음: STEP 10 (종합 보고)

## 2026-10-30 | STEP 10 종합 보고 | DONE
- 수행: `agent/outputs/summary.md` 작성 — 단계별 결과, 바뀐 코드, 해결된 이슈, 남은 이슈(심각도순), 사람이 결정할 것 6가지
- 확인: `git status`의 변경 목록과 요약 문서의 "바뀐 코드" 일치. 커밋하지 않음
- 최종 상태: STEP 8만 BLOCKED(DB 대기), 나머지 완료. 지령서 규칙의 `ALL/DONE` 대신 STEP 8 재개 가능하도록 현재 단계를 STEP 8로 둠

## 2026-10-30 | 기준 전환: jhy → jihwan | DONE
- 배경: `origin/jihwan`(김지환, 커밋 13개)이 jhy에서 한 코드 작업(비밀 값 분리, 권한 검사, lag 수정, 백테스트, 매출 API, tsc 정리)을 이미 더 깊게 구현. jhy와 합치면 16개 파일 충돌
- 수행:
  - jhy 미커밋 문서 변경(CLAUDE.md, uml 2개, .idea)을 `git stash`에 보관 ("jhy 미커밋: CLAUDE.md·uml 문서 수정, .idea (2026-10-30)")
  - 로컬 `jihwan` 브랜치 생성(origin/jihwan 추적) 후 전환. jhy 브랜치와 커밋 2개(`5d60e6f`, `6ed2e43`)는 그대로 둠
  - 비밀 값: jihwan 방식인 `backend/.env` 생성(JWT_SECRET 이전, DB_PASSWORD 비어 있음). jihwan에서 git 제외가 아닌 `application-local.properties`(JWT 키 포함)는 삭제
  - 인계 문서 6절 설정: `pip install -r requirements-dev.txt`(pytest 8.3.3), `npm ci --legacy-peer-deps`(303개, 취약점 16)
- 기준 수치 확인 (인계 문서 5절, DB 불필요 항목):
  - `python -m pytest tests`: 33 passed (인계 문서 24 이후 테스트 추가된 것으로 보임)
  - `python backtest.py --synthetic`: 글로벌 모델 14.8% / 0.817 — 기대값과 일치
  - `npx tsc --noEmit`: 0건
  - `gradlew test --tests "com.foodguard.service.*" --tests "com.foodguard.security.*"`: BUILD SUCCESSFUL (12개)
- agent 문서 재편: 지령서 v2·문제 목록 v1·결과물 2개를 `archive/v2_jhy/`로 이동. 문제 목록 v2(jihwan 기준, 해결 10건 닫음, 열린 문제 22건)와 지령서 v3(8단계) 작성
- 다음: 지령서 v3 STEP 1

## 2026-10-30 | v3 STEP 1 작은 문서 정합성 (I-02) | DONE
- 수행: AI 서비스 설명과 uml 2개를 jihwan 코드 기준으로 갱신
- 바꾼 파일: `ai-service/main.py:12`(글로벌 XGBoost), `uml/architecture.md`(AI 엔드포인트 4개, 피처·모델, Claude CLI, DB=TiDB와 테이블, 호출·저장 흐름, 기술 스택, 설계 패턴), `uml/sequence-prediction.md` 1절(예측 흐름)
- 근거:
  - 엔드포인트: `ai-service/main.py:24-27`, `routers/prediction.py:20,35,67`, `routers/training.py:11`, `routers/explain.py:48`, `routers/events.py:46`
  - 백엔드는 storeId만 POST: `backend/.../service/PredictionService.java:32-34`
  - AI가 DB 직접 조회·저장: `services/data_service.py`(SALES_DATA, SALES_DAY_FLAG, STORE_EVENT_NOTE, MENU_INGREDIENT 조회, PREDICTION_RESULT 삭제 후 INSERT `:218`)
  - 글로벌 모델 요청당 1회 학습·safety_factor: `services/prediction_service.py:33-52, 55-74`, 휴무일 0: `:108-111`
  - 피처: `ml/feature_engineering.py:20-27` GLOBAL_FEATURE_COLS, 모델 버전 `xgb_global_v2.1` (`prediction_service.py:30`)
  - 예측 시작일: `ml/demand_predictor.py` predict의 `max(마지막 판매일, 오늘)` 다음 날부터
- 확인한 명령과 결과:
  - `git grep -n -i "random ?forest" -- ai-service/main.py uml CLAUDE.md`: 0건
  - `py_compile ai-service/main.py`: 성공
  - `git diff --stat`: 3개 파일, +38 −33
- 범위 밖으로 남긴 것: architecture.md의 백엔드 컨트롤러·서비스 목록(stats, waste-records, sales-day-flags, event-notes 등 미기재)은 이번 범위(모델·흐름) 밖이라 그대로 둠 → I-02 비고에 추가
- 다음: STEP 2 (결과보고서 수정 목록)

## 2026-10-30 | v3 STEP 2 결과보고서 수정 목록 | DONE
- 수행: 결과보고서(최종본 PDF 22~24쪽)를 jihwan 코드·문서와 대조해 `agent/outputs/report_fixes.md` 작성. 보고서 파일 자체는 수정하지 않음
- 항목 12개: A(사실과 다름) 5 — 참여학생 몽흐데르겔 누락, CI/CD(CI만 있음), "기존 시스템은 단순 기록 중심"(국내 AI 발주 사례 존재), 결과물 3 범위 제외, 모델 표현과 계획서 대비 변경 이유 / B(빈칸·근거) 5 — 정확도 ±[ ]%, 폐기율 [ ]%, 더미 데이터 엔진, 개선방안 ±10%, 발주 연계 자동화 / C(표현) 2 — 특허의 상권 데이터, 본사 모니터링 성과
- 완료 기준 확인: 12개 항목 모두 쪽·원문·수정안(또는 제안)·근거 포함. 수치는 PROJECT_STATUS 11절(일 단위 9.2%/0.902, 발주 시뮬레이션), 12절(모델 비교), 13절(주간 4.7%, ±10% 이내 87.2%), 15절·HANDOFF 5절에서만 가져오고 측정 조건을 함께 적음
- 새로 발견: 결과보고서 참여학생명에 몽흐데르겔 누락 (보고서 수정 항목 A-1로 처리, 별도 이슈 없음)
- 다음: STEP 3 (CI 재현)

## 2026-10-30 | v3 STEP 3 CI 재현 | DONE
- 수행: `.github/workflows/ci.yml`의 세 작업을 이 PC에서 같은 명령으로 실행
- 확인한 명령과 결과:
  - ai-service `python -m pytest tests`: 33 passed, 경고 2 (holidays 0.59 미래 호환성 안내, starlette `python_multipart` import 안내 — 동작 영향 없음)
  - backend `gradlew test --tests 'com.foodguard.service.*' --tests 'com.foodguard.security.*' --rerun-tasks` (JDK 17.0.12): BUILD SUCCESSFUL, 12개 실행, 실패 0
  - frontend `npm ci --legacy-peer-deps`(앞서 실행) + `npx tsc --noEmit`: 오류 0
- 환경 차이: 이 PC Python 3.13.9·Node 18.18.0, CI는 Python 3.11·Node 20 → I-18에 반영. 결과는 같음
- 사람 확인 요청 (I-28): GitHub 저장소 Actions 탭에서 jihwan 브랜치 최근 실행이 초록불인지 확인. 이 PC에는 `gh`가 없고, 인계 문서에 따르면 공개 API로는 조회되지 않음
- 바꾼 파일: 없음
- 새 이슈: 없음
- 다음: STEP 4 (브랜치 정리안)

## 2026-10-30 | v3 STEP 4 브랜치 정리안 | DONE (범위 확장)
- 범위 확장: `feat/security-agent`가 `junho` 브랜치에 전부 포함되어 있고, junho에 10/30 커밋 5개(PREDICTION_LOG·정확도 API, TiDB 연결 수정, 로드맵 등)가 더 있어 비교 대상을 junho 전체(22커밋)로 넓힘
- 수행: `agent/outputs/branch_merge_plan.md` 작성 — 브랜치 지형, 방향 차이 5가지(스키마 정책, 비밀 값, LLM 사용, POS, 판매 시 재고 차감), junho 커밋 22개 판정, jhy 처리, 권장 순서, 충돌 파일 전체 목록(부록)
- 확인한 명령과 결과:
  - `git merge-base --is-ancestor origin/feat/security-agent origin/junho`: 포함
  - `git merge-base --is-ancestor origin/junho origin/dev`: 미포함, `rev-list --left-right --count`: +22 / −26
  - `git cherry -v origin/jihwan origin/feat/security-agent`: 17개 모두 `+`(같은 패치 없음)
  - `git merge-tree --write-tree --name-only`: jihwan←junho 38개, jihwan←jhy 16개 파일 충돌
  - jihwan 대조: UnitConverter 0개, Hikari 설정 없음, `pool_recycle=3600`, PREDICTION_LOG 없음, CORS 5173만, api.ts 타임아웃 없음, 조회 후 `db.rollback()` 있음
  - `hyeon`, `HYEON` = jihwan과 같은 커밋 `2b93a76`
- 발견: junho 최신 `application.properties`에 평문 DB 비밀번호(10/16 이전 노출 값과 해시 동일)·JWT 키 → I-34. 값은 기록하지 않음
- 새 이슈: I-34, I-35, I-36, I-37. I-07(junho에 해결책 있음)·I-31(junho로 갱신) 수정
- 바꾼 파일: 없음 (agent/outputs 문서만). 병합·체리픽 하지 않음
- 다음: STEP 5 (배포 전 설정 변경안)

## 2026-10-30 | v3 STEP 5 배포 전 설정 변경안 | DONE
- 수행: `agent/outputs/deploy_checklist.md` 작성. 코드 변경 없음
- 내용: 필수 3(AI 서비스 외부 차단·공유 키, 운영 프로필 validate·SQL 로그·CORS, 비밀 값 교체·TiDB IP 제한), 권장 4(TiDB 유휴 연결, 예측 비동기화 3단계, 공용 식자재 권한, 오류 메시지 노출), 선택 2(배포 구성 EC2+Nginx+HTTPS, 배송 토큰 만료), 배포 직전 확인표 7개
- 근거로 확인한 현재 설정: `application.properties:16-18,23`, `CorsConfig.java:13-16`, `WebSocketConfig.java:22`, `SecurityConfig.java:35-46`, `AppConfig.java:20-21`, `GlobalExceptionHandler.java:17,22,27`, `ai-service/main.py:18-21,41`, `ai-service/database.py:10-11`, `PredictionService.java:31-34`, `DeliveryController.java:32,50`, `frontend/vite.config.ts:14-21`
- 완료 기준 확인: 모든 항목에 현재 설정(파일:라인)·변경안·영향(필수·권장 항목)·검증 방법 포함
- 새 이슈: 없음. I-26·I-27·I-29·I-30·I-36에 변경안 위치 표시
- 다음: STEP 6 (DB 기준 수치 재현) — DB 접속 정보가 없으면 BLOCKED

## 2026-10-30 | v3 STEP 6 DB 기준 수치 재현 | BLOCKED
- 이유: 사용자가 DB 값을 넣었다고 했으나 파일에 저장되지 않음. `backend/.env` `DB_PASSWORD` 비어 있음(파일 수정 14:14 = 에이전트가 생성한 시각), `ai-service/.env` `DB_URL`이 예시 값(`root:password@localhost`), 마지막 수정 10-16
- 확인: 사용자 폴더(바탕화면·문서·다운로드·IdeaProjects·홈, 깊이 4)에서 오늘 수정된 `.env*`는 위 파일과 예시 파일뿐
- 재개 조건: 두 파일에 값 저장 후 STEP 6부터 다시

## 2026-10-30 | v3 STEP 7 백엔드 기동·화면 점검 | BLOCKED
- 이유: STEP 6과 같음(DB 접속 정보 없음, I-12). 사용자 지시로 STEP 8로 마무리
- 확인: VS Code로 연 뒤 `ai-service/.env`는 14:30 저장되었으나 `DB_URL`은 예시 값 그대로, `backend/.env` `DB_PASSWORD`는 비어 있음 → TiDB 비밀번호 미보유로 판단

## 2026-10-30 | v3 STEP 8 종합 보고 | DONE
- 수행: `agent/outputs/summary.md` 작성 — 단계별 결과, 바뀐 파일, 해결·남은 문제(심각도순), 사람이 결정할 것 7가지, 재개 방법
- 확인: `git status`의 변경(`ai-service/main.py`, `uml/` 2개, `agent/`)과 요약 일치. 커밋하지 않음
- 최종 상태: STEP 6·7 BLOCKED(DB 대기), 나머지 완료. 재개 시 STEP 6부터
