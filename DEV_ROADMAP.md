# FoodGuard 개발 로드맵 — 보완 작업 + AI 에이전트 8종

> **이 문서 하나로 개발을 시작할 수 있게 정리했습니다.** 2026-10-30 기준 코드(`junho` 브랜치, 미커밋 작업 포함)를 직접 읽고 작성했습니다.
> Claude에게는 이렇게 시키면 됩니다: **"DEV_ROADMAP.md 의 `B-3` 진행해줘"** — 작업 ID 단위로 하나씩.

---

## 0. 먼저 읽을 것 (Claude 작업 규칙)

### 0.1 작업 시작 전 매번
1. 이 문서에서 해당 작업 ID 섹션을 읽는다.
2. `CLAUDE.md`(작게·외과적으로 고치기) 규칙을 따른다.
3. 도메인 사실은 `agent-assets/01~05`를 참고하되 **반드시 현재 코드로 재확인**한다 (문서는 2026-09-11/10-16 기준).
4. 작업이 끝나면 이 문서의 해당 체크박스를 `[x]`로 바꾸고, 결함 수정이면 `agent-assets/CHANGELOG.md`에 기록한다.

### 0.2 절대 규칙 (어기면 데이터가 망가짐)
| # | 규칙 | 이유 |
|---|---|---|
| R1 | **DB 스키마 변경은 `ai-service/migrations/NNN_*.sql` 파일로만** 만들고, 실행은 팀 합의 후 사람이 한다 | `spring.jpa.hibernate.ddl-auto=none`, DB가 **공용 TiDB Cloud** |
| R2 | `POST /api/sales`를 테스트·백필에 쓰지 않는다 | 재고를 실제로 차감함 |
| R3 | 발주 상태는 7종만: `REQUESTED / APPROVED / HQ_SENT / DRIVER_RECEIVED / DONE / REJECTED / CANCELLED`. 재고 증가는 `DONE` 전환에서만 | `OrderRequestService.updateStatus()` |
| R4 | **LLM은 수량을 계산하지 않는다.** 수량·재고·상태 전이·권한은 결정적 코드(Java/Python)가 하고, LLM은 설명·우선순위·"줄이거나 보류" 제안만 | 환각이 곧 발주 오류 |
| R5 | **에이전트는 업무 데이터를 직접 쓰지 않는다.** 쓰기는 "제안(Proposal) → 사람 승인 → 서버가 실행" 경로로만. 예외 화이트리스트는 §4.3 | 안전 경계 |
| R6 | `confidence`는 확률이 아니다 (0~100 휴리스틱). 화면·리포트에 "정확도 X%"로 쓰지 않는다 | `03-ml-model-card.md` §5 |
| R7 | 단위는 기준단위 `kg / L / 개`. 변환은 `util/UnitConverter` 한 곳만 사용 | g/kg 1000배 오차 이력 |
| R8 | 비밀값(DB 비번, JWT 시크릿, API 키)은 **코드·문서·커밋에 절대 넣지 않는다** | §1 P0-1 |
| R9 | 식자재는 이름이 아니라 **ID로** 매칭 (`양파(개)` / `양파(kg)` 중복 존재) | `05-data-inventory.md` §4 |

### 0.3 현재 구조 요약
```
React(frontend, Vite) ──JWT──▶ Spring Boot :8080 (backend)
                                 ├─ JwtFilter → ROLE_OWNER / ROLE_HQ_ADMIN
                                 ├─ StoreAccessGuard (매장 소유권, 컨트롤러 계층)
                                 ├─ TiDB Cloud (MySQL 호환, 공용)
                                 ├─ /api/delivery/** (무인증, 토큰 기반) + WebSocket /ws
                                 └─ RestTemplate ──▶ FastAPI :8000 (ai-service)
                                                      ├─ /api/predict  RandomForest + Open-Meteo
                                                      ├─ /api/train
                                                      └─ /api/accuracy  (PREDICTION_LOG, 미커밋)
에이전트 층
  fgcli/   읽기 전용 CLI (사용자 JWT 위임)  ─ COMMANDS 딕셔너리에 커맨드 정의
  fgagent/ 발주 참모 러너: observe → planner.build_plan → crosscheck → claude -p 검토
           → 터미널 승인 → executor.place_orders → 검증 → agent-runs/*.json
  .claude/agents/  analyst / hq / auditor / reviewer 서브에이전트
```

---

## 1. 한눈에 보기 — 전체 작업표

> 순서대로 하면 됩니다. **같은 Phase 안에서 "의존" 칸이 비어 있는 작업끼리는 병렬 가능**합니다.

| Phase | ID | 작업 | 의존 | 규모 | 완료 기준 (한 줄) |
|---|---|---|---|---|---|
| **P0 출품 차단** | P0-1 | 비밀정보 제거·교체 | – | S | `git grep`에 비번/시크릿 0건, 새 비번으로 기동 |
| | P0-2 | 미커밋 작업 정리·커밋 | P0-1 | S | `git status` 깨끗, CI 통과 |
| | P0-3 | 미구현 화면 처리 (임시 숨김) | – | S | 시연 중 404 0건 |
| | P0-4 | 합성 데이터 고지 | – | XS | 예측·정확도 화면에 배지 |
| | P0-5 | 시연 백업 (녹화·오프라인 모드) | AG-0 이후 갱신 | S | 네트워크 없이도 시연 영상 재생 |
| **P1 보완** | B-1 | AI 서비스 내부 인증 + CORS 제한 | – | S | 토큰 없는 `/api/train` 호출이 401 |
| | B-2 | 배달 토큰 만료·상태 검사 | – | S | 만료/잘못된 상태 토큰은 400/410 |
| | B-3 | 운영 설정 정리 (`show-sql` 등 프로필 분리) | P0-1 | XS | `prod` 프로필에서 SQL 로그 없음 |
| | B-4 | 재예측 실패를 올바른 HTTP 코드로 | – | S | 실패 시 502, fgagent·프론트 정상 동작 |
| | D-1 | `PREDICTION_LOG` 적용·검증 | P0-2 | S | `/api/accuracy?source=backtest` 수치 반환 |
| | D-2 | `INVENTORY_TXN` 재고 원장 | – | M | 모든 재고 변동이 원장에 1행씩 |
| | D-3 | 유통기한 (`shelf_life_days` + 입고 로트) | D-2 | M | 재고별 `expiryDate` 산출 가능 |
| | D-4 | `WASTE_RECORD` 폐기 기록 | D-2 | S | 폐기 등록 시 재고 감소 + 원장 기록 |
| | D-5 | 판매 시점 단가 저장 | – | S | 메뉴 가격 변경이 과거 매출에 영향 없음 |
| | D-6 | 이벤트/프로모션 캘린더 (선택) | – | S | 예측 피처에 `is_event` 반영 |
| | Q-1 | 백엔드 H2 테스트 프로필 + 핵심 테스트 | – | M | CI에서 `./gradlew test` 전체 통과 |
| | Q-2 | ai-service·fgagent 테스트 보강 | – | S | 폐기 산식·이상탐지 산식 단위테스트 |
| | C-1 | 레포 정리 (sample, 로그, 빈 파일) | P0-2 | XS | 불필요 파일 0, 템플릿 출처 표기 |
| | R-1 | 보고서 빈칸 채우기 | D-1, AG-2 | S | 정확도·폐기율 수치 + 산출 근거 |
| **P2 에이전트 기반** | AG-0 | 공통 런타임 (Claude API 루프·제안 큐·스케줄러·감사로그·UI) | P0-2, B-1 | L | 더미 에이전트가 제안→승인→실행 한 바퀴 |
| **P3 에이전트** | AG-1 | 발주 참모 (웹·자동 실행화) | AG-0 | M | 매일 08:00 발주안이 웹 승인함에 |
| | AG-2 | 폐기 위험 에이전트 ⭐ | AG-0, D-3 | L | `/waste-prediction` 화면이 실데이터로 |
| | AG-3 | 기부 매칭 에이전트 | AG-2, D-4 | M | `/donations` 화면 동작, 기부 시 재고 차감 |
| | AG-4 | 본사 발주 심사 에이전트 | AG-0 | M | 관리자 발주 목록에 위험 점수·권고 |
| | AG-5 | 예측 운영(MLOps) 에이전트 | AG-0, D-1 | M | 성능 하락 시 챌린저 학습·교체 제안 |
| | AG-6 | 데이터 품질 감사 에이전트 | AG-0 | S | 매일 감사 리포트 + 이슈 알림 |
| | AG-7 | 입고 추적 에이전트 | AG-0 | S | 지연 발주 자동 알림 |
| | AG-8 | 리포트·질의 에이전트 (챗) | AG-0 | M | 대시보드 채팅으로 질문·답변 |
| **P4 통합** | IN-1 | "오늘의 에이전트 브리핑" 화면 | AG-1~7 | M | 한 화면에서 전 에이전트 결과·승인 |
| | IN-2 | 시연 시나리오·리허설 | 전체 | S | 7분 시나리오 3회 무중단 |

규모: XS(<1h) · S(반나절) · M(1~2일) · L(3일+)

**추천 진행 순서**
`P0-1 → P0-2 → (P0-3, P0-4, B-1, B-2, B-4 병렬) → D-1 → AG-0 → AG-1 → D-2 → D-3 → AG-2 → D-4 → AG-3 → AG-5 → AG-4 / AG-6 / AG-7 / AG-8 → IN-1 → R-1 → IN-2`
시간이 부족하면 **AG-1 + AG-2 + AG-5 + IN-1**만 해도 발표 스토리가 완성됩니다.

---

## 2. Phase 0 — 출품 차단 이슈

### P0-1. 비밀정보 제거·교체 🔴 최우선
**문제:** `backend/src/main/resources/application.properties`에 DB 비밀번호와 `jwt.secret`이 평문으로 들어 있고 git에 추적되며, `origin`(GitHub `Food-G/Test-Repository`)에 push된 상태입니다. `backend-run.log`(SQL 트레이스)와 `backend/postman/**`의 환경 파일도 추적 중입니다.

**단계**
- [ ] 1. GitHub에서 레포 공개 여부를 확인한다. **공개면 이미 유출된 것으로 간주한다.**
- [ ] 2. **(사람)** TiDB Cloud 콘솔에서 DB 사용자 비밀번호를 교체한다. 새 JWT 시크릿을 생성한다(32바이트 이상 랜덤). 교체하면 기존 로그인 토큰이 모두 무효가 되는데, 이는 정상이다.
- [ ] 3. `application.properties`를 환경변수 참조로 바꾼다.
  ```properties
  spring.datasource.url=${DB_URL}
  spring.datasource.username=${DB_USERNAME}
  spring.datasource.password=${DB_PASSWORD}
  jwt.secret=${JWT_SECRET}
  ai.service.url=${AI_SERVICE_URL:http://localhost:8000}
  ```
- [ ] 4. 로컬 실행용으로 `backend/.env.example`(키 이름만)을 만든다. 실제 값은 IntelliJ Run Configuration의 Environment variables나 `backend/.env`(이미 gitignore)에 둔다. Spring이 `.env`를 자동으로 읽지 않으므로, 필요하면 `spring.config.import=optional:file:.env[.properties]`를 쓴다.
- [ ] 5. CI(`.github/workflows/ci.yml`)의 backend job은 DB를 쓰지 않으므로 더미 env만 주입한다(Q-1 이후 H2 사용).
- [ ] 6. 추적 해제: `git rm --cached backend-run.log frontend-dev*.log`. `.gitignore`에 `*.log`를 추가한다. Postman 환경 파일에 토큰이나 비번이 있으면 같은 방식으로 처리한다.
- [ ] 7. **히스토리 정리(팀 합의 필수):** 레포가 공개였다면 `git filter-repo --path backend/src/main/resources/application.properties --invert-paths`가 아니라 **값 치환 방식**(`--replace-text`)으로 비번 문자열을 지운다. 그다음 force push하고 팀원 전원이 재클론한다. 비공개 팀 레포라면 2번의 교체만으로도 충분하다.
- [ ] 8. `ai-service/.env`의 `DB_URL`도 새 비번으로 갱신한다(`.env`는 이미 gitignore).

**검증:** `git grep -n "password=\|jwt.secret=" -- ':!*.example'` 결과에 실제 값이 없을 것. 새 비번으로 backend·ai-service·fgcli `whoami`가 동작할 것.

### P0-2. 미커밋 작업 정리·커밋
**현재 미커밋:** `ci.yml`, `ai-service/{main.py, ml/demand_predictor.py, services/data_service.py, services/prediction_service.py}`, `fgcli/__main__.py` (수정) / `ai-service/{migrations/, ml/backtest.py, routers/accuracy.py, services/accuracy_service.py, tests/}`, `make_portfolio.py` (신규)

**단계**
- [x] 1. `git diff`로 수정 내용을 확인한다. `.env`, `*.joblib`, `agent-runs/`가 스테이징되지 않았는지 확인한다.
- [x] 2. 의미 단위로 나눠 커밋한다 — 2026-10-30 완료 (`42b8caa` TiDB 트랜잭션, `73a4fd5` 정확도+CI, `5aaf54b` fgcli, `0ad5259` 포트폴리오)
  - 확인 사항: 커밋 전에 공용 DB에 `prediction_log` 테이블이 이미 있음을 확인했다(backtest 364행). live 예측이 이 테이블에 쓰기 때문에, 테이블이 없는 DB에서는 예측 저장이 실패한다.
- [x] 3. 로컬에서 CI와 같은 명령을 돌린다: ai-service 3 tests OK, `fgcli.test_planner` 11 tests OK, `import main` OK.
- [ ] 4. push는 사용자가 확인한 뒤에 한다.

### P0-3. 미구현 화면 처리 (임시)
**문제:** 프론트가 호출하지만 백엔드가 없는 API가 있습니다.
- `/api/waste-prediction/*`, `/api/donations/*`
- `/api/orders/{id}/hq-send`, `/api/orders/scan`, `/api/orders/{id}/driver-receive`, `/api/orders/{id}/owner-receive`
- `/api/delivery/group/{groupToken}/driver-receive`

**단계**
- [ ] 1. `frontend/src/layouts/main-layout/Sidebar/Sidebar.tsx` 79~80행의 `폐기예측 & 기부`, `기부 이력`을 `active: false`로 바꾸거나 "준비 중" 배지를 단다. **AG-2/AG-3 완료 시 되돌린다.**
- [ ] 2. `grep -rn "hqSend\|scanQr\|driverReceive\|driverReceiveGroup\|ownerReceive" frontend/src`로 `orderService.ts`의 미구현 함수를 실제로 호출하는 버튼을 찾는다. 참고로 `hqSend(id, expiryDate?)`는 유통기한을 받으므로, D-3에서 로트 `expiry_date`의 입력 경로로 살릴 수 있다. 해당 버튼은 기존 `PUT /api/orders/{id}/status`(상태값 `HQ_SENT`, `DRIVER_RECEIVED`) 호출로 대체하거나 숨긴다.
- [ ] 3. `DeliveryDriverGroup.tsx`(그룹 수령)는 사용처를 확인하고, 시연에 쓰지 않으면 라우트를 숨긴다.

**검증:** 브라우저 개발자도구 Network 탭에서 전 메뉴를 클릭했을 때 404가 0건일 것.

### P0-4. 합성 데이터 고지
- [ ] `Predictions.tsx`, `Dashboard.tsx`의 예측 카드와 (D-1 이후) 정확도 표시 옆에 "시범 데이터(합성) 기준" 배지를 단다.
- [ ] 보고서·발표 자료에도 같은 문구를 넣는다. `05-data-inventory.md` §3 "요일 효과 + ±10% 노이즈"를 근거로 인용한다.

### P0-5. 시연 백업
- [ ] 1. 핵심 시나리오(IN-2)를 화면 녹화(mp4)한다. 에이전트가 생기면 다시 녹화한다.
- [ ] 2. 에이전트 결과 재생 모드를 만든다: `agent-runs/*.json`을 읽어 동일한 화면을 보여주는 `?replay=<runId>` 옵션(AG-0 UI에서 구현). LLM 호출 없이도 시연할 수 있게 하기 위함이다.
- [ ] 3. 시연 PC 체크리스트: Java 17, Node 20, Python 3.11, `.env` 3종, TiDB 접속 허용 IP(TiDB Cloud는 IP 허용 목록이 있으면 시연장 IP 추가).

---

## 3. Phase 1 — 보완 작업

### B-1. AI 서비스 내부 인증 + CORS 제한
**문제:** FastAPI(`ai-service/main.py`)는 인증이 없고 `allow_origins=["*"]`입니다. 누구나 `/api/train/store/{id}`(재학습), `/api/predict/...`(DB 쓰기)를 호출할 수 있습니다.

**설계:** Spring과 ai-service가 공유 비밀 `INTERNAL_API_TOKEN`을 갖고, 요청마다 헤더 `X-Internal-Token`으로 보낸다. 브라우저는 ai-service를 직접 부르지 않는다.

**단계**
- [ ] 1. `ai-service/config.py` `Settings`에 `INTERNAL_API_TOKEN: str = ""`를 추가한다(`.env.example`에도 키 추가).
- [ ] 2. `ai-service/main.py`에 의존성 `verify_internal_token(x_internal_token: str = Header(...))`를 추가한다. `/health`를 뺀 모든 router에 `dependencies=[Depends(verify_internal_token)]`를 건다. 토큰이 빈 문자열이면 서버 기동 시 경고 로그를 남기고 개발 모드로 통과시킨다.
- [ ] 3. CORS: `allow_origins`를 `settings.CORS_ORIGINS`(기본 `http://localhost:5173`)로 제한한다. 브라우저가 직접 부르지 않으면 CORS 미들웨어 자체를 제거해도 된다. 제거 전에 `grep -rn "8000" frontend/src`로 확인한다.
- [ ] 4. Spring: `AppConfig`의 RestTemplate(또는 ai-service를 부르는 `PredictionService`)에 인터셉터를 달아 헤더를 자동으로 붙인다. 값은 `ai.service.token=${INTERNAL_API_TOKEN}`.
- [ ] 5. fgcli는 `ai-health`(`/health`, 인증 제외)와 `accuracy`가 AI_BASE를 직접 부른다. `accuracy`는 **Spring 프록시** `GET /api/predictions/accuracy?source=&storeId=`를 새로 만들고, `StoreAccessGuard`로 매장 검사를 한 뒤 fgcli가 그쪽을 부르게 바꾼다. 에이전트가 내부 토큰을 갖지 않게 하기 위함이다(원칙 ①).
- [ ] 6. `fgagent/executor.py` `ai_service_up()`은 `/health`라 영향이 없다.

**검증:** `curl -X POST localhost:8000/api/train/store/60006`은 401, 프론트 예측 트리거는 정상 동작.

### B-2. 배달 토큰 만료·상태 검사
**문제:** `/api/delivery/{token}/complete`는 무인증입니다. 토큰만 있으면 아무 상태에서나 `DONE`으로 바꿔 재고를 늘립니다(이중 증가는 `prev` 검사로 막혀 있음).

**단계**
- [ ] 1. 마이그레이션 `ai-service/migrations/002_delivery_token_expiry.sql`: `ALTER TABLE ORDER_REQUEST ADD COLUMN delivery_token_expires_at DATETIME NULL;`
- [ ] 2. `OrderRequest` 엔티티에 필드를 추가한다. `OrderRequestService` 131행 토큰 발급 지점에서 `now + 48h`로 설정한다.
- [ ] 3. `DeliveryController.completeDelivery`: (a) 만료면 410, (b) 현재 상태가 `APPROVED/HQ_SENT/DRIVER_RECEIVED`가 아니면 400, (c) 완료 후 토큰을 null 처리한다(1회성). WebSocket `start/location`도 만료 검사를 한다.
- [ ] 4. 기존 행(만료값 NULL)은 "만료 없음"으로 처리해 하위 호환을 유지한다.

### B-3. 운영 설정 정리
- [ ] `application.properties`는 공통값만 둔다. `application-local.properties`에 `spring.jpa.show-sql=true`, `format_sql=true`를 두고, `application-prod.properties`에는 `show-sql=false`를 둔다. 실행은 `--spring.profiles.active=local`.
- [ ] `jwt.expiration=3600000`(1h)은 시연 중 만료될 수 있다. local 프로필에서만 늘리거나 프론트에 만료 시 재로그인 안내를 한다(`utils/jwt.ts`).

### B-4. 재예측 실패를 올바른 HTTP 코드로
**문제:** `POST /api/predictions/{storeId}/trigger`는 실패해도 200에 `{"status":"error"}`를 반환합니다.
- [ ] 1. `PredictionController.trigger`: 결과가 error면 `ResponseEntity.status(502)`로 바꾼다. 본문 형식은 유지한다.
- [ ] 2. `fgagent/executor.py` `trigger_prediction`은 이미 `status == 200 and body.status == success`로 검사하므로 그대로 동작한다. 실패 메시지 파싱만 확인한다.
- [ ] 3. 프론트 `predictionService.ts`와 호출부(`Predictions.tsx`)의 catch에서 `error.response.data.message`를 표시한다.

### D-1. `PREDICTION_LOG` 적용·검증
**현재:** `ai-service/migrations/001_prediction_log.sql`, `ml/backtest.py`, `/api/accuracy`가 코드로 존재(미커밋)합니다.
- [ ] 1. P0-2 커밋 후 팀 합의를 거쳐 **(사람)** TiDB에 001을 실행한다.
- [ ] 2. `python -m ml.backtest`(사용법은 파일 docstring 확인)로 60005·60006 백테스트를 실행한다.
- [ ] 3. `python -m fgcli accuracy --source backtest`로 WAPE·MAPE·편향·기준선 대비 수치를 확인한다.
- [ ] 4. live 예측이 `save_predictions_bulk`에서 로그에 같이 쌓이는지 확인한다(재예측 1회 → 행 수 증가).
- [ ] 5. 결과를 `agent-assets/03-ml-model-card.md` §7 #3에 반영한다(✅ 수정됨).

### D-2. `INVENTORY_TXN` 재고 원장
**목적:** 폐기율·회전율 산출, 에이전트의 "왜 재고가 줄었나" 추적.

- [ ] 1. 마이그레이션 `003_inventory_txn.sql`
  ```sql
  CREATE TABLE IF NOT EXISTS INVENTORY_TXN (
    txn_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id      BIGINT NOT NULL,
    ingredient_id BIGINT NOT NULL,
    delta_qty     DECIMAL(12,3) NOT NULL,      -- 기준단위(kg/L/개), +입고 −소모
    reason        VARCHAR(20) NOT NULL,        -- SALE, ORDER_DONE, WASTE, DONATION, ADJUST, INIT
    ref_type      VARCHAR(20) NULL,            -- SALES_DATA, ORDER_REQUEST, WASTE_RECORD, DONATION
    ref_id        BIGINT NULL,
    qty_after     DECIMAL(12,3) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by    BIGINT NULL,                 -- user_id (에이전트 제안 승인자)
    INDEX idx_txn_store_ing_time (store_id, ingredient_id, created_at)
  );
  ```
- [ ] 2. 엔티티 `entity/InventoryTxn.java`, `repository/InventoryTxnRepository.java`를 만든다.
- [ ] 3. **원장 기록을 한 곳으로 모은다:** `service/InventoryLedger.java`에 `apply(storeId, ingredientId, delta, reason, refType, refId)`를 둔다. 재고 행 갱신과 원장 insert를 **같은 트랜잭션**에서 처리한다. 재고 행이 없으면 생성한다.
- [ ] 4. 기존 재고 변경 지점을 모두 이 메서드로 바꾼다. `grep -rn "setCurrentQty" backend/src`로 찾는다.
  - `SalesDataService`(판매 차감) → `SALE`
  - `OrderRequestService.updateStatus` DONE 분기(135행~) → `ORDER_DONE`
  - `OrderRequestService.initInventoryFromOrders` → `INIT`
  - `InventoryService` PUT(수동 조정) → `ADJUST`(차이만큼 delta)
- [ ] 5. 조회 API `GET /api/inventory/{storeId}/txns?from=&to=&ingredientId=`를 만들고 `StoreAccessGuard`를 적용한다. fgcli에 `txns` 커맨드를 추가한다.
- [ ] 6. 테스트(Q-1): 판매 1건 → 원장 행 수 = 레시피 식자재 수, 합계가 재고 변화와 일치.

### D-3. 유통기한
**배경:** `WastePrediction.tsx`가 `expiryDate`, `daysUntilExpiry`, `expectedConsumption`, `wastePrediction`, `wasteRate`, `currentQty`, `ingredientName`, `inventoryId`를 기대하는데, DB에는 유통기한 정보가 없습니다.

**MVP 설계(권장):** 식자재별 보관일수 + 입고 로트(FIFO)
- [ ] 1. 마이그레이션 `004_shelf_life_lot.sql`
  ```sql
  ALTER TABLE INGREDIENT ADD COLUMN shelf_life_days INT NULL;  -- NULL = 유통기한 관리 안 함(소금 등)
  CREATE TABLE IF NOT EXISTS INVENTORY_LOT (
    lot_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    store_id      BIGINT NOT NULL,
    ingredient_id BIGINT NOT NULL,
    order_id      BIGINT NULL,
    received_qty  DECIMAL(12,3) NOT NULL,
    remaining_qty DECIMAL(12,3) NOT NULL,
    received_at   DATETIME NOT NULL,
    expiry_date   DATE NULL,
    INDEX idx_lot_fifo (store_id, ingredient_id, expiry_date)
  );
  ```
- [ ] 2. `seed_ingredients.py`처럼 식자재별 `shelf_life_days` 기본값 스크립트를 만든다(예: 소고기 5, 채소 7, 소스 90, 건자재 NULL). **실행 전 사람 확인.**
- [ ] 3. `InventoryLedger.apply`를 확장한다.
  - `ORDER_DONE`: 로트를 생성한다(`expiry = received + shelf_life_days`).
  - 음수 delta(SALE/WASTE/DONATION): 유통기한이 이른 로트부터 `remaining_qty`를 차감한다(FIFO).
  - 로트 합계와 `INVENTORY.current_qty`가 어긋나면 **재고 행이 진실**이다. 차이는 `expiry=NULL` 로트로 보정한다.
- [ ] 4. 기존 재고 이관: 현재 재고 전체를 `received_at = INVENTORY.updated_at`, `expiry = updated_at + shelf_life_days`인 로트 1개로 만드는 일회성 스크립트를 만든다(사람 확인 후 실행).

### D-4. `WASTE_RECORD` 폐기 기록
- [ ] 1. 마이그레이션 `005_waste_record.sql`: `waste_id, store_id, ingredient_id, qty, reason(EXPIRED/DAMAGED/OVERPREP/OTHER), lot_id NULL, recorded_at, recorded_by`
- [ ] 2. `POST /api/waste/{storeId}`(사람 입력) → `InventoryLedger.apply(−qty, WASTE)`. `GET /api/waste/{storeId}?from=&to=`.
- [ ] 3. 프론트: `Inventory.tsx` 행 액션에 "폐기 등록" 다이얼로그를 추가한다.
- [ ] 4. 폐기율 = 기간 폐기량 ÷ 기간 입고량(원장 `ORDER_DONE` 합계). 이 값이 R-1 보고서 수치의 근거가 된다.

### D-5. 판매 시점 단가 저장
**문제:** 매출 = 수량 × 현재 `MENU.price`라 가격을 바꾸면 과거 매출도 바뀝니다.
- [ ] 1. 마이그레이션 `006_sales_unit_price.sql`: `ALTER TABLE SALES_DATA ADD COLUMN unit_price DECIMAL(10,0) NULL;`
- [ ] 2. `SalesDataService` 저장 시 현재 메뉴 가격을 기록한다.
- [ ] 3. 매출 집계(`today-summary`, `weekly-summary`, `all-stores/weekly-summary`)는 `COALESCE(unit_price, menu.price)`를 쓴다. 과거 NULL 행은 현행 가격으로 대체되며, 이 한계는 문서에 남긴다.

### D-6. 이벤트 캘린더 (선택)
- [ ] `STORE_EVENT(store_id, event_date, type, note)` 테이블, CRUD API, `ml/feature_engineering.py`에 `is_event` 피처를 추가한다. 백테스트로 개선 여부를 확인한 뒤 채택한다.

### Q-1. 백엔드 H2 테스트 프로필 + 핵심 테스트
- [ ] 1. `build.gradle`에 `testRuntimeOnly 'com.h2database:h2'`를 추가한다.
- [ ] 2. `src/test/resources/application-test.properties`: `jdbc:h2:mem:fg;MODE=MySQL;DATABASE_TO_UPPER=false`, `ddl-auto=create-drop`, 더미 `jwt.secret`, `ai.service.url=http://localhost:0`
  - 주의: `created_at` 등은 `insertable=false`라 DB DEFAULT에 의존한다. H2 create-drop에서는 NULL이 되므로, NOT NULL 제약에 걸리는 엔티티가 있으면 `@CreationTimestamp` 대신 테스트 픽스처에서 값을 넣는다. **운영 엔티티 동작은 바꾸지 않는다.**
- [ ] 3. `FoodguardApplicationTests`에 `@ActiveProfiles("test")`를 적용한다.
- [ ] 4. 꼭 넣을 테스트
  - `OrderRequestServiceTest`: 7종 외 상태 400, `DONE` 전환 시 재고 1회만 증가, 승인된 발주 취소 400
  - `StoreAccessGuardTest`: 타 매장 OWNER 403, HQ 통과, 엔티티 id 역추적 차단
  - `InventoryLedgerTest`(D-2 이후): 원장 합계와 재고 일치, FIFO 차감
  - `UnitConverterTest`: 기존 유지
- [ ] 5. `ci.yml` backend job을 `./gradlew build -Dspring.profiles.active=test`로 바꾼다.

### Q-2. ai-service·fgagent 테스트 보강
- [ ] `ai-service/tests/`: `feature_engineering` 결측·휴일 처리, `matches_history` 캐시 판정
- [ ] 에이전트별 결정적 산식(AG-2 폐기량, AG-4 이상점수, AG-5 교체 판정)은 **네트워크 없는 단위테스트**로 `fgcli/test_planner.py` 스타일을 따라 작성하고 CI `agent` job에 추가한다.

### C-1. 레포 정리
- [ ] `sample/`(Nickelfox Sales Management Dashboard 템플릿 원본): 라이선스를 확인해 `frontend/README.md`에 "UI 템플릿 출처"를 표기하고, 레포에서는 제거한다(필요하면 원본 링크만 남김).
- [ ] 루트의 빈 파일 `기상청_단기예보_조회서비스`, `FoodGuard/node_modules/`(루트에 잘못 설치된 것)를 삭제한다. 삭제 전에 `package.json`이 없는지 확인한다.
- [ ] `ai-service/{check_db.py, test_dummy.py, ing_check.txt, sales_check.txt, insert_dummy.py, generate_dummy_data.py}` → `ai-service/scripts/`로 옮기고 README에 용도를 한 줄씩 쓴다. **`update_ingredient_units.py`는 "재실행 금지" 주석을 맨 위에 단다.**

### R-1. 보고서 빈칸 채우기
- [ ] 예측 정확도: D-1의 backtest WAPE/MAPE와 "기준선(요일평균) 대비 개선율"을 쓴다. 문구 예: "합성 판매 데이터 기준 7일 예측 WAPE xx% (요일 평균 기준선 대비 yy%p 개선)".
- [ ] 폐기율: D-4와 AG-2 이후 시범 기간의 폐기율을 비교한다. 실측이 부족하면 **시뮬레이션**(AG-2 제안을 따랐을 때와 아닐 때의 예상 폐기량)으로 쓰고 그렇다고 명시한다.
- [ ] CI/CD 문구: CI는 구현됨(GitHub Actions 4 job). CD는 미구현이므로 "CI 적용"으로 정정한다.
- [ ] 8~15주 진도 칸: `git log --since=2026-07-01 --oneline`을 근거로 채운다.

---

## 4. Phase 2 — 에이전트 공통 기반 (AG-0)

모든 에이전트가 공유하는 뼈대입니다. **이것부터 만들면 AG-1~8은 각각 "도구 몇 개 + 프롬프트 + 결정적 산식"만 추가하면 됩니다.**

### 4.1 아키텍처
```
                   ┌──────────── 스케줄러 (APScheduler, agent-service 안) ────────────┐
                   │ 08:00 AG-1 발주참모  09:00 AG-2 폐기  07:00 AG-5 MLOps          │
                   │ 06:30 AG-6 감사      매시 AG-7 입고추적   (AG-4는 발주 생성 이벤트) │
                   └────────────────────────────┬──────────────────────────────────────┘
                                                ▼
 agent-service (Python, FastAPI :8100)  ── fgagent/ 를 확장
   ├─ runtime/loop.py      Claude API tool-use 루프 (공통)
   ├─ runtime/tools.py     fgcli COMMANDS → Claude tool 정의 자동 생성 (읽기 전용)
   ├─ runtime/proposals.py 제안 생성 → Spring /api/agent/proposals (POST)
   ├─ agents/<name>.py     에이전트별 observe() / decide() / prompt / output schema
   └─ runs → AGENT_RUN 테이블 + agent-runs/*.json(로컬 백업, 시연 replay 용)
                                                │  JWT (ROLE_AGENT)
                                                ▼
 Spring Boot
   ├─ /api/agent/proposals       제안 큐 (생성: AGENT, 조회/승인/거절: OWNER·HQ)
   ├─ /api/agent/proposals/{id}/approve  ← 사람이 웹에서 클릭 (사람 JWT)
   │      └─ ProposalExecutor: 타입별 결정적 실행 (발주 생성, 폐기 등록, 기부 생성…)
   └─ 기존 API
 Frontend
   └─ /agent-inbox  승인함 + 에이전트 실행 기록 (IN-1에서 브리핑 화면으로 확장)
```

### 4.2 핵심 설계 결정
| 결정 | 내용 | 이유 |
|---|---|---|
| 실행 주체 | 기존 `claude -p`(로컬 CLI)는 **개발용으로 유지**하고, 스케줄 실행·웹 연동은 **Anthropic Python SDK(Claude API) tool-use 루프**를 쓴다. `ANTHROPIC_API_KEY`가 없으면 `claude -p`로 폴백 | 시연 PC 독립성, 스케줄 실행 |
| 모델 | 일상 브리핑·감사: `claude-sonnet-5-5` / 대량·단순 분류: `claude-haiku-5-5` / 심층 검토(AG-4 고위험, AG-5 교체 판단 설명): `claude-opus-5-5`. 에이전트별로 `AGENT_MODEL_<NAME>` env로 바꿀 수 있게 | 비용과 품질의 균형 |
| 인증 | 새 역할 **`ROLE_AGENT`** 서비스 계정. 권한은 **모든 GET + 제안 생성 + 알림 생성(AG-7)** 뿐. 업무 쓰기 API는 `@PreAuthorize("!hasRole('AGENT')")` | 스케줄 실행엔 사람 JWT가 없음. 대신 쓰기는 사람 승인 경로로만 |
| 매장 범위 | `StoreAccessGuard`: AGENT는 GET일 때만 HQ처럼 통과. 제안은 `store_id`가 있어야 하고, 승인은 그 매장 OWNER나 HQ만 가능 | 기존 소유권 모델 재사용 |
| 실행 | **승인 시 Spring `ProposalExecutor`가 실행**한다. 실행 직전에 `fingerprint`를 다시 계산해서 다르면(재고·발주가 바뀌었으면) `STALE`로 처리하고 재계획을 요청한다 | `planner.plan_fingerprint` 개념 이식 |
| 결과 구조화 | 모든 에이전트 출력은 JSON 스키마로 강제한다(현 `advisor.py` SCHEMA 방식). 공통 필드는 `summary`, `findings[]`, `proposals[]`, `concerns[]` | UI 렌더링·검증 |

### 4.3 쓰기 권한 화이트리스트 (R5 예외)
| 동작 | 에이전트가 직접? | 비고 |
|---|---|---|
| 알림 생성 (`NOTIFICATION`) | ✅ 직접 | 같은 매장·타입·대상에 대해 24h 중복 금지 (dedup key) |
| 재예측 트리거 | ✅ 직접 | 하루 매장당 3회 한도 |
| 챌린저 모델 학습 (별도 파일) | ✅ 직접 | 운영 모델 교체는 ❌ 제안 |
| 발주 생성·변경, 폐기 등록, 기부 생성, 재고 조정, 모델 교체 | ❌ **제안만** | 사람 승인 → `ProposalExecutor` |

### 4.4 DB (마이그레이션 `007_agent.sql`)
```sql
CREATE TABLE IF NOT EXISTS AGENT_RUN (
  run_id       VARCHAR(36) PRIMARY KEY,
  agent        VARCHAR(30) NOT NULL,      -- order_advisor, waste, donation, hq_review, mlops, audit, inbound, chat
  store_id     BIGINT NULL,
  trigger_type VARCHAR(20) NOT NULL,      -- SCHEDULE, EVENT, MANUAL, CHAT
  status       VARCHAR(20) NOT NULL,      -- RUNNING, OK, FAILED
  model        VARCHAR(50) NULL,
  input_tokens INT NULL, output_tokens INT NULL,
  result_json  JSON NULL,                 -- 최종 구조화 출력
  error        TEXT NULL,
  started_at   DATETIME NOT NULL, finished_at DATETIME NULL
);
CREATE TABLE IF NOT EXISTS AGENT_PROPOSAL (
  proposal_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id       VARCHAR(36) NOT NULL,
  agent        VARCHAR(30) NOT NULL,
  store_id     BIGINT NOT NULL,
  type         VARCHAR(30) NOT NULL,      -- ORDER_CREATE, WASTE_RECORD, DONATION_CREATE, DISCOUNT_SUGGEST, MODEL_PROMOTE, ORDER_FLAG
  payload      JSON NOT NULL,             -- 결정적 코드가 만든 실행 파라미터
  rationale    TEXT NOT NULL,             -- LLM 브리핑
  fingerprint  VARCHAR(64) NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXECUTED, FAILED, STALE, EXPIRED
  expires_at   DATETIME NOT NULL,
  decided_by   BIGINT NULL, decided_at DATETIME NULL,
  exec_result  JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prop_store_status (store_id, status)
);
```

### 4.5 구현 단계
- [ ] **AG-0.1 Spring 역할·제안 큐**
  1. `ROLE_AGENT` 추가: `JwtFilter` role 매핑에 `AGENT`, `USER` 테이블에 에이전트 계정 1개를 만든다(사람이 SQL 실행, 비번은 env).
  2. `StoreAccessGuard`: GET이면 AGENT 통과. 그 외에는 기존 규칙대로 하고 `!AGENT` 검사를 한다.
  3. 업무 쓰기 컨트롤러(`OrderRequest`, `Inventory`, `SalesData`, `Menu*`, `Ingredient`, `Store`)의 POST/PUT/DELETE에 `@PreAuthorize("!hasRole('AGENT')")`를 건다. 클래스 레벨 + GET 메서드 예외로 처리해도 된다.
  4. `entity/AgentProposal`, `AgentRun` + repository, `controller/AgentProposalController`
     - `POST /api/agent/proposals` (AGENT만)
     - `GET /api/agent/proposals?storeId=&status=` (OWNER 자기 매장 / HQ 전체)
     - `POST /api/agent/proposals/{id}/approve` · `/reject` (OWNER·HQ, `assertCanAccessStore`)
     - `POST /api/agent/runs`, `PUT /api/agent/runs/{id}`, `GET /api/agent/runs?agent=&storeId=`
  5. `service/ProposalExecutor`: `switch(type)` → 기존 서비스 메서드를 호출한다. 실행 직전 fingerprint 재검증과 만료 검사를 하고, 결과를 `exec_result`에 저장한다. **트랜잭션 단위는 제안 1건.** 발주 여러 건이면 항목별 결과를 기록한다(`executor.place_orders`처럼 일부 실패해도 나머지를 보고).
  6. 만료 처리: `@Scheduled`로 매시 `PENDING && expires_at < now`를 `EXPIRED`로 바꾼다.
- [ ] **AG-0.2 agent-service (Python)**
  1. `fgagent/`를 패키지로 확장한다: `fgagent/runtime/{loop.py, tools.py, proposals.py, runlog.py, scheduler.py}`, `fgagent/agents/`.
  2. 의존성: `anthropic`, `apscheduler`, `fastapi`, `uvicorn`, `requests` → `fgagent/requirements.txt`.
  3. `tools.py`: `fgcli.__main__.COMMANDS`를 순회해 Claude tool 정의(`name`, `description`, `input_schema`)를 자동 생성한다. `NEEDS_STORE_ID`, `NEEDS_MENU_ID`, `sales`의 start/end 인자를 스키마에 반영한다. 실행은 `FoodGuardClient`로 직접 GET(서브프로세스 불필요). **쓰기 도구는 만들지 않는다.** 에이전트별로 허용 도구 목록을 화이트리스트로 지정한다.
  4. `loop.py`: `run_agent(system_prompt, user_input, tools, output_schema, model, max_turns=8)`
     - 메시지 루프: 응답 `stop_reason == "tool_use"`면 도구를 실행하고 `tool_result`를 붙여 반복한다.
     - 최종 응답은 output_schema(JSON)로 검증하고, 실패하면 1회 재요청한다.
     - 도구 결과가 `{"error":"forbidden"}`이면 그대로 전달한다(우회 금지, 기존 원칙 ③).
     - 토큰 사용량과 도구 호출 로그를 `AGENT_RUN`에 기록한다.
     - `ANTHROPIC_API_KEY`가 없으면 `fgagent/advisor.py` 방식(`claude -p --json-schema`)으로 폴백한다.
  5. 인증: `fgcli/auth.py`에 `--as agent` 프로필을 추가한다(`FOODGUARD_AGENT_EMAIL/PASSWORD`, `ai-service/.env`).
  6. `scheduler.py`: APScheduler cron. 대상 매장은 `GET /api/stores`(AGENT GET 허용)로 활성 매장을 받는다. `fgagent serve` 커맨드로 FastAPI(:8100)와 스케줄러를 함께 띄운다. 엔드포인트는 `POST /run/{agent}?storeId=`(수동 실행, Spring에서만 호출, 내부 토큰 필요)와 `GET /health`.
  7. 기존 `python -m fgagent order <storeId>` 터미널 모드는 그대로 유지한다(개발·백업용).
- [ ] **AG-0.3 프론트 승인함**
  1. `pages/AgentInbox.tsx`, `services/agentService.ts`, 라우트 `/agent-inbox`, 사이드바 항목 "AI 승인함"(미결 건수 배지).
  2. 카드: 에이전트 아이콘, `summary`, 근거(펼치기: payload 표 + rationale), [승인] [거절(사유)] 버튼. STALE이면 "다시 계획" 버튼(`POST /api/agent/run` 프록시 → agent-service).
  3. 실행 기록 탭: `AGENT_RUN` 목록과 결과 JSON 뷰어. `?replay=<runId>`는 `agent-runs/*.json`(P0-5)을 지원한다.
  4. Spring에 `POST /api/agent/run/{agent}/{storeId}`(OWNER·HQ) 추가 → agent-service로 프록시(내부 토큰).
- [ ] **AG-0.4 더미 에이전트로 한 바퀴 검증**
  - `agents/echo.py`: 재고 조회 → "임계치 이하 식자재 n개" 요약 → `ORDER_FLAG` 제안 1건(실행 시 아무것도 안 함).
  - 확인 흐름: 승인함 표시 → 승인 → EXECUTED → AGENT_RUN 기록.

**에이전트 1개를 추가하는 표준 절차 (AG-1~8 공통)**
1. `fgagent/agents/<name>.py`에 `observe(client, store_id) -> dict`(결정적 조회), `decide(obs) -> dict`(결정적 산식, 수량 확정), `PROMPT`(md 파일), `OUTPUT_SCHEMA`, `ALLOWED_TOOLS`, `to_proposals(decision, llm_out) -> list`를 만든다.
2. 결정적 산식은 단위테스트를 먼저 작성한다(Q-2).
3. 필요한 Spring API와 `ProposalExecutor` 타입을 추가한다.
4. 스케줄과 승인함 카드 렌더러를 추가한다.
5. `.claude/agents/`에 같은 역할의 서브에이전트를 두면 개발 중 대화형으로 시험할 수 있다(선택).

---

## 5. Phase 3 — 에이전트 8종 상세

공통 출력 스키마(기본형):
```json
{ "summary": "string (3~5문장, 결론 먼저)",
  "findings": [{"severity":"high|medium|low","title":"","detail":"","refs":{"ingredientId":0}}],
  "proposals": [{"type":"…","payload":{},"rationale":""}],
  "concerns": ["string"] }
```

---

### AG-1. 발주 참모 (Order Advisor) — 기존 확장
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 점주가 매일 추천을 보고 직접 발주하던 일 |
| 트리거 | 매일 08:00 (매장별) + 수동 |
| 이미 있는 것 | `fgcli/planner.py`(observe·build_plan·crosscheck·fingerprint), `fgagent/order_advisor.md`, `advisor.SCHEMA`, `executor.place_orders` |
| 도구 | `predictions, recipe, inventory, orders, sales, weekly` |
| 제안 타입 | `ORDER_CREATE` (payload: `items[{ingredientId, qty, unit}]`, `fingerprint`) |

**단계**
- [ ] 1. `fgagent/agents/order_advisor.py`: `observe`/`decide`는 `planner.observe`/`build_plan`을 그대로 호출한다. 예측이 오래됐거나 누락이면 재예측 트리거(화이트리스트) 후 재관찰한다. 이 로직은 `fgagent/__main__.run_order`에 있으니 함수로 추출해 재사용한다.
- [ ] 2. LLM 검토는 기존 `order_advisor.md`와 SCHEMA를 공통 `loop.py`로 실행한다. `apply_review`(줄이기·보류만 반영, `suggestedQty ≤ orderQty` 강제)도 재사용한다.
- [ ] 3. `recommendation == "wait"`이면 제안 없이 알림만 남긴다. `execute/revise`이면 `ORDER_CREATE` 제안 1건(전 항목 묶음)을 만든다. 만료는 당일 23:59.
- [ ] 4. `ProposalExecutor.ORDER_CREATE`: 승인 시점에 서버에서 같은 산식으로 fingerprint를 재계산한다. fingerprint 입력(재고·대기발주·예측)을 Java로 이식하거나, 간단히 하려면 승인 시 agent-service `POST /fingerprint/{storeId}`를 호출해 비교한다. 같으면 항목별 `OrderRequestService` 생성을 수행한다.
- [ ] 5. 승인함 카드: 품목 표(필요량·재고·대기발주·발주량·판정), concerns, risks(`stockout/below_threshold/awaiting_delivery/waste/no_demand`) 배지.
- [ ] 6. 테스트: 기존 `test_planner.py` 유지, fingerprint 불일치 시 STALE 처리 테스트.

**완료 기준:** 08:00 스케줄 → 승인함에 발주안 → 점주 승인 → `ORDER_REQUEST` 생성 → AGENT_RUN 검증 단계에서 대기발주 반영 확인.

---

### AG-2. 폐기 위험 에이전트 (Waste Guard) ⭐ 핵심 차별화
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 미구현 `/waste-prediction` 화면 + 점주의 "뭐가 남아서 버려질까" 판단 |
| 트리거 | 매일 09:00 + 수동 |
| 선행 | D-2(원장), D-3(유통기한) |
| 도구 | `inventory, predictions, recipe, sales, weekly, waste(조회), txns` |
| 제안 타입 | `DISCOUNT_SUGGEST`(정보성, 실행 시 알림 + 체크리스트), `ORDER_REDUCE`(AG-1 다음 발주안의 해당 품목 감축 힌트), `DONATION_CREATE`(→ AG-3로 인계), `WASTE_RECORD`(이미 만료된 로트 폐기 처리) |

**결정적 산식 (Spring `WastePredictionService`에 구현해 화면과 에이전트가 공유)**
```
각 (store, ingredient) 의 유효 로트 L 마다 (FIFO 순):
  daysLeft      = L.expiry_date − today            (expiry NULL 이면 제외)
  horizon       = clamp(daysLeft, 0, 7)
  consumption   = Σ_{d=1..horizon} Σ_menu predicted_qty(menu,d) × recipe_qty(menu,ingredient) [기준단위]
                  − (앞선 로트가 이미 소진하는 양)       ← FIFO 누적
  wasteQty      = max(0, L.remaining_qty − consumption)
식자재 단위 합계:
  currentQty, expiryDate(=가장 이른 위험 로트), daysUntilExpiry,
  expectedConsumption, wastePrediction = Σ wasteQty,
  wasteRate = wastePrediction / currentQty
  riskLevel = HIGH (daysUntilExpiry ≤ 2 && wasteRate ≥ 0.3) | MEDIUM (wasteRate ≥ 0.15) | LOW
```
- 예측이 없으면 최근 14일 평균 판매로 대체하고 `basis: "fallback_avg"`를 표시한다.
- 레시피가 없는 메뉴는 소모를 0으로 보고 `warnings`에 넣는다.

**단계**
- [ ] 1. Spring `service/WastePredictionService` + `controller/WastePredictionController`
  - `GET /api/waste-prediction/{storeId}` → 위 필드 배열. **프론트가 기대하는 이름에 정확히 맞춘다:** `inventoryId, ingredientId, ingredientName, currentQty, expiryDate, daysUntilExpiry, expectedConsumption, wastePrediction, wasteRate`, 그리고 `unit, riskLevel, basis`
  - `GET /api/waste-prediction/{storeId}/summary` → `{ totalItems, highRisk, mediumRisk, expectedWasteKg, expectedWasteValue(원가 미정이면 null) }`. 작성 전 `WastePrediction.tsx`의 summary 사용부를 확인해 이름을 맞춘다.
  - `StoreAccessGuard.assertCanAccessStore` 적용
- [ ] 2. 단위테스트: FIFO 2로트, 예측 0, 유통기한 NULL, 단위 g→kg 레시피.
- [ ] 3. fgcli에 `waste <storeId>` 커맨드를 추가한다(COMMANDS 딕셔너리에 1줄 + NEEDS_STORE_ID).
- [ ] 4. `fgagent/agents/waste_guard.py`: observe = 위 API + 최근 7일 판매 추이 + 메뉴·레시피. decide(결정적)는 HIGH/MEDIUM 품목마다 대응 후보를 만든다.
  - (a) 그 식자재를 많이 쓰는 메뉴 Top 2 → 할인·추천 메뉴 후보
  - (b) 다음 발주 감축량 = `wastePrediction`(AG-1 planner에 힌트로 전달)
  - (c) `daysUntilExpiry ≥ 1`이고 기부 가능 카테고리면 기부 후보 수량 = `wastePrediction × 0.8`
  - (d) 이미 만료된 로트는 폐기 등록 후보
- [ ] 5. 프롬프트 `waste_guard.md`: "수량을 바꾸지 말고, 후보 중 무엇을 먼저 할지 우선순위와 이유를 점주 말투로 설명한다. 식품 안전상 만료된 식자재는 할인·기부 대상이 아님을 지킨다." 출력은 공통 스키마.
- [ ] 6. 제안을 생성하고, HIGH 품목은 알림(`type=WASTE`)을 직접 생성한다(화이트리스트).
- [ ] 7. AG-1 연계: `planner.build_plan`에 선택 인자 `waste_hints: {ingredientId: reduceQty}`를 추가해 `orderQty = max(0, orderQty − reduceQty)`로 하고 reason에 기록한다. 기존 테스트는 인자 없이도 통과해야 한다.
- [ ] 8. 프론트: P0-3에서 숨긴 메뉴를 복구한다. `WastePrediction.tsx`의 기존 컬럼에 `riskLevel` 칩과 "에이전트 제안 보기"(승인함 필터 링크)를 추가한다.

**완료 기준:** 화면이 실데이터로 표시되고, HIGH 품목에 대해 승인함에 할인·감축·기부 제안이 생기며, 다음 날 발주안에 감축이 반영된다.

---

### AG-3. 기부 매칭 에이전트 (Donation Matcher)
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 미구현 `/donations` + 점주가 기부처를 찾고 연락하던 일 |
| 트리거 | AG-2가 `DONATION_CREATE` 후보를 냈을 때(이벤트) |
| 선행 | AG-2, D-4 |
| 제안 타입 | `DONATION_CREATE` |

**데이터 (마이그레이션 `008_donation.sql`)**
```sql
CREATE TABLE IF NOT EXISTS DONATION_ORG (
  org_id BIGINT AUTO_INCREMENT PRIMARY KEY, org_name VARCHAR(100) NOT NULL,
  org_type VARCHAR(30) NOT NULL,        -- FOOD_BANK, SHELTER, CHILD_CENTER, ...
  region VARCHAR(50) NOT NULL, accepts_categories VARCHAR(255) NULL,  -- 쉼표 구분 INGREDIENT.category
  contact VARCHAR(100) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE);
CREATE TABLE IF NOT EXISTS DONATION (
  donation_id BIGINT AUTO_INCREMENT PRIMARY KEY, store_id BIGINT NOT NULL, ingredient_id BIGINT NOT NULL,
  org_id BIGINT NULL, quantity DECIMAL(12,3) NOT NULL, donation_type VARCHAR(20) NOT NULL, -- INGREDIENT, MEAL
  status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',     -- REQUESTED, COMPLETED, CANCELLED
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME NULL, created_by BIGINT NULL);
```
- 시연용 기부처 데이터는 **"예시 기관"으로 명확히 표기한 가상 데이터**로 넣는다(실존 기관명·연락처 사용 금지).

**단계**
- [ ] 1. Spring `DonationController` — 프론트 `donationService.ts` 계약에 맞춘다.
  - `POST /api/donations/{storeId}` body `{ingredientId, quantity, orgId, donationType}` → `REQUESTED`
  - `POST /api/donations/{id}/complete` → `COMPLETED` + `InventoryLedger.apply(−qty, DONATION)`(**재고 차감은 완료 시점**)
  - `POST /api/donations/{id}/cancel` → `CANCELLED`
  - `GET /api/donations/store/{storeId}` → `DonationHistory.tsx` 필드 `id, createdAt, ingredientName, donationType, orgType, orgName, quantity, status`
  - 가드: `assertCanAccessDonation(id)`를 `StoreAccessGuard`에 추가한다(엔티티 → 매장 역추적).
- [ ] 2. `GET /api/donation-orgs?region=&category=`
- [ ] 3. `fgagent/agents/donation_matcher.py`
  - decide(결정적): 매장 `region` 일치 → `accepts_categories`에 식자재 category 포함 → 활성 기관 후보 목록. 수량은 AG-2 산출값을 그대로 쓴다.
  - LLM: 후보 중 추천 1곳과 이유, **기부 요청 메시지 초안**(점주가 복사해 직접 보냄. 에이전트는 외부로 발송하지 않음)
  - 제안 `DONATION_CREATE` payload `{ingredientId, quantity, orgId, donationType:"INGREDIENT"}` + `draftMessage`
- [ ] 4. 안전 규칙(프롬프트 + 코드 이중): `daysUntilExpiry < 1`이면 후보에서 제외하고, 냉장·냉동 식자재는 "콜드체인 확인 필요" concern을 강제한다.
- [ ] 5. 프론트: `WastePrediction.tsx`의 기부 다이얼로그가 기관 목록 API를 쓰게 하고, `DonationHistory.tsx`의 완료·취소 버튼을 확인한다.

**완료 기준:** 폐기 위험 → 기부 제안 → 승인 → 기부 요청 생성 → 완료 처리 시 재고 차감·원장 기록 → 기부 이력 화면 표시.

---

### AG-4. 본사 발주 심사 에이전트 (HQ Order Reviewer)
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 본사 관리자가 `AdminOrders.tsx`에서 발주를 하나씩 보고 승인·거절하던 판단 |
| 트리거 | 발주 생성 이벤트(`REQUESTED`) → Spring이 agent-service `POST /run/hq_review?orderIds=`를 비동기 호출. 실패해도 발주 생성에는 영향 없음 |
| 도구 | `orders-all, stores, weekly-all, predictions, inventory, recipe` (HQ 범위 GET) |
| 제안 타입 | `ORDER_FLAG` (payload `{orderId, score, flags[], recommendation: approve|review|reject}`) — **승인·거절은 여전히 관리자가 기존 버튼으로** |

**결정적 이상점수 (0~100)**
```
ratio_plan   = ordered_qty / planner 필요량(같은 매장·식자재, 7일)         → >1.5: +30, >2: +45
ratio_hist   = ordered_qty / 최근 4주 동일 식자재 평균 발주량              → >2: +25
stock_cover  = (현재고 + 대기발주) / 7일 소요량                           → >1.2 인데 발주: +20
dup          = 24h 내 동일 매장·식자재 REQUESTED 존재                      → +15
waste_link   = AG-2 HIGH 품목                                            → +15
score = min(100, Σ);  ≥60 reject 권고, 30~59 review, <30 approve
```
**단계**
- [ ] 1. `fgagent/agents/hq_review.py`에 산식 + 단위테스트를 작성한다.
- [ ] 2. LLM은 점수 근거를 관리자용 2~3문장으로 설명한다. **점수와 권고는 산식 결과를 그대로 쓴다.**
- [ ] 3. Spring: `ORDER_FLAG`는 승인함에 넣는 대신 발주 목록에 병합해 보여준다. `GET /api/orders/admin/all`에 `agentFlag` 필드를 추가하거나 `GET /api/agent/proposals?type=ORDER_FLAG` 조회로 처리한다.
- [ ] 4. 프론트 `AdminOrders.tsx`: 위험 점수 칩(색), 툴팁에 근거, "점수 높은 순" 정렬. 기존 승인·거절 버튼은 그대로 둔다.
- [ ] 5. 일일 요약(선택): 매일 18:00 본사 대상 "오늘 발주 n건, 위험 m건" 알림.

**완료 기준:** 과다 발주 테스트 데이터(**직접 `POST /api/orders`로 생성, R2 주의: 판매 API 사용 금지**)에 대해 점수 ≥60과 근거가 표시된다.

---

### AG-5. 예측 운영 에이전트 (MLOps)
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 사람이 수동으로 재학습하고 성능을 확인하던 일 + 보고서 정확도 산출 |
| 트리거 | 매일 07:00 |
| 선행 | D-1 |
| 도구 | `accuracy, predictions, sales, ai-health` |
| 직접 실행 | 재예측(한도), **챌린저 학습** |
| 제안 타입 | `MODEL_PROMOTE` (챌린저 → 운영 교체) |

**단계**
- [ ] 1. ai-service 모델 버전 관리: `trained_models/store_{s}_menu_{m}.joblib`(운영, 챔피언)과 `trained_models/challenger/…`, `trained_models/archive/{timestamp}/…`(교체 시 백업).
  - `POST /api/train/store/{id}?target=challenger`: 챌린저만 학습한다.
  - `POST /api/train/store/{id}/promote`: 챔피언을 archive로 옮기고 챌린저를 승격한다. 내부 토큰 필요, Spring `ProposalExecutor.MODEL_PROMOTE`만 호출.
  - `POST /api/train/store/{id}/rollback?to=<timestamp>`
  - `model_version`을 `PREDICTION_LOG`에 기록한다(컬럼이 이미 있음).
- [ ] 2. 백테스트 비교: `ml/backtest.py`에 `--model challenger` 옵션을 추가한다. 같은 기간·같은 메뉴로 챔피언과 챌린저의 WAPE를 계산한다.
- [ ] 3. `fgagent/agents/mlops.py` decide(결정적)
  ```
  live_wape_7d  = /api/accuracy?source=live (최근 7일)
  base_wape     = 요일평균 기준선 WAPE (accuracy_service 가 제공)
  drift         = live_wape_7d − backtest_wape(최근)  ;  stale = 마지막 학습 후 신규 판매 ≥ 7일
  if drift > 5%p or stale or live_wape_7d > base_wape:
       챌린저 학습 → 백테스트 → if challenger_wape < champion_wape − 1%p: MODEL_PROMOTE 제안
  예측 누락 메뉴(레시피 있음) → 재예측 트리거
  get_coords 서울 폴백 경고(ai-service 로그/응답) → findings
  ```
- [ ] 4. LLM은 운영자용 리포트를 작성한다: "무엇이 나빠졌고, 왜 그럴 수 있고, 교체하면 무엇이 좋아지나". confidence ≠ 확률(R6)을 지킨다.
- [ ] 5. 결과는 알림(`type=ACCURACY`) + 승인함. 승인 권한은 HQ만.
- [ ] 6. 보고서용 `python -m fgagent report accuracy`로 매장·메뉴별 WAPE 표를 만든다(markdown) → R-1.

**완료 기준:** 의도적으로 판매 패턴을 바꾼 테스트(백테스트 기간 조정)에서 챌린저 학습 → 교체 제안 → 승인 → 승격 → 롤백까지 확인한다.

---

### AG-6. 데이터 품질 감사 에이전트 (Data Auditor) — 기존 서브에이전트 정기화
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 사람이 DB·화면을 훑어 이상 데이터를 찾던 일 |
| 트리거 | 매일 06:30 (전 매장) |
| 이미 있는 것 | `.claude/agents/foodguard-auditor.md`(점검 항목·코드 추적 방식) |
| 출력 | findings + 알림. 제안은 `INVENTORY_ADJUST`(선택, 승인 필요) |

**결정적 점검 목록 (각각 함수 1개 + 테스트)**
1. 음수 재고, 임계치 0 또는 NULL
2. 활성 메뉴인데 레시피 없음 → 재고 차감·발주 누락 원인
3. 레시피 단위 비호환(`UnitConverter` 허용표 밖) — 재발 감시
4. 7일 넘게 `REQUESTED/APPROVED/HQ_SENT`에 머문 발주 (AG-7과 공유)
5. `STORE.region`이 좌표 매핑에 실패(서울 폴백)
6. 판매 데이터 공백(최근 n일 0건) → 예측 신뢰도 하락
7. (D-2 이후) 원장 합계 ≠ 현재 재고
8. 같은 이름 식자재 중복(R9) — 신규 생성 감시

**단계**
- [ ] 1. `fgagent/agents/auditor.py`: 위 점검을 fgcli GET으로 수행한다(DB 직접 접근 금지 → 권한 모델 유지).
- [ ] 2. LLM은 심각도 정렬과 "누가 무엇을 하면 되는지" 한 줄 조치를 쓴다. 코드 원인 추적은 런타임 에이전트가 아니라 **개발용 서브에이전트(`foodguard-auditor`)의 몫**으로 남긴다.
- [ ] 3. 결과 `AGENT_RUN` + HIGH는 알림. 승인함에는 정보 카드로 표시한다.

---

### AG-7. 입고 추적 에이전트 (Inbound Tracker)
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 점주·본사가 "발주한 거 왜 안 오지?"를 일일이 확인하던 일 |
| 트리거 | 매시 정각 |
| 직접 실행 | 알림 생성(화이트리스트, dedup) |

**규칙 (결정적, SLA는 `application.properties`에서 설정)**
```
REQUESTED        > 24h  → 본사에 "승인 지연"
APPROVED/HQ_SENT > 48h  → 본사·점주에 "출고 지연"
DRIVER_RECEIVED  > 12h  → 점주에 "배송 미완료" (+ 배달 토큰 만료 임박 B-2)
지연 품목이 AG-2 stockout 위험이면 severity=high
```
**단계**
- [ ] 1. `fgagent/agents/inbound.py`에 규칙 + 테스트를 작성한다. 시각 기준은 `ordered_at`, `approved_at`, `updated_at`.
- [ ] 2. LLM은 기본적으로 쓰지 않는다(템플릿 문장). 하루 1회 요약에서만 LLM을 쓴다. **모든 에이전트가 LLM을 쓸 필요는 없다**는 점을 발표에서 설계 포인트로 언급할 수 있다.
- [ ] 3. 알림 수신자: 현재 `NotificationService.create()`는 매장 소유 점주에게만 보낸다. 본사 수신이 필요하면 HQ 사용자 대상 생성 로직을 추가한다(`type=ORDER`).

---

### AG-8. 리포트·질의 에이전트 (Store Copilot, 챗)
| 항목 | 내용 |
|---|---|
| 대체하는 일 | 통계 화면 해석, 주간 보고서 작성, "왜?" 질문에 답하기 |
| 트리거 | 사용자 채팅(실시간) + 매주 월 08:00 주간 브리핑 |
| 인증 | **사용자 본인 JWT 위임**(AGENT 계정 아님) → 점주는 자기 매장만, HQ는 전체(기존 원칙 ① 그대로) |
| 도구 | fgcli 전체 읽기 커맨드 + `waste`, `txns`, `accuracy`, `plan` |
| 쓰기 | 없음. "발주해줘"라고 하면 → AG-1 수동 실행을 트리거해 **승인함으로 안내** |

**단계**
- [ ] 1. Spring `POST /api/agent/chat`(인증 필요): 요청 사용자의 JWT를 agent-service `POST /chat`으로 전달한다(헤더 `X-User-Token`, 내부 토큰 동반). agent-service는 그 토큰으로 `FoodGuardClient`를 만든다 → 서버 권한 검사가 그대로 적용된다.
- [ ] 2. 스트리밍: agent-service는 SSE로 텍스트 delta를 보내고, Spring은 `SseEmitter`로 프록시한다. MVP는 비스트리밍 응답도 괜찮다.
- [ ] 3. 대화 기록은 프론트 상태(세션)에만 둔다. 서버에는 `AGENT_RUN(trigger=CHAT)`에 질문·도구호출·토큰만 기록하고 답변 전문은 선택으로 한다.
- [ ] 4. 시스템 프롬프트 핵심
  - 숫자는 반드시 도구 결과에서 가져오고 출처(어느 조회)를 밝힌다.
  - confidence ≠ 확률, 합성 데이터 고지
  - 권한 거부는 그대로 보고하고 우회하지 않는다
  - 실행 요청은 승인함으로 안내한다
- [ ] 5. 프론트: `components/CopilotDrawer.tsx`(Topbar 버튼으로 열기). 예시 질문 칩: "이번 주 소고기 발주가 왜 많아?", "폐기 위험 TOP3", "지난주 대비 매출".
- [ ] 6. 주간 브리핑: 같은 루프로 `weekly, waste, accuracy, orders`를 요약해 알림 + 승인함 정보 카드로 보낸다. HQ용은 `weekly-all` 기반 매장 비교.
- [ ] 7. 가드레일 테스트: OWNER 토큰으로 "다른 매장 매출 알려줘" → forbidden 보고, 우회 시도 없음.

---

## 6. Phase 4 — 통합·시연

### IN-1. "오늘의 에이전트 브리핑" 화면
- [ ] `Dashboard.tsx` 상단(또는 `/agent-inbox` 첫 탭)에 카드 4개를 둔다.
  1. 발주안(AG-1): 승인 대기 n건, 총 발주량
  2. 폐기 위험(AG-2): HIGH n개, 예상 폐기량, 기부 후보
  3. 예측 건강도(AG-5): 최근 7일 WAPE, 기준선 대비, 모델 교체 제안 여부
  4. 데이터·입고 이슈(AG-6/7): HIGH 건수
- [ ] 각 카드에서 승인함 필터로 이동하고, 전체 승인 흐름이 3클릭 안에 끝나게 한다.
- [ ] 본사(HQ) 버전: 매장별 위험 히트맵(AG-4 점수 + AG-2 HIGH 수).

### IN-2. 시연 시나리오 (7분)
1. (30s) 문제 제기: 프랜차이즈 식자재 폐기·품절
2. (1m) 아키텍처 한 장: "LLM은 판단·설명, 수량은 결정적 코드, 실행은 사람 승인" (§0.2 R4·R5)
3. (1m30s) 아침 브리핑 화면 → 발주안 승인 → 발주 생성 확인
4. (1m30s) 폐기 위험 → 할인·기부 제안 → 기부 승인 → 재고 차감·이력
5. (1m) 본사 화면: 과다 발주 위험 점수 → 관리자 거절
6. (1m) Copilot: "왜 소고기를 많이 시켜?" + 권한 밖 질문 거부 시연
7. (30s) 정확도·폐기율 수치(합성 데이터 고지 포함) + 한계와 향후 과제
- 백업: P0-5 녹화본, `?replay=` 모드

---

## 7. 진행 체크리스트 (요약)

- [ ] P0-1 비밀정보 · [x] P0-2 커밋 (push 대기) · [ ] P0-3 미구현 화면 · [ ] P0-4 합성 고지 · [ ] P0-5 시연 백업
- [ ] B-1 AI 내부 인증 · [ ] B-2 배달 토큰 · [ ] B-3 프로필 · [ ] B-4 HTTP 코드
- [ ] D-1 예측 로그 · [ ] D-2 재고 원장 · [ ] D-3 유통기한 · [ ] D-4 폐기 기록 · [ ] D-5 판매 단가 · [ ] D-6 이벤트(선택)
- [ ] Q-1 백엔드 테스트 · [ ] Q-2 에이전트 산식 테스트 · [ ] C-1 레포 정리 · [ ] R-1 보고서
- [ ] AG-0 공통 기반 (0.1 Spring · 0.2 agent-service · 0.3 승인함 · 0.4 더미 검증)
- [ ] AG-1 발주 참모 · [ ] AG-2 폐기 위험 · [ ] AG-3 기부 매칭 · [ ] AG-4 본사 심사
- [ ] AG-5 MLOps · [ ] AG-6 데이터 감사 · [ ] AG-7 입고 추적 · [ ] AG-8 Copilot
- [ ] IN-1 브리핑 화면 · [ ] IN-2 시연 리허설

### 마이그레이션 파일 번호표 (충돌 방지)
| 번호 | 파일 | 작업 |
|---|---|---|
| 001 | `001_prediction_log.sql` | D-1 (존재) |
| 002 | `002_delivery_token_expiry.sql` | B-2 |
| 003 | `003_inventory_txn.sql` | D-2 |
| 004 | `004_shelf_life_lot.sql` | D-3 |
| 005 | `005_waste_record.sql` | D-4 |
| 006 | `006_sales_unit_price.sql` | D-5 |
| 007 | `007_agent.sql` | AG-0 |
| 008 | `008_donation.sql` | AG-3 |
| 009 | `009_store_event.sql` | D-6 (선택) |

### 환경변수 총정리 (값은 절대 커밋 금지)
| 위치 | 키 |
|---|---|
| backend | `DB_URL, DB_USERNAME, DB_PASSWORD, JWT_SECRET, AI_SERVICE_URL, INTERNAL_API_TOKEN, AGENT_SERVICE_URL` |
| ai-service/.env | `DB_URL, INTERNAL_API_TOKEN, CORS_ORIGINS, FOODGUARD_OWNER_*, FOODGUARD_HQ_*, FOODGUARD_AGENT_EMAIL, FOODGUARD_AGENT_PASSWORD` |
| agent-service | `ANTHROPIC_API_KEY`(없으면 `claude -p` 폴백), `AGENT_MODEL_<NAME>`, `INTERNAL_API_TOKEN`, `FOODGUARD_API_BASE` |
