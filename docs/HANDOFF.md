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

**공유 TiDB 반영 상태** (백엔드 `ddl-auto=update` 가 엔티티대로 바꾼다)
- 반영됨: `SALES_DAY_FLAG`, `WASTE_RECORD`(예전 테이블이 남아 있어 수량 컬럼명이 `waste_qty`), `ORDER_REQUEST.recommended_qty·order_source`
- **아직 안 됨**: `INGREDIENT.shelf_life_days·lead_time_days·order_cycle_days` — 다음에 누가 새 코드로 bootRun 하면 추가된다

## 2. 남은 작업 (권장 순서)

1. **P1-3 실제 확인**: 백엔드를 띄우면 `INGREDIENT`에 컬럼 3개가 추가된다(공유 DB라 팀에 알리고 실행). 식자재 관리 화면 수정 행에서 보관기한·입고·주기를 넣고 저장되는지, `GET /api/orders/recommend/{storeId}` 결과가 기간만큼 줄어드는지 확인한다. 테스트로 바꾼 값은 되돌린다
2. **발주 시뮬레이션 (P2)**: 같은 수요 이력을 "지난주 판매량 × 여유율" 같은 관행 규칙과 FoodGuard 발주에 각각 흘려 폐기량·품절량(비용)을 비교한다 (Huber et al. 2019 의 평가 설계). 계획서의 "폐기율 15~20% 절감"을 보일 유일한 근거다. 보관기한·리드타임 규칙을 반영하고, 백테스트처럼 스크립트 한 번으로 재현되게 만든다
3. **데이터 품질**: 매장 전체 판매량이 평소의 40% 미만인 부분 입력일(예: 60005 의 06-05, 13개)이 7일차 오차를 키운다. 휴무처럼 학습·평가에서 빼는 방법이 필요하다 (PROJECT_STATUS 10절 "7일차 오차 튐")
4. **결과보고서 정합성** (분석 문서 체크리스트)
   - 본사 통계 페이지 `frontend/src/pages/admin/Stats.tsx` 의 하드코딩 값("폐기율 12.5% 감소·소나무 124그루") → 실데이터(`WASTE_RECORD`)로 바꾸거나 "예시 화면" 표시
   - 시스템 구성도: AWS EC2·MySQL·LSTM·Prophet → TiDB Cloud·FastAPI·XGBoost 글로벌 모델로, 바꾼 이유(데이터량 대비 모델 복잡도, M5·Montero-Manso & Hyndman) 한 문단
   - "요일별 더미 데이터 생성 엔진": 저장소에 스크립트가 없다. 커밋하거나, 성능 수치가 데모 데이터에서 나왔다고 명시
   - "GitHub Actions CI/CD 적용": 워크플로는 생겼다. GitHub 에서 실제로 초록불인지 확인 (배포 단계는 없음)
   - 보고서 수치는 PROJECT_STATUS 10절 표를 쓰고 측정 조건(데이터·기간·베이스라인)을 함께 적는다
5. **추천 적용률·점주 수정 분석 (P2)**: `ORDER_REQUEST.recommended_qty·order_source` 로 자동 발주 유지율, 수동 발주의 추천 대비 수정량을 집계 (Fildes et al. 2009, Kesavan & Kushwaha 2020)
6. 작은 일: CI backend job 이 `compileJava` 만 돌린다. DB 없는 단위 테스트(`OrderRequestServiceRecommendTest`)는 CI 에서 돌릴 수 있다

**직접(사람이) 해야 할 일**: TiDB 비밀번호·JWT 시크릿 교체 (예전 값이 공개 저장소 git 히스토리에 있음), TiDB 접속 허용 IP 를 팀원 IP 로 제한

**보류 (이유가 있으므로 다시 논의할 때만)**
- 저판매 메뉴 Croston 분기: 현재 데이터에 판매 0 비율 20% 초과·하루 평균 3개 미만 메뉴가 없어 효과를 검증할 수 없음
- 메뉴별 원가 critical fractile: 원가 데이터가 없어 지금 만들면 공통값 `COST_RATIO=0.4` 와 결과가 같음
- LSTM·Prophet: 데이터 규모상 이득이 작다는 것이 M5·Montero-Manso & Hyndman 결론. 넣는다면 베이스라인으로만
- 상권 데이터: 행정동·분기 단위라 일 단위 메뉴 예측 기여가 작음

## 3. 이미 내린 결정 (바꾸려면 근거와 백테스트 필요)

- 모델: 메뉴별 로컬 모델이 아니라 전체 매장×메뉴 **글로벌 XGBoost 1개**, L1 손실, scale = 메뉴 규모 × 매장 요일 비율
- lag 는 달력 기준 같은 요일(`weekday_lag`), `lag_1` 은 쓰지 않음 (7일 앞을 한 모델로 예측)
- 판매 이력: 매장에 판매가 1건이라도 있는 날 = 영업일. 영업일에 메뉴 판매가 없으면 0, 매장 전체 판매가 없는 날은 행 제외
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
| AI 단위 테스트 | `python -m pytest tests` (ai-service) | 17 passed |
| 백엔드 단위 테스트 | `gradlew.bat test --tests com.foodguard.service.OrderRequestServiceRecommendTest` (backend) | BUILD SUCCESSFUL |
| 프론트 타입체크 | `npx tsc --noEmit` (frontend) | 오류 0 |
| DB 백테스트 | `python backtest.py --db --step 7` (ai-service) | 글로벌 모델 wMAPE **11.6%** / MASE **1.037**, 요일 평균(4주) 12.0% / 1.084, 식자재 7일 커버리지 **56.7%** (평균 잉여율 4.7%, 부족률 4.0%) |
| 합성 백테스트 | `python backtest.py --synthetic` (ai-service) | 글로벌 모델 14.8% / 0.817 |

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
