# FoodGuard 에이전트 지령서 v3 (jihwan 브랜치 기준)

## 현재 상태
- 현재 단계: STEP 6 (STEP 6·7 BLOCKED, 나머지 완료 · 2026-10-30)
- 상태: BLOCKED        <!-- TODO | IN_PROGRESS | DONE | BLOCKED -->

## 목표
`jihwan` 브랜치(김지환 인계본)를 기준으로, 인계 문서의 남은 작업과 열린 문제를 처리해 **결과보고서에 근거 있는 수치를 쓰고 배포 전 위험을 줄인다.** DB 없이 할 수 있는 작업부터 처리하고, 발견한 문제는 `agent/ISSUES.md`에 쌓는다.

먼저 읽을 것: `CLAUDE.md`, `docs/HANDOFF.md`(인계 문서), `ai-service/PROJECT_STATUS.md` 10~15절, `agent/ISSUES.md`, `agent/LOG.md` 마지막 기록.
이전 지령서(jhy 기준)는 `archive/v2_jhy/`에 있다. 그쪽 코드 작업은 jihwan과 중복이라 다시 하지 않는다.

## 실행 규칙 (매 실행마다)
1. 위 "먼저 읽을 것"을 읽고 "현재 단계" 하나만 수행한다. 시작할 때 상태를 IN_PROGRESS로 바꾼다.
2. 완료 기준을 실제 명령 결과로 모두 확인한 뒤에만 다음 단계로 넘기고 상태를 TODO로 되돌린다.
3. 끝나면 `LOG.md` 맨 아래에 날짜, 단계, 결과, 바꾼 파일, 확인한 명령과 결과, 새 이슈 ID를 적는다.
4. 범위 밖 문제는 고치지 말고 `ISSUES.md`에 등록만 한다.
5. 막히면 상태를 BLOCKED로 바꾸고 이유를 LOG·ISSUES에 적은 뒤 멈춘다.
6. 모든 주장에 근거(`파일경로:라인` 또는 실행한 명령)를 붙인다.
7. CLAUDE.md 원칙과 인계 문서 4절 작업 규칙을 따른다.

## 실행 환경 메모 (이 PC)
- 브랜치 `jihwan` (origin/jihwan 추적). jhy 문서 변경은 `git stash` 목록 맨 위 "jhy 미커밋: CLAUDE.md·uml 문서 수정"에 보관
- 백엔드: PowerShell `$env:JAVA_HOME="C:\Program Files\Java\jdk-17"` 후 `backend\gradlew.bat test --tests "com.foodguard.service.*" --tests "com.foodguard.security.*"` (전체 `test` 금지: contextLoads가 공유 TiDB에 접속, I-16)
- AI: `ai-service\venv\Scripts\python.exe -m pytest tests` (현재 33 passed), 한글 출력은 `PYTHONIOENCODING=utf-8`
- 프론트: `frontend`에서 `npx tsc --noEmit` (현재 0건)
- DB 접속 정보 미입력(I-12). "DB 대기" 단계는 정보가 없으면 BLOCKED

---

## STEP 1. 작은 문서 정합성 (I-02)
- 할 일: `ai-service/main.py` 설명을 실제(XGBoost 글로벌 모델)로 고친다. `uml/architecture.md`, `uml/sequence-prediction.md`를 현재 코드 흐름(AI 서비스가 DB를 직접 읽고 `PREDICTION_RESULT`에 저장, 글로벌 XGBoost, 경로 `/api/predict/store/{id}`, 추가 라우터 explain·events)에 맞춘다. `feat/security-agent`의 `62345a5`(uml 갱신)를 참고하되 jihwan 코드 기준으로 쓴다.
- 완료 기준:
  - [ ] `git grep -n -i "random ?forest" -- ai-service/main.py uml CLAUDE.md` 결과 0건 (PROJECT_STATUS의 전환 이력 제외)
  - [ ] 다이어그램의 엔드포인트·저장 주체가 `ai-service/routers/*.py`, `services/data_service.py`와 일치 (근거 LOG 기록)

## STEP 2. 결과보고서 수정 목록 (DB 불필요)
- 할 일: 결과보고서(`26학년도 캡스톤 디자인-컴퓨터공학과-1조 (최종본).pdf` 22~24쪽)의 문장 중 사실과 다르거나 근거가 필요한 것을 찾아, **고칠 문장과 바꿀 문장 초안, 근거 수치·출처**를 `agent/outputs/report_fixes.md`에 쓴다. 최소 포함: 정확도 ±[ ]%, 폐기율 [ ]% 절감(인계 문서: 품절 증가와 함께), "GitHub Actions 기반 CI/CD 적용"(CI만 있음), "더미 데이터 생성 엔진"(I-11), 시스템 구성도와 모델 변경 이유(M5·Montero-Manso & Hyndman), "기존 시스템은 단순 기록 중심"(국내 AI 발주 사례 존재).
- 완료 기준:
  - [ ] 각 항목에 원문 위치(쪽), 원문, 수정안, 근거(PROJECT_STATUS 절 번호 또는 명령) 4가지가 모두 있음
  - [ ] 수치는 인계 문서 5절·PROJECT_STATUS 11절 값만 사용하고 측정 조건(데이터·기간·베이스라인)을 함께 적음

## STEP 3. CI 재현 (DB 불필요)
- 할 일: `.github/workflows/ci.yml`의 세 작업(pytest, 백엔드 service·security 테스트, tsc)을 이 PC에서 같은 명령으로 실행한다. GitHub Actions 실제 결과는 사람이 Actions 탭에서 확인하도록 LOG에 요청을 남긴다(I-28).
- 완료 기준:
  - [ ] 세 명령의 결과를 LOG에 기록 (실패 시 ISSUES 등록)

## STEP 4. 브랜치 정리안 (DB 불필요, I-31, I-32)
- 할 일: `origin/feat/security-agent`와 `origin/jihwan`을 비교해, security-agent에만 있는 것(발주 참모 에이전트, `fgcli`, 서브에이전트, 단위 규칙 저장 시 강제 `469afad`, TiDB 유휴 연결 대응 `dda675c`, 예측 대상 "내일부터 7일" `935a67f` 등)과 겹치는 것(권한 검사, CI, uml)을 표로 정리하고, jihwan에 옮길 만한 커밋과 버릴 커밋을 제안한다. `jhy` 커밋 처리도 포함한다. 결과: `agent/outputs/branch_merge_plan.md`. **병합·체리픽은 하지 않는다.**
- 완료 기준:
  - [ ] security-agent 커밋 17개 각각에 "jihwan에 이미 있음 / 옮길 만함 / 버림" 판정과 근거
  - [ ] 충돌 예상 파일 목록 (`git merge-tree --write-tree --name-only` 결과)

## STEP 5. 배포 전 설정 변경안 (DB 불필요, 설계만, I-26, I-27, I-29)
- 할 일: AI 서비스 접근 제한(내부망 전용 + 백엔드와 공유 키 헤더 등), 운영 프로필 분리(`ddl-auto=validate`, `show-sql=false`, CORS 운영 도메인), 예측 비동기화 방안을 `agent/outputs/deploy_checklist.md`에 변경안으로 쓴다. 코드는 바꾸지 않는다.
- 완료 기준:
  - [ ] 항목마다 현재 설정(파일:라인), 변경안, 영향, 검증 방법

## STEP 6. (DB 대기) DB 기준 수치 재현
- 할 일: `python backtest.py --db --step 7`(약 5분, 백그라운드), `python simulate_orders.py --db`(약 5분)를 실행해 인계 문서 5절 값과 비교한다. DB 쓰기 없음(읽기 전용).
- 완료 기준:
  - [ ] 글로벌 모델 wMAPE 9.2% / MASE 0.902, 요일 평균 9.9%, 커버리지 55.4%, 시뮬레이션 폐기율 4.7%·품절률 11.0% 재현 여부를 LOG에 기록. 다르면 원인(데이터 변경·패키지 버전) 조사

## STEP 7. (DB 대기 · 사람 확인 필요) 백엔드 기동과 미확인 화면 점검 (I-33)
- 할 일: **bootRun은 공유 TiDB 스키마를 바꿀 수 있으므로 실행 전에 사람에게 확인받는다.** 기동 후 인계 문서 2절의 미확인 항목(P1-3 보관기한 입력과 추천 반영, 본사 통계·주간 매출, 기부 한도, Claude 설명 화면)을 API 호출로 점검한다. 테스트로 만든 행은 끝나면 지운다(삭제도 사람 확인).
- 완료 기준:
  - [ ] 항목별 확인 결과(성공/실패, 응답 근거)를 LOG에 기록

## STEP 8. 종합 보고
- 할 일: `agent/outputs/summary.md`에 단계별 결과, 해결·남은 이슈(심각도순), 사람이 결정할 것을 정리한다.
- 완료 기준:
  - [ ] 세 구분이 모두 있음. 막힌 단계가 있으면 현재 단계를 그 단계로 두고 BLOCKED, 없으면 `ALL`·`DONE`

---

## 금지 사항
- git commit, push, branch 생성·삭제, merge, cherry-pick, stash 적용 금지 (사람이 지시할 때만)
- 공유 TiDB 쓰기·DDL·삭제, 백엔드 bootRun 금지 (STEP 7에서 사람이 확인한 경우만)
- `backend/.env`, `ai-service/.env` 열람·수정·출력 금지. 비밀 값을 로그나 문서에 적지 않음
- 지정 범위 밖 파일 수정 금지 (발견한 문제는 ISSUES에 등록만)
- 이전 산출물 덮어쓰기 금지 (보완은 "추가 확인" 섹션으로)
