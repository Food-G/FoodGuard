# 자산화 과정에서 발견한 결함 — 수정 내역

**2026-11-06** — DEV_ROADMAP C-1 진행 중 발견

### 스크립트에 계정 비밀번호 하드코딩
`ai-service/seed_ingredients.py`, `update_ingredient_units.py`에 점주 계정의 이메일과 비밀번호가 평문으로 있었습니다 (R8 위반).
→ `.env`의 `FOODGUARD_OWNER_EMAIL` / `FOODGUARD_OWNER_PASSWORD`를 읽습니다. **값은 git 히스토리에 남아 있으므로 그 계정의 비밀번호를 바꿔야 합니다.**

**2026-11-06** — DEV_ROADMAP AG-7 진행 중 발견

### 에이전트 알림 24시간 중복 금지가 동작하지 않던 문제
`NOTIFICATION.created_at`은 DB 기본값이 없는데(`DEFAULT NULL`, `SHOW CREATE TABLE` 확인) 엔티티가 `insertable = false`라 항상 NULL로 저장됐습니다.
중복 검사는 `created_at > 24시간 전`을 찾으므로 항상 "없음"이 되어, 같은 알림이 실행할 때마다 새로 만들어졌을 것입니다. 알림 화면의 시각도 비어 있었을 것입니다.
→ 앱이 생성 시각을 넣습니다. 기존 행은 NULL로 남습니다. 코드와 스키마로 찾은 결함이고 DB 접속 거부로 실제 행은 확인하지 못했습니다.
`entity/Notification.java`, `service/NotificationService.java`, 테스트 `NotificationServiceTest`

**2026-10-30** — DEV_ROADMAP P0/B/D-1 진행 중 발견

### 매장별 정확도 조회가 "이력 없음"으로 나오던 문제
`accuracy_service.latest_run_id()`가 매장 조건 없이 전체 최신 실행을 고른 뒤 매장으로 필터링해서,
최신 실행에 그 매장이 없으면 `no_log`를 돌려줬습니다. 또 백테스트의 `predicted_at`은 실행 시각이 아니라 기준일이라,
판매 데이터가 늦게 끝나는 매장의 옛 실행이 항상 "최신"으로 뽑혔습니다(TiDB `log_id`도 단조 증가가 아님).
→ 매장을 지정하면 그 매장이 포함된 실행 중에서 고릅니다. 같은 매장 실행 간 순서는 여전히 부정확할 수 있어 docstring에 한계를 남겼습니다
(근본 해결은 `PREDICTION_LOG`에 실행 시각 컬럼 추가 — 마이그레이션 필요).
`ai-service/services/accuracy_service.py`

### `ai-service/.env.example`에 실제 기상청 API 키
예시 파일에 실제 `KMA_API_KEY` 값이 커밋돼 있었습니다. → 빈 값으로 교체. **키 재발급 필요**(히스토리에 남아 있음).


**2026-10-16** — 단위 정리 및 ai-service 기동 오류

### 단위 규칙 강제 (g/kg 1000배 오차 재발 방지)
DB 감사 결과 현재 데이터는 정상(식자재·재고 `kg/L/개`, 레시피는 호환 조합만, 음수 재고 0건)이었으나,
레시피 화면이 아무 식자재에나 `g/ml/개`를 고를 수 있게 했고 서버도 검사하지 않아 비호환 조합이 그대로 저장될 수 있었습니다.
`UnitConverter`는 이런 조합을 환산 없이 통과시켜 재고 차감·발주량이 조용히 어긋났습니다.
→ `UnitConverter`에 허용 조합표를 두고 비호환이면 예외(400). 식자재 등록·수정, 레시피 등록에서 검사.
재고나 레시피가 있는 식자재의 단위 변경은 거부. 레시피 화면은 호환 단위만 표시. `seed_ingredients.py`도 기준 단위로 수정.
`util/UnitConverter.java`, `service/{Ingredient,MenuIngredient}Service.java`, `frontend/src/pages/MenuManagement.tsx`, 테스트 `UnitConverterTest`

### ai-service가 기동하지 않던 문제
fgcli 자격증명(`FOODGUARD_*`)을 `ai-service/.env`에 넣으면 pydantic `Settings`가 모르는 키를 거부해 서버가 뜨지 않았습니다.
→ `config.py`에 `extra: ignore`.

---

**2026-09-11** — `agent-assets/` 작성 중 코드에서 발견한 결함들을 수정했습니다.

## 수정 완료 (8건)

### 1. 알림 생성이 항상 실패하던 버그
`NotificationService.create()`가 `user`를 세팅하지 않는데 `NOTIFICATION.user_id`는 NOT NULL이라, 알림 생성 API가 호출될 때마다 제약 위반으로 실패했습니다.
→ 매장 소유 점주(`STORE.hq_user_id`)를 수신자로 채웁니다. 소유 점주가 없으면 명확한 메시지로 예외를 던집니다.
`backend/.../service/NotificationService.java`

### 2. 서버 측 역할(role) 검사 부재
JWT 유효성만 검사하고 역할 검사가 한 군데도 없어서, OWNER 토큰으로도 본사 전용 API가 열렸습니다. 역할 분리가 프론트엔드 라우팅에만 존재했습니다.
→ `JwtUtil.getRole()` 추가, `JwtFilter`가 `role` 클레임을 `ROLE_OWNER`/`ROLE_HQ_ADMIN` 권한으로 등록, `@EnableMethodSecurity` 활성화, 본사 전용 3개 API에 `@PreAuthorize` 적용:
- `GET /api/orders/admin/all`
- `GET /api/stores`
- `GET /api/sales/all-stores/weekly-summary`

프론트엔드에서 이 3개는 admin 페이지에서만 호출하므로 점주 화면에는 영향이 없습니다.
`util/JwtUtil.java`, `filter/JwtFilter.java`, `config/SecurityConfig.java`, `controller/{OrderRequest,Store,SalesData}Controller.java`

### 3. 실패가 HTTP 200으로 내려오던 문제
"승인된 발주는 취소할 수 없습니다"가 200 응답 본문으로 내려와 클라이언트가 성공/실패를 구분할 수 없었습니다.
→ `IllegalStateException`을 던지고 `GlobalExceptionHandler`가 400으로 변환합니다.
`service/OrderRequestService.java`, `config/GlobalExceptionHandler.java` (신규)

### 4. 발주 상태값 검증 없음
`PUT /api/orders/{id}/status`에 아무 문자열이나 넣으면 그대로 DB에 저장됐습니다.
→ 실제 사용되는 7종(`REQUESTED / APPROVED / HQ_SENT / DRIVER_RECEIVED / DONE / REJECTED / CANCELLED`)만 허용하고 그 외에는 400.

> 처음에는 4종만 허용하도록 넣었다가, 운영 DB에 `REJECTED`(30건)·`DRIVER_RECEIVED`(2건)가 있고 관리자 화면의 "거절" 버튼이 `REJECTED`를 보낸다는 것을 확인하고 7종으로 넓혔습니다. 문서(`01`,`04`)의 상태 목록도 함께 정정했습니다.
`service/OrderRequestService.java`

### 5. 재고 초기화 반복 호출 시 중복 누적
`initInventoryFromOrders()`는 주석에 "발주 합계를 현재 재고로 **설정**"이라 되어 있는데 실제로는 기존 재고에 **가산**해서, 두 번 호출하면 재고가 두 배가 됐습니다.
→ 주석대로 설정(멱등)으로 수정.
`service/OrderRequestService.java`

### 6. 단위 변환 로직 중복
`convertToBaseUnit()`(g→kg, ml→L)이 발주 추천과 재고 차감 두 서비스에 복붙되어 있어, 한쪽만 고치면 발주량과 소모량이 어긋날 수 있었습니다.
→ `util/UnitConverter.toBaseUnit()` 한 곳으로 통합.
`util/UnitConverter.java` (신규), `service/{OrderRequest,SalesData}Service.java`

### 7. 모델 캐시가 무의미했던 문제
`DemandPredictor.load()`로 저장된 모델을 읽어온 직후 무조건 `fit()`으로 덮어써서, 매 예측 호출마다 전체 재학습이 일어났습니다.
→ `matches_history()`(행 수 + 마지막 날짜 + 합계 비교)로 판매 이력이 동일하면 재학습을 건너뜁니다. 강제 재학습은 `POST /api/train/store/{id}`가 그대로 담당합니다.
`ai-service/ml/demand_predictor.py`, `ai-service/services/prediction_service.py`

> ⚠️ 부작용 주의: 이전에 날씨 API 실패로 날씨 없이 학습된 모델은 이력이 같으면 그대로 재사용됩니다. 날씨를 반영하려면 강제 재학습을 쓰세요.

### 8. 과거 날씨 API N+1 호출
매장 예측 시 메뉴마다 같은 좌표·같은 기간의 Open-Meteo 과거 날씨를 반복 호출했습니다 (메뉴 10개면 10번).
→ 매장 전체 판매 기간에 대해 1회만 조회해 전 메뉴가 공유합니다. `get_store_sales_start_date()` 추가.
`ai-service/services/{prediction_service,data_service}.py`

### 부수 수정
- `get_coords()`가 region 매칭 실패 시 조용히 서울 좌표를 쓰던 것 → **경고 로그** 추가 (폴백 동작 자체는 유지).
- `uml/er-diagram.md`, `uml/architecture.md`, `uml/sequence-prediction.md`, `uml/usecase.md` — 발주 상태값(`PENDING/RECEIVED` → `REQUESTED/APPROVED/DONE`), AI 엔드포인트 경로, 없는 컬럼(`prediction_id`, `USER.store_id`), 누락 컬럼(`tolerance`, `approved_at`, `delivery_token`, `image_url`)을 코드에 맞게 정정.

### 9. 매장 소유권 검사 부재 (P0)
역할 검사(2번)는 "본사 전용 API인가"만 막아줘서, OWNER 토큰으로 `storeId`만 바꾸면 남의 매장 데이터가 열렸습니다. 프론트엔드 라우팅이 사실상 가려줬지만 **AI 에이전트는 프론트를 거치지 않으므로** 서버에서 막아야 합니다.

→ `security/AuthUser` (JWT의 id/email/role을 principal로) + `security/StoreAccessGuard` 신규.
- `assertCanAccessStore(storeId)` — `STORE.hq_user_id`와 대조, HQ_ADMIN은 통과
- `assertIsSelf(userId)` — `GET /api/stores/my/{userId}`용
- `assertCanAccessMenu/MenuIngredient/Inventory/Order/Sales/Notification(id)` — **엔티티 id를 받는 PUT/DELETE도** 해당 엔티티의 매장을 역추적해 차단 (id를 바꿔가며 남의 데이터를 수정하는 경로)
- 위반 시 **403**

가드는 **컨트롤러 계층**에 넣었습니다. `OrderRequestService.updateStatus()`는 무인증 배달기사 경로(`DeliveryController`)에서도 호출되므로, 서비스 계층에 넣었다면 배달 완료 처리가 깨졌을 것입니다.
`security/AuthUser.java`(신규), `security/StoreAccessGuard.java`(신규), `util/JwtUtil.java`, `filter/JwtFilter.java`, 컨트롤러 8개

## 보류 (이유 명시)

| 항목 | 왜 안 했는가 |
|---|---|
| ~~매장 소유권 검사~~ | ✅ **2026-09-11 완료** — 아래 9번 항목 참고 |
| `PREDICTION_LOG` / `INVENTORY_TXN` / `WASTE_RECORD` 테이블 추가 | `ddl-auto=none`이고 DB가 공용 TiDB Cloud라 DDL이 팀 합의 사항. 예측 정확도 측정·폐기 분석에 필요하므로 다음 작업 후보 |
| 폐기 예측 / 기부 / QR 수령 API 구현 | 프론트엔드에만 있고 백엔드가 없는 **신규 기능** 개발이라 결함 수정 범위 밖. `06-agent-blueprints.md`의 에이전트 기회 영역 |
| 식자재 단위 규칙 통일 (`g/ml` vs `kg/L` 혼재) | 운영 DB의 기존 데이터 마이그레이션이 필요. 잘못 고치면 발주량이 1000배 어긋날 수 있어 데이터 확인 후 진행해야 함 |
| `application.properties`의 DB 비밀번호·JWT 시크릿 평문 저장 | 자격증명 교체가 동반돼야 하는 작업. 환경변수로 빼는 것을 권장 |
