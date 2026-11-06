# FoodGuard 인계 문서 — 다른 PC·새 세션에서 이어서 하기

> 작성 2026-10-28 · 기준 브랜치 `jihwan` (origin: `Food-G/Test-Repository`)
> Claude Code 는 이전 대화·세션 기록·로컬 메모리를 보지 못한다. 이어서 할 때 필요한 맥락은 이 문서,
> `CLAUDE.md`(자동 로드), `ai-service/PROJECT_STATUS.md`(근거·수치 상세) 세 곳에 둔다.
> 새 세션 시작 프롬프트 예: **"CLAUDE.md 와 docs/HANDOFF.md 를 읽고 남은 작업 1번부터 진행해줘"**

## 1. 지금까지 한 것

작업 기준은 「FoodGuard 계획서 대비 진척 분석 및 논문 기반 고도화 방향」 문서(로컬 docx/pdf, 저장소에는 없음)의 로드맵이다.
로드맵 일정은 P0 10/19–11/1, P1 11/2–11/22, P2 11/23–12/19 이며 현재 P1 까지 끝났다.

| 커밋 | 내용 | 상세 |
|---|---|---|
| `56a6529` | P0: 백엔드 비밀값 `.env` 분리, 휴무·품절 기록(`SALES_DAY_FLAG`), 폐기 기록(`WASTE_RECORD`), 발주 추천 로그(`ORDER_REQUEST.recommended_qty·order_source`) | PROJECT_STATUS 10절 |
| `08479ab` | P0+P1 (AI): 판매 이력 영업일 달력 정렬, lag 달력 기준·`lag_1` 제거, 백테스트, 매장·메뉴 글로벌 모델 | 10절 P1 |
| `5148f74` | P1-2: 식자재 단위 conformal 안전재고 (`ml/calibration.py`) | 10절 P1-2 |
| `c8496e8` | P1-3: 보관기한·리드타임·발주 주기를 반영한 식자재별 발주 기간 | 10절 P1-3 |
| `865af64` | GitHub Actions CI (pytest · compileJava · tsc) | `.github/workflows/ci.yml` |
| (2026-10-29) | 모델 비교 실험(Prophet·LSTM, `backtest.py --compare`), 기부 수량 검사·폐기 예측 반영, 프로필 API 복구, 본사 발주 관리·가게 등록 메뉴 연결 | PROJECT_STATUS 12절 |
| (2026-10-29) | 부분 입력일 제외, 발주 시뮬레이션(`simulate_orders.py`), 본사 통계 실데이터(`/api/stats/hq`), 주간 매출 API 복구, CI 백엔드 단위 테스트 | PROJECT_STATUS 11절 |

**공유 TiDB 반영 상태** (백엔드 `ddl-auto=update` 가 엔티티대로 바꾼다)
- 반영됨: `SALES_DAY_FLAG`, `WASTE_RECORD`(예전 테이블이 남아 있어 수량 컬럼명이 `waste_qty`), `ORDER_REQUEST.recommended_qty·order_source`
- 반영됨 (2026-10-29 bootRun): `INGREDIENT.shelf_life_days·lead_time_days·order_cycle_days`. 값은 아직 비어 있다

## 2. 남은 작업 (권장 순서)

1. **P1-3 실제 확인**: 백엔드를 띄우면 `INGREDIENT`에 컬럼 3개가 추가된다(공유 DB라 팀에 알리고 실행). 식자재 관리 화면 수정 행에서 보관기한·입고·주기를 넣고 저장되는지, `GET /api/orders/recommend/{storeId}` 결과가 기간만큼 줄어드는지 확인한다. 테스트로 바꾼 값은 되돌린다
   - 같이 확인: 본사 통계 페이지(`/api/stats/hq`)와 대시보드 주간 매출이 뜨는지 (11절, 백엔드를 띄워야 확인 가능)
   - 같이 확인 (12절): 기부 등록 수량 제한·폐기 예측 반영, 프로필 이름·비밀번호 변경, 본사 "발주 관리" 메뉴, 점주 "가게 등록" 화면
   - 2026-10-29 bootRun 으로 확인함 (PROJECT_STATUS 12절). 기부 등록 한도는 유통기한 있는 재고가 없어 화면에서 못 봤고 단위 테스트로만 확인
   - 이 PC 의 `backend/.env` 는 2026-10-29 새로 만들었고 JWT 시크릿을 새로 생성했다. DB 비밀번호를 바꿨다면 다른 PC 의 `backend/.env`·`ai-service/.env` 도 갱신해야 한다
2. ~~발주 시뮬레이션~~ 완료 (11절). **결론을 바꿀 결정이 남아 있다**: 짧은 발주 주기에서는 여유를 둔 관행 규칙이 비용상 낫다. 목표 분위수 0.6(`COST_RATIO`)이 재고 이월을 고려하지 않기 때문. 팀에서 원가 가정을 정하면 `simulate_orders.py --db` 로 다시 비교
3. ~~데이터 품질(부분 입력일)~~ 완료 (11절)
4. **결과보고서 정합성** (분석 문서 체크리스트)
   - ~~본사 통계 페이지 하드코딩~~ 완료 (11절)
   - 폐기율 절감 문장: 11절 "해석"을 따를 것. 폐기량만 떼어 "52% 절감"이라 쓰면 품절 증가를 숨기는 것이다
   - 시스템 구성도: AWS EC2·MySQL·LSTM·Prophet → TiDB Cloud·FastAPI·XGBoost 글로벌 모델로, 바꾼 이유(데이터량 대비 모델 복잡도, M5·Montero-Manso & Hyndman) 한 문단
   - "요일별 더미 데이터 생성 엔진": 저장소에 스크립트가 없다. 커밋하거나, 성능 수치가 데모 데이터에서 나왔다고 명시
   - "GitHub Actions CI/CD 적용": 워크플로는 생겼다. GitHub 에서 실제로 초록불인지 확인 (배포 단계는 없음). 2026-10-29 에 공개 API 로 보려 했더니 Not Found — 저장소가 비공개로 바뀐 것으로 보인다. 로그인한 사람이 Actions 탭에서 확인
   - 보고서 수치는 PROJECT_STATUS 11절 표(최신 평가셋)를 쓰고 측정 조건(데이터·기간·베이스라인)을 함께 적는다
5. **추천 적용률·점주 수정 분석 (P2)**: 집계는 `/api/stats/hq` 와 본사 통계 화면에 넣었다 (11절). 남은 것은 실제 발주 기록이 쌓인 뒤 수정의 손익 분석 (Fildes et al. 2009, Kesavan & Kushwaha 2020)
6. ~~CI 백엔드 단위 테스트~~ 완료: `gradlew test --tests 'com.foodguard.service.*'` (contextLoads 제외)

**직접(사람이) 해야 할 일**: TiDB 비밀번호·JWT 시크릿 교체 (예전 값이 공개 저장소 git 히스토리에 있음), TiDB 접속 허용 IP 를 팀원 IP 로 제한

**보류 (이유가 있으므로 다시 논의할 때만)**
- 저판매 메뉴 Croston 분기: 현재 데이터에 판매 0 비율 20% 초과·하루 평균 3개 미만 메뉴가 없어 효과를 검증할 수 없음
- 메뉴별 원가 critical fractile: 원가 데이터가 없어 지금 만들면 공통값 `COST_RATIO=0.4` 와 결과가 같음
- LSTM·Prophet: 데이터 규모상 이득이 작다는 것이 M5·Montero-Manso & Hyndman 결론. 넣는다면 베이스라인으로만
- 상권 데이터: 행정동·분기 단위라 일 단위 메뉴 예측 기여가 작음

### 배포 전 남은 것 (2026-10-30 점검, PROJECT_STATUS 13절)

- 완료: 권한 검사(본사 전용 경로, 매장 소유 검사, 회원가입 HQ 차단), 주간 ±10% 지표. 매출 계획 기능은 만들었다가 팀 판단으로 뺐다 (빈 `SALES_TARGET` 테이블만 공유 DB 에 남음)
- 2026-10-30 bootRun 으로 확인: 권한 점검 19/19 (점주→다른 매장 403, 본사 전용 403/200, HQ 회원가입 400). 본사·점주 화면 전체를 실제 계정으로 눌러 보는 확인은 아직
- AI 서비스(8000): 127.0.0.1 바인딩·CORS 제거·내부 키 완료 (2026-11-06, PROJECT_STATUS 17절). 운영에서는 양쪽 `.env` 에 같은 키(`INTERNAL_API_KEY`, `AI_INTERNAL_KEY`)를 넣는다
- 운영 설정: `SPRING_PROFILES_ACTIVE=prod` (`application-prod.properties`, `APP_CORS_ALLOWED_ORIGINS` 필요). `ddl-auto=none`. `validate` 는 공유 DB 의 대문자 `STORE`·`USER` 때문에 실패한다 (17절)
- 배포 구성(EC2·Docker·HTTPS)이 없다. 계획서의 "CI/CD 자동 배포"는 CI 만 있음
- 예측 요청 한 번에 약 25초(백엔드 동기 호출, 타임아웃 60초). 매장이 늘면 비동기·캐시 필요
- 공용 식자재(`store_id` 없음)는 아무 점주나 수정 가능 — 본사 전용으로 할지 결정

### 운영 에이전트 6종 (2026-11-06, PROJECT_STATUS 18절)

- POS 파일·거래명세서 입력, 식자재 설정 제안, 발주 참모 화면, 재고·데이터 감시, 본사 주간 리포트, 점주 질문 답변
- 스키마 변경 없음. AI 서비스에 `openpyxl` 추가 (`pip install -r requirements.txt`)
- **남은 확인: 저장 경로(`/ingest/*/commit`, `/orders/agent`)를 시험 매장에서 실제로 한 번 실행.** 공유 DB 쓰기라 단위 테스트만 했다
- 이월 안전재고를 켜려면 식자재 관리의 AI 설정 제안에서 확인·저장한다

### 2026-11-06 고도화 (PROJECT_STATUS 17절)

- 이월 안전재고: 보관기한 > 발주 주기인 식자재만 필요량 ≥ 점추정 × 1.2. 시뮬레이션 5개 시나리오 중 4개에서 비용 최저 (2일 주기만 관행 ×1.2 가 낫다). **`INGREDIENT` 설정값이 비어 있어 지금은 발주량이 바뀌지 않는다. 팀이 식자재별 보관기한·주기를 넣어야 효과가 난다**
- 신뢰도: K-fold → 매장별 최근 28영업일 시간순 평가
- 날씨 기여도 측정: 상한으로도 0.01%p. 보고서에 날씨 튜닝을 성과로 쓰지 말 것
- 본사 통계에 운영 예측 정확도 추가: 현재 모델의 지난 날짜 예측이 아직 0건이라 값은 비어 있다
- 남은 결정: 공유 DB `STORE`·`USER` 소문자 변경(`validate` 사용), junho 의 PREDICTION_LOG(공유 DB 에 `prediction_log` 테이블은 이미 있음), 원가 가정

### 발주 근거 설명 (claude CLI, 2026-10-30, PROJECT_STATUS 14절)

- AI 서비스가 `claude -p` 를 부른다. 그 PC 에 Claude Code CLI 설치·로그인이 필요하고, Windows 는 `ai-service/.env` 에 `CLAUDE_CLI=...\claude.exe` 를 둔다
- 수요 예측(XGBoost)에는 에이전트를 붙이지 않기로 했다. LLM 은 설명만
- 남은 확인: 추천이 실제로 있는 매장 상태에서 화면 확인 (지금 데모 DB 는 추천 0건)

### 점주 특이사항 → XGBoost 피처 (2026-10-30, PROJECT_STATUS 15절)

- 합성 실험(`backtest.py --events`)으로만 검증됨: 특이사항 날 wMAPE 38.1% → 17.8%
- 남은 확인: 실제 특이사항이 매장당 10일 안팎 쌓이면 DB 백테스트에 events 를 넣어 실데이터 효과 측정

## 3. 이미 내린 결정 (바꾸려면 근거와 백테스트 필요)

- 모델: 메뉴별 로컬 모델이 아니라 전체 매장×메뉴 **글로벌 XGBoost 1개**, L1 손실, scale = 메뉴 규모 × 매장 요일 비율
- lag 는 달력 기준 같은 요일(`weekday_lag`), `lag_1` 은 쓰지 않음 (7일 앞을 한 모델로 예측)
- 판매 이력: 매장에 판매가 1건이라도 있는 날 = 영업일. 영업일에 메뉴 판매가 없으면 0, 매장 전체 판매가 없는 날은 행 제외. 매장 전체 판매가 직전 28영업일 중앙값의 40% 미만인 부분 입력일도 행 제외
- 책임 기간별(k일) conformal 보정은 실험했으나 효과가 없어 넣지 않음 (PROJECT_STATUS 11절)
- 안전재고: 메뉴·일자 분위수를 더하지 않고 **식자재 7일 사용량 기준으로 0.6 분위수를 한 번만** (`safety_factor`, 전 매장·식자재 공통, 최근 4주 재학습)
- 백테스트에는 날씨를 넣지 않음 (과거 실측 날씨를 예보 대신 쓰면 성능이 부풀려짐)
- 발주 기간: 식자재마다 `리드타임 − 1 + min(발주 주기, 보관기한)`일, 값이 비면 7일치 (기존과 같음)

## 4. 작업 규칙 (이 프로젝트에서 지켜 온 것)

- **공유 TiDB 주의**: 백엔드 bootRun 은 엔티티 변경을 공유 DB 스키마에 바로 반영한다. 엔티티를 바꾼 뒤 실행하기 전, 그리고 DB 에 직접 쓰기·삭제·DDL 을 하기 전에는 사람에게 확인받는다. API 점검으로 만든 테스트 행은 끝나면 지운다
- **모델·피처·안전재고를 바꾸면** `ai-service` 에서 `python backtest.py --db --step 7`(약 5분, 백그라운드 권장)로 전후를 비교하고, 베이스라인 대비 수치와 한계를 PROJECT_STATUS 10절에 적는다
- **버그는 재현 테스트부터**: ai-service 는 pytest(`tests/`), 백엔드는 DB 없는 Mockito 단위 테스트(`backend/src/test/.../OrderRequestServiceRecommendTest.java` 참고)
- 커밋·push 는 요청받았을 때만. `.env`, 분석 docx/pdf, `.idea/`·`.claude/settings.local.json` 은 커밋하지 않는다
- 문서는 코드 기준으로 맞춘다. 모델 설명이 바뀌면 `CLAUDE.md` 와 PROJECT_STATUS 를 같이 고친다

## 5. 기준 수치 — 새 환경이 같은 결과를 내는지 확인

시드가 고정돼 있어 같은 데이터·같은 패키지 버전이면 아래 숫자가 그대로 나와야 한다. 다르면 패키지 버전이나 공유 DB 데이터가 바뀐 것이다.

| 확인 | 명령 (위치) | 기대값 |
|---|---|---|
| AI 단위 테스트 | `python -m pytest tests` (ai-service) | 53 passed |
| 백엔드 단위 테스트 | `gradlew.bat test --tests "com.foodguard.service.*" --tests "com.foodguard.security.*"` (backend) | BUILD SUCCESSFUL (24개) |
| 프론트 타입체크 | `npx tsc --noEmit` (frontend) | 오류 0 |
| DB 백테스트 | `python backtest.py --db --step 7` (ai-service) | 1,765 평가일, 글로벌 모델 wMAPE **9.2%** / MASE **0.900**, 요일 평균(4주) 9.9% / 0.952, 식자재 7일 커버리지 **56.2%** (평균 잉여율 4.4%, 부족률 3.0%) |
| 합성 백테스트 | `python backtest.py --synthetic` (ai-service) | 글로벌 모델 14.8% / 0.817 |
| DB 모델 비교 | `python backtest.py --db --step 7 --compare` (ai-service, 약 15분, requirements-experiment.txt) | XGBoost 9.2% / 0.902, Prophet 9.7% / 0.965, LSTM 12.6% / 1.490 |
| DB 발주 시뮬레이션 | `python simulate_orders.py --db` (ai-service, 약 5분) | 주 1회 FoodGuard 폐기율 4.7% / 품절률 11.0% / 비용 21.2, 3일·보관 4일 비용 8.9 |
| 날씨 기여도 | `python backtest.py --db --weather --step 7` (ai-service) | 날씨 없음 9.16%, 실측 날씨 9.15% |

출력에 한글이 깨지면 `PYTHONIOENCODING=utf-8` 을 설정한다.

백엔드 전체 `gradlew test` 는 `contextLoads` 가 실제 TiDB 에 접속하고 스키마를 바꿀 수 있으니 돌리지 않는다.

## 6. 새 PC 설정 (Windows 기준, 이 PC: Python 3.11.0 · JDK 17.0.12 · Node 20)

1. `git clone https://github.com/Food-G/Test-Repository.git` → `git checkout jihwan`
2. 비밀값 파일 두 개는 git 에 없다. USB·비밀번호 관리자 등 안전한 경로로 옮기거나 새로 만든다 (메신저·채팅으로 보내지 않기). 형식은 각 `.env.example`
   - `backend/.env`: `DB_PASSWORD`, `JWT_SECRET`
   - `ai-service/.env`: `DB_URL`, `DB_SSL`, `KMA_API_KEY`
3. AI 서비스: `ai-service` 에서 `python -m venv venv` → `venv\Scripts\pip install -r requirements-dev.txt` (버전 고정. `start.bat` 은 venv 생성 + `requirements.txt` 설치 + 실행)
4. 백엔드: JDK 17, `backend\gradlew.bat bootRun` (작업 디렉터리가 `backend` 여야 `.env` 를 읽는다)
5. 프론트: `frontend` 에서 `npm ci --legacy-peer-deps` (그냥 `npm ci` 는 MUI 버전 peer 충돌로 실패) → `npm run dev`
6. 5절 기준 수치를 확인한 뒤 작업을 시작한다
