# 브랜치 정리안 (v3 STEP 4)

작성 2026-10-30 · 기준 `origin` fetch 시점 · **병합·체리픽은 하지 않았다. 팀 합의용 제안이다.**

## 1. 지금 브랜치 지형

| 브랜치 | 최신 커밋 | 기준 | 상태 |
|---|---|---|---|
| `dev` | `4456767` (10-16) | — | 팀 통합 브랜치 |
| `jihwan` (김지환) | `2b93a76` (10-30) | dev 위 +13 | 인계 문서·CI·글로벌 모델·권한 검사·폐기 기록. `hyeon`, `HYEON`도 같은 커밋 |
| `junho` (서준호) | `60851fb` (10-30) | **5/22 `00e62e2`에서 갈라짐, dev에 합쳐진 적 없음** (dev 대비 +22 / −26) | POS 재설계, 레시피 차감, 보안, 에이전트, PREDICTION_LOG, 로드맵 |
| `feat/security-agent` | `dda675c` (10-16) | junho의 중간 지점 | **junho에 전부 포함** → 따로 볼 필요 없음 |
| `jhy` (지현윤) | `6ed2e43` (10-30) | dev 위 +2 | jihwan과 중복 (아래 4절) |
| `dev2`, `master` | 5월·4월 | — | 옛 브랜치, 정리 대상 |

충돌 규모 (`git merge-tree --write-tree --name-only`):
- `jihwan` ← `junho`: **38개 파일** (CI, AI 모델·예측 서비스, 백엔드 발주·재고·식자재·메뉴, 프론트 화면 대부분)
- `jihwan` ← `jhy`: 16개 파일

## 2. 가장 큰 방향 차이 (팀이 먼저 정할 것)

| 주제 | jihwan | junho | 제안 |
|---|---|---|---|
| DB 스키마 변경 | `ddl-auto=update` (엔티티 바꾸면 기동 시 공유 TiDB가 바로 바뀜) | `ddl-auto=none` + `migrations/NNN_*.sql`, 사람이 실행 (로드맵 R1) | **junho 방식 채택 권장.** 공유 DB를 여러 PC에서 띄우는 구조라 안전. jihwan 인계 문서도 같은 위험을 경고함 |
| 비밀 값 | `backend/.env` | **`application.properties`에 평문 DB 비밀번호·JWT 키** (10/16 이전 노출 값과 같음) | jihwan 방식. junho 브랜치 평문 제거 필요. TiDB 비밀번호 교체(I-14)로 무력화 |
| LLM 사용 | 발주 근거 설명, 특이사항 수치화 (Claude CLI, AI 서비스 내부) | 발주 참모 에이전트(관찰→판단→발주안→Claude 검토→사람 승인→실행), `fgcli`, 서브에이전트, 로드맵상 8종 | 원칙은 같음("LLM은 수량을 계산하지 않음"). **jihwan을 기반으로 junho 에이전트를 옮기는 순서** 권장 |
| POS 화면 | 기존 POS | EasyPOS 스타일 재설계, 메뉴 설정 다이얼로그, 레시피·사진 | 화면 선택은 팀 결정 (기능 차이보다 UI 차이) |
| 매출 시 재고 차감 | 없음 (발주 완료 시 입고만) | 판매 시 레시피×수량×(1+오차%)로 자동 차감, 결제 후 부족분 자동 발주 | 재고 의미가 바뀌는 큰 결정. 폐기율 계산(입고 대비)과도 연결되므로 팀 결정 |

## 3. junho 커밋 22개 판정

판정: **이미 있음** (jihwan에 같은 기능) / **옮길 만함** (jihwan에 없고 가치 있음) / **팀 결정** / **버림**

| 커밋 | 날짜 | 내용 | 판정 | 근거 |
|---|---|---|---|---|
| `c007862` | 05-22 | 로그인 CORS(5174~5179 포트), fetch 10초 타임아웃, 로딩 버그 | 옮길 만함 (작게) | jihwan `CorsConfig`는 5173만, `api.ts`에 타임아웃 없음 |
| `86682db` | 05-29 | 설계도 PDF 삭제 | 버림 | 문서 정리, 의미 없음 |
| `a44e2d7` | 05-29 | 메뉴 설정 다이얼로그, POS 주문 확정 흐름 | 팀 결정 | POS UI 선택 |
| `faa707a` | 06-05 | POS EasyPOS 스타일 재설계, 로그인·결제 버그 | 팀 결정 | jihwan POS와 +291/−668 차이 |
| `9f32815` | 06-05 | 6월 시점 jihwan 프론트 병합(POS는 junho 유지) | 버림 | 6월 병합본, jihwan 프론트가 이후 크게 바뀜 |
| `5f1ec4a` | 06-05 | 판매 시 레시피 기반 재고 차감, 결제 후 자동 발주, 메인·메뉴·발주 UI | 팀 결정 | jihwan에 판매 시 차감 없음. 재고 의미 변경 |
| `c16d653` | 06-05 | 재고 긴급도 리스트, 식자재 즉시 등록, 원화 축약 표기 | 팀 결정 (UI) | 프론트 충돌 다수 |
| `23591e7` | 10-16 | StoreAccessGuard, 결함 8건, UnitConverter, GlobalExceptionHandler | 대부분 이미 있음 / 결함 8건은 검토 | jihwan `security/StoreAccess*`(권한 점검 19/19). 결함 8건 상세는 커밋에 목록 없음 → 코드 대조 필요 |
| `cb53f9d` | 10-16 | 읽기 전용 `fgcli`, 서브에이전트 4종, agent-assets 문서 | 옮길 만함 | jihwan에 없음. 사용자 목표(에이전트 반복 작업)와 직결 |
| `62345a5` | 10-16 | uml 갱신 | 버림 | v3 STEP 1에서 jihwan 기준으로 갱신함. ERD·유스케이스만 참고 |
| `9c73041` | 10-16 | GitHub Actions CI | 이미 있음 | jihwan `865af64` (pytest·compileJava·tsc) |
| `469afad` | 10-16 | 단위 규칙 저장 시 강제(UnitConverter), 레시피 단위 호환 검사, ai-service 설정 `extra=ignore` | 옮길 만함 | jihwan에 `UnitConverter` 없음, 식자재 저장 시 단위 검사 없음 |
| `3a55b10` | 10-16 | 발주 참모 에이전트 (사람 승인 후 실행) | 옮길 만함 (cb53f9d와 함께) | jihwan은 설명만 있고 승인 흐름 에이전트 없음 |
| `935a67f` | 10-16 | 예측을 항상 내일부터 7일, 끊긴 구간은 모델로 이어 예측 | 다른 방식으로 이미 있음 | jihwan `predict()`는 `max(마지막 판매일, 오늘)` 다음 날부터 → 보이지 않던 문제는 해결됨. 이어 예측 방식은 차이 |
| `41bca4f` | 10-16 | `agent.cmd` 런처 | 옮길 만함 (에이전트와 함께) | |
| `fc1e0a3` | 10-16 | 에이전트: 레시피 있는 메뉴 예측 누락 재예측, 초기 실패 기록 | 옮길 만함 (에이전트와 함께) | |
| `dda675c` | 10-16 | Hikari max-lifetime 3분·keepalive 1분, AI `pool_recycle` 180초, 에이전트 경고 | **옮길 만함 (우선)** | jihwan에 Hikari 설정 없음, `pool_recycle=3600`. TiDB가 유휴 연결을 먼저 끊어 500 오류가 나던 실제 장애 대응 |
| `42b8caa` | 10-30 | AI: 조회 직후 트랜잭션 종료 (TiDB Lost connection) | 비슷한 것이 있음 → 확인 | jihwan `data_service.py`는 조회 후 `db.rollback()`(`:78,116,153`). 같은 효과인지 대조 필요 |
| `73a4fd5` | 10-30 | **PREDICTION_LOG(지우지 않는 예측 이력) + 백테스트 + `GET /api/accuracy`** | **옮길 만함 (우선)** | jihwan에 없음 → I-07 해결책. 운영 중 정확도 추적 가능 |
| `5aaf54b` | 10-30 | `fgcli accuracy` 커맨드 | 옮길 만함 (에이전트와 함께) | |
| `0ad5259` | 10-30 | 팀 포트폴리오 pptx 생성 스크립트 | 선택 | 기능과 무관 |
| `60851fb` | 10-30 | `DEV_ROADMAP.md` (보완 작업 + 에이전트 8종) | **옮길 만함 (문서)** | 팀 공통 계획으로 쓸 수 있음. jihwan 인계 문서와 합쳐 하나로 |

## 4. jhy 커밋 처리

| 커밋 | 내용 | 판정 |
|---|---|---|
| `5d60e6f` | 비밀 값 분리(`application-local.properties`), 권한 검사(`StoreAccessService`), HQ 가입 차단 | **버림** — jihwan의 `.env`·`StoreAccess*`와 기능 중복, 방식 다름 |
| `6ed2e43` | lag 수정, 오프라인 백테스트, 본사 주간 매출 API, tsc 정리, 통계 예시 안내 | **버림** — jihwan이 같은 기능을 더 깊게 구현 |
| (미커밋) `agent/`, 연구·점검 HTML | 지령서·문제 목록·보고서 수정안·브랜치 정리안 | **살림** — jihwan 위에 문서로 커밋 |
| (stash) CLAUDE.md·uml 수정 | jhy 기준 문서 | **버림** — jihwan 기준으로 v3 STEP 1에서 다시 함 |

`jhy` 원격 브랜치는 dev에 합치지 않고, 팀 합의 후 삭제하거나 그대로 보관한다.

## 5. 권장 순서

1. **(사람) TiDB 비밀번호·JWT 키 교체** — junho 평문 노출과 옛 이력 노출을 동시에 해결 (I-14)
2. **(팀) 2절 방향 차이 결정** — 특히 DB 스키마 정책(ddl-auto vs 마이그레이션), POS 화면, 판매 시 재고 차감
3. **기준 브랜치 = jihwan.** dev에 jihwan을 먼저 합친다 (jihwan은 dev 위에 있어 충돌 없음)
4. junho에서 **"옮길 만함 (우선)"** 3개를 jihwan 기준으로 다시 구현하거나 체리픽: `dda675c` 연결 설정, `73a4fd5` PREDICTION_LOG·정확도 API, `469afad` 단위 규칙
5. 에이전트 묶음(`cb53f9d`, `3a55b10`, `41bca4f`, `fc1e0a3`, `5aaf54b`)과 `DEV_ROADMAP.md`를 jihwan 위로 옮긴다 (서준호 님이 직접 하는 것이 충돌 해결에 유리)
6. 팀 결정 항목(POS, 판매 시 차감, UI)은 결정 후 별도 작업
7. `jhy`의 문서(`agent/` 등)만 jihwan 위에 커밋

체리픽은 junho가 5월 기준이라 대부분 충돌한다. 기능 단위로 "jihwan 코드에 맞춰 다시 구현"하는 편이 빠를 수 있다.

## 부록. 충돌 예상 파일 전체 목록

### jihwan ← junho (38개)
- `.github/workflows/ci.yml`
- `.gitignore`
- `ai-service/main.py`
- `ai-service/ml/demand_predictor.py`
- `ai-service/seed_ingredients.py`
- `ai-service/services/prediction_service.py`
- `backend/src/main/java/com/foodguard/config/GlobalExceptionHandler.java`
- `backend/src/main/java/com/foodguard/controller/InventoryController.java`
- `backend/src/main/java/com/foodguard/controller/MenuController.java`
- `backend/src/main/java/com/foodguard/controller/MenuIngredientController.java`
- `backend/src/main/java/com/foodguard/controller/OrderRequestController.java`
- `backend/src/main/java/com/foodguard/controller/SalesDataController.java`
- `backend/src/main/java/com/foodguard/entity/OrderRequest.java`
- `backend/src/main/java/com/foodguard/filter/JwtFilter.java`
- `backend/src/main/java/com/foodguard/repository/InventoryRepository.java`
- `backend/src/main/java/com/foodguard/security/AuthUser.java`
- `backend/src/main/java/com/foodguard/service/IngredientService.java`
- `backend/src/main/java/com/foodguard/service/MenuIngredientService.java`
- `backend/src/main/java/com/foodguard/service/OrderRequestService.java`
- `frontend/src/App.tsx`
- `frontend/src/components/QrScanner.tsx`
- `frontend/src/layouts/main-layout/Sidebar/Sidebar.tsx`
- `frontend/src/layouts/main-layout/Topbar/Topbar.tsx`
- `frontend/src/layouts/main-layout/index.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/DeliveryDriverGroup.tsx`
- `frontend/src/pages/Ingredients.tsx`
- `frontend/src/pages/Inventory.tsx`
- `frontend/src/pages/MenuManagement.tsx`
- `frontend/src/pages/Orders.tsx`
- `frontend/src/pages/POS.tsx`
- `frontend/src/pages/SalesEntry.tsx`
- `frontend/src/pages/WastePrediction.tsx`
- `frontend/src/pages/admin/AdminOrders.tsx`
- `frontend/src/pages/admin/Stats.tsx`
- `frontend/src/pages/admin/StoreManagement.tsx`
- `frontend/src/services/inventoryService.ts`
- `frontend/src/services/orderService.ts`

### jihwan ← jhy (16개)
- `.gitignore`
- `ai-service/.env.example`
- `ai-service/ml/demand_predictor.py`
- `ai-service/ml/feature_engineering.py`
- `backend/src/main/java/com/foodguard/config/GlobalExceptionHandler.java`
- `backend/src/main/java/com/foodguard/config/SecurityConfig.java`
- `backend/src/main/java/com/foodguard/controller/OrderRequestController.java`
- `backend/src/main/java/com/foodguard/controller/SalesDataController.java`
- `backend/src/main/java/com/foodguard/filter/JwtFilter.java`
- `backend/src/main/java/com/foodguard/repository/SalesDataRepository.java`
- `backend/src/main/java/com/foodguard/service/SalesDataService.java`
- `backend/src/main/java/com/foodguard/util/JwtUtil.java`
- `backend/src/main/resources/application.properties`
- `backend/src/test/java/com/foodguard/service/UserServiceTest.java`
- `frontend/src/pages/admin/Stats.tsx`
- `frontend/src/pages/auth/Signup.tsx`
