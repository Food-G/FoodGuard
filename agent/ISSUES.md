# 문제 목록 v2 (jihwan 브랜치 기준)

기준: `jihwan` 브랜치 `2b93a76` (2026-10-30). 이전 목록(jhy 기준 I-01~I-24)은 `archive/v2_jhy/ISSUES_v1.md`.
새 문제는 맨 아래에 다음 번호로 추가한다.
심각도: 상(서비스·보안·보고서 수치에 직접 영향) / 중(기능 오류·오해 소지) / 하(정리·품질)
상태: 열림 / 진행 / 해결 / 사람 결정 필요

## 이전 목록에서 jihwan이 이미 해결한 것 (닫음)

| 이전 ID | 내용 | jihwan에서 |
|---|---|---|
| I-01 | 프론트 tsc 오류 | 0건 (`865af64`) |
| I-03 | 본사 주간 매출 API 없음 | `all-stores/weekly-summary` 구현 |
| I-04 | 본사 통계 하드코딩 | `/api/stats/hq` 실데이터로 교체 |
| I-05 | 2~7일 예측 lag 버그 | 달력 기준 `weekday_lag`, `lag_1` 제거 |
| I-08 | 실제 폐기 기록 없음 | `WASTE_RECORD` (공유 DB 반영됨) |
| I-09 | 7일 분위수 합산·유통기한 미반영 | 식자재 7일 사용량에 분위수 1회 + 식자재별 발주 기간 |
| I-15 | 판매 시각 없음 → 품절 추정 불가 | 일 단위 휴무·품절 기록 `SALES_DAY_FLAG` (시각은 여전히 없음) |
| I-17 | xgboost 미설치 | 이 PC에 설치 완료 |
| I-23 | 학습 lag가 행 기준 | 영업일 달력 정렬 |
| 보안 | 비밀 값 커밋, 권한 검사 없음, HQ 자가 가입 | `backend/.env`, `security/StoreAccess*`, 권한 점검 19/19 |

## 열린 문제

| ID | 내용 | 근거 | 심각도 | 상태 |
|---|---|---|---|---|
| I-02 | (해결, v3 STEP 1) main.py·uml 모델과 예측 흐름 갱신. 남은 것: `uml/architecture.md` 백엔드 컨트롤러·서비스 목록이 jihwan 신규 기능(stats, waste-records, sales-day-flags, event-notes, explain) 미반영 | `uml/architecture.md:12-13` | 하 | 부분 해결 |
| I-06 | 화면 "신뢰도"가 시간 순서를 무시한 `KFold(5)` 교차검증으로 계산됨. 백테스트는 시간순이지만 화면 값은 그대로 | `ai-service/ml/demand_predictor.py:152` | 중 | 열림 |
| I-07 | 재예측 시 `PREDICTION_RESULT` 미래분을 지우고 다시 씀. 예측 스냅샷 테이블이 없어 운영 중 실제 예측 정확도를 추적할 수 없음(백테스트로만 측정). **junho `73a4fd5`에 PREDICTION_LOG + `/api/accuracy` 구현 있음** (branch_merge_plan 3절) | `ai-service/services/data_service.py:218` | 중 | 사람 결정 필요 (공유 DB) |
| I-11 | 더미 데이터 생성 스크립트가 저장소에 없음. 보고서의 "더미 데이터 생성 엔진" 근거 부족 | `git ls-files \| grep dummy` 0건 | 중 | 사람 결정 필요 |
| I-12 | 이 PC의 DB 접속 정보 미입력: `backend/.env` `DB_PASSWORD`, `ai-service/.env` `DB_URL` | 2026-10-30 확인 | 상 | 사람 결정 필요 |
| I-13 | 의존성 취약점: GitHub Dependabot 131개(10/16), 프론트 `npm ci` 16개(치명 2, 높음 7) | 푸시 메시지, `npm ci` 출력 | 중 | 열림 |
| I-14 | 옛 비밀 값이 공개 저장소 git 이력에 남음. TiDB 비밀번호·JWT 교체 및 TiDB 접속 IP 제한 필요 (기상청 키는 교체 완료) | 인계 문서 2절 | 상 | 사람 결정 필요 |
| I-16 | `gradlew test` 전체 실행 시 `contextLoads`가 공유 TiDB에 접속·스키마 변경 가능. CI는 제외하고 돌림 | 인계 문서 5절 | 하 | 열림 |
| I-18 | 이 PC 환경이 CI와 다름: Python 3.13.9(CI 3.11), Node 18.18.0(CI 20). CI 세 작업과 합성 백테스트 수치는 동일하게 재현됨 | `backtest.py --synthetic` 14.8% / 0.817 | 하 | 열림 |
| I-19 | 본사 발주 화면에 기사 수령 수동 처리 버튼 없음 (jihwan도 처리 함수 제거) | `AdminOrders.tsx` | 하 | 사람 결정 필요 |
| I-21 | `salesService.getTodaySummary`·`getWeeklySummary`가 호출처 없음, 대응 API 없음 | `frontend/src/services/salesService.ts:17,20` | 하 | 사람 결정 필요 |
| I-24 | 모델이 요일 평균을 근소하게만 앞섬: DB 9.2% vs 9.9%, 합성 14.8% vs 15.1%, 합성 주간 합계는 5.4% vs 5.1%로 오히려 뒤짐. 보고서에 "AI가 더 정확"이라고 쓸 때 차이 크기와 조건을 함께 적어야 함 | 인계 문서 5절, `backtest.py --synthetic` | 상 | 열림 |
| I-25 | 발주 시뮬레이션: 짧은 발주 주기에서는 관행 규칙(×1.2)이 비용상 나음. 목표 분위수 0.6이 재고 이월을 고려하지 않음. 원가 가정 결정 필요 | PROJECT_STATUS 11절 | 상 | 사람 결정 필요 |
| I-26 | AI 서비스(8000)에 인증 없음, CORS `*` | `ai-service/main.py:18` | 상 | 열림 (배포 전 필수) · 변경안: deploy_checklist.md |
| I-27 | 운영 설정 미분리: `ddl-auto=update`, `show-sql=true`, CORS 개발 주소 | `backend/src/main/resources/application.properties` | 중 | 열림 (배포 전) · 변경안: deploy_checklist.md |
| I-28 | 배포 구성(EC2·Docker·HTTPS) 없음. 계획서의 "CI/CD 자동 배포"는 CI만 있음. GitHub Actions 실제 통과 여부 미확인 | 인계 문서 2절 | 중 | 사람 결정 필요 |
| I-29 | 예측 1회 약 25초(백엔드 동기 호출, 타임아웃 60초) | 인계 문서 2절 | 중 | 열림 · 변경안: deploy_checklist.md |
| I-30 | 공용 식자재(`store_id` 없음)를 아무 점주나 수정 가능 | 인계 문서 2절 | 중 | 사람 결정 필요 · 변경안: deploy_checklist.md |
| I-31 | `junho`(서준호, 22커밋, 5/22 분기, dev 미병합; `feat/security-agent` 포함)와 jihwan이 별도 진행. 합치면 38개 파일 충돌. 판정·순서는 `outputs/branch_merge_plan.md` | `git merge-tree origin/jihwan origin/junho` | 상 | 사람 결정 필요 |
| I-32 | `jhy` 브랜치 코드 커밋 2개(`5d60e6f`, `6ed2e43`)는 jihwan과 중복, 합치면 16개 파일 충돌. dev에 병합하지 않음 | `git merge-tree origin/jihwan jhy` | 중 | 사람 결정 필요 (브랜치 정리) |
| I-33 | 실제 DB 확인 미완료: P1-3(보관기한·리드타임·주기) 화면·추천 반영, 본사 통계 JPQL `YEAR()/MONTH()`, 기부 등록 한도 화면, Claude 설명 화면(데모 DB 추천 0건), 특이사항 피처 실데이터 효과 | 인계 문서 2절, PROJECT_STATUS 11·14·15절 | 중 | 열림 (DB 대기) |
| I-34 | `junho` 브랜치 최신 `application.properties`에 DB 비밀번호·JWT 키가 평문으로 남아 있음 (DB 비밀번호는 10/16 이전 노출 값과 같음, 해시로 확인) | `git show origin/junho:backend/src/main/resources/application.properties` | 상 | 사람 결정 필요 (I-14 교체로 무력화, 브랜치에서 제거) |
| I-35 | 스키마 변경 정책이 브랜치마다 다름: jihwan `ddl-auto=update`(기동 시 공유 TiDB 자동 변경), junho `ddl-auto=none` + `migrations/*.sql` 수동 실행 | 두 브랜치 `application.properties` | 상 | 사람 결정 필요 |
| I-36 | jihwan에 TiDB 유휴 연결 대응 없음: 백엔드 Hikari keepalive 미설정, AI `pool_recycle=3600`. junho `dda675c`는 실제 500·Lost connection 장애를 겪고 3분/180초로 수정 | jihwan `application.properties`, `ai-service/database.py:11` | 중 | 열림 · 변경안: deploy_checklist.md |
| I-37 | jihwan에 단위 규칙 강제 없음(식자재·레시피 저장 시 kg·L·개 호환 검사). junho `469afad`의 UnitConverter 참고 | jihwan `IngredientService.java:28-52` | 중 | 열림 |
| I-38 | 발주 참모(fgagent)가 만든 발주가 `POST /api/orders`로 들어가 jihwan 추천 적용률 집계에서 점주 수동 발주(MANUAL)로 분류됨. 에이전트 발주를 구분하려면 백엔드에 출처(예: AGENT) 지정 필요 | `fgagent/executor.py:50-52`, jihwan `ORDER_REQUEST.order_source` | 중 | 열림 |
| I-39 | `agent-assets/` 01~06 문서는 junho 백엔드 기준. README 차이표와 04 §1 발주 산식만 jihwan 기준으로 고침. 나머지(도메인 모델, API 목록, 모델 카드, 데이터 현황, 판매 시 재고 차감 등) 전면 갱신 필요 | `agent-assets/README.md` 머리말 | 하 | 열림 |
| I-40 | 발주 참모 실제 연동(로그인 → 관찰 → 발주안 → Claude 검토 → 승인 → 발주) 미검증. DB 접속 정보와 에이전트 계정(`FOODGUARD_OWNER_EMAIL/PASSWORD`, `ai-service/.env`) 필요 | I-12 | 중 | 열림 (DB 대기) |

## 2026-11-06 처리 (`ai-service/PROJECT_STATUS.md` 17절)

- 해결: I-06(신뢰도 시간순), I-26(AI 내부 키·CORS), I-27(prod 프로필), I-36(유휴 연결)
- 부분 해결: I-25(이월 안전재고. 원가 가정은 여전히 사람 결정), I-29(학습 약 25초 → 약 20초, 비동기는 안 함), I-07(운영 정확도를 `PREDICTION_RESULT` 로 집계. 재예측 스냅샷은 아직 없음)
- 새 문제 I-41: prod `validate` 불가. 공유 DB 의 `STORE`·`USER` 대문자 때문. 소문자 변경은 공유 DB DDL 이라 사람 결정 필요
