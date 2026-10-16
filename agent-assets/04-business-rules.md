# 04. 비즈니스 규칙 (코드에서 추출한 실행 로직)

> 출처: `OrderRequestService.java`, `SalesDataService.java`, `InventoryService.java`
> 에이전트가 **직접 계산하거나 검증할 때 쓸 수 있는 정식 산식**입니다. 지어내지 말고 이 식을 쓰세요.

## 1. 발주 추천량 (`GET /api/orders/recommend/{storeId}`)

```
# 1) 메뉴별 향후 예측 수요 합산 (오늘 이후 전체 = 사실상 7일)
menu_total[menu_id] = Σ predicted_qty  where target_date >= today

# 2) 레시피 전개 → 식자재별 필요량 (기준 단위로 변환)
required[ing] = Σ_over_menus(
    qty_per_unit × menu_total[menu] × (1 + tolerance/100)
) |> convert_to_base_unit(recipe_unit → ingredient_unit)

# 3) 차감
order_qty = max(0, round1(required) - round1(current_stock) - round1(pending))
  where pending = Σ ordered_qty of ORDER_REQUEST in ('REQUESTED','APPROVED')

# 4) order_qty <= 0 이면 추천 목록에서 제외
```

- 모든 수치는 **소수 첫째 자리 반올림**(`round1`).
- `current_stock`은 음수일 수 있고, 그 경우 필요량이 그만큼 늘어납니다.
- 예측이 하나도 없으면 **빈 배열** 반환 (에러 아님).

## 2. 재고 자동 차감 (매출 등록 시, `POST /api/sales`)

```
for mi in recipe(menu_id):
    consume_recipe = qty_per_unit × sale_qty × (1 + tolerance/100)
    consume_base   = convert_to_base_unit(consume_recipe, mi.unit, ingredient.unit)
    inventory.current_qty = round2(current_qty - consume_base)   # 음수 허용
```
- 재고 행이 없으면 **0에서 시작해 생성 후 차감** → 즉시 음수가 됩니다 (의도된 "부족분 표시").
- ⚠️ `POST /api/sales`는 순수 기록이 아니라 **재고를 바꾸는 부수효과**가 있습니다. 에이전트가 과거 데이터 백필에 이 API를 쓰면 재고가 망가집니다.

## 3. 단위 변환

```
g  → kg : ÷ 1000
ml → L  : ÷ 1000
그 외    : 그대로 (개 → 개)
```
2026-09-11에 `util/UnitConverter.toBaseUnit()` 한 곳으로 통합했습니다 (이전에는 발주·재고 차감 두 서비스에 복붙되어 있었습니다).

## 4. 발주 상태 머신

```
 (없음) ──create()──→ REQUESTED ──approve──→ APPROVED ──→ HQ_SENT ──→ DRIVER_RECEIVED ──→ DONE
                         │                      │                                          │
        DELETE /{id} ────┤                      └→ approved_at 세팅                        └→ 재고 += ordered_qty
                         ↓                         delivery_token = UUID(32)
                     CANCELLED

 본사 거절: 어느 단계에서든 ──→ REJECTED
```

상태 7종: `REQUESTED`(승인대기) · `APPROVED`(발송필요) · `HQ_SENT`(배송중) · `DRIVER_RECEIVED`(점주 검수대기) · `DONE`(완료) · `REJECTED`(본사 거절) · `CANCELLED`(점주 취소).
`HQ_SENT` / `DRIVER_RECEIVED` 전환은 프론트엔드가 `PUT /{id}/status`로 직접 보냅니다 (전용 엔드포인트는 미구현).
규칙:
- `CANCELLED` 전환은 **`REQUESTED` 상태에서만** 가능. 그 외에는 **HTTP 400** + 사유 문자열 (2026-09-11 수정 — 이전에는 200으로 내려와 구분 불가능했음).
- 위 7종 외의 상태 문자열은 **HTTP 400**으로 거부됩니다.
- **재고 증가는 `DONE` 전환에서만** 일어납니다. `DRIVER_RECEIVED`는 아직 재고에 반영되지 않은 상태입니다.
- `DONE` 전입 시 해당 재고 행이 없으면 **새로 생성**하고 수량을 채웁니다.
- 상태 전환은 멱등 처리됨 (`!prev.equals(status)` 가드) — 같은 상태 재전송해도 재고 이중 가산 없음.
- `delivery_token`은 배달기사가 **무인증으로** `/api/delivery/{token}` 접근하는 키입니다 (누출 = 발주 정보 노출 + 완료 처리 가능).

## 5. 매출 후 자동 재발주 (`POST /api/orders/reorder-after-sale/{storeId}`)

3단계 파이프라인:
```
1) predictionService.triggerPrediction(storeId)     # 실패해도 무시(best-effort)
2) autoOrder(storeId)                               # §1 추천분 전부 REQUESTED 등록
3) 폴백: 예측으로 커버되지 않은 식자재 중
   current_qty < min_threshold 인 것 →
   par = max(min_threshold × 2, 1.0)
   order_qty = round1(par - current_qty)
```
- 재발주 전 같은 식자재의 `CANCELLED` 이력을 **DELETE** 합니다 (`deleteByStoreIdAndIngredientIdAndStatus`) — 취소 이력이 영구 소실됩니다.

## 6. 재고 초기화 (`POST /api/orders/init-inventory/{storeId}`)

```
for each ingredient:
    total = Σ ordered_qty of all orders where status != 'CANCELLED'
    inventory.current_qty = round1(total)   # 설정 (멱등)
```
→ 2026-09-11 수정: 가산이 아니라 **설정**이므로 반복 호출해도 결과가 같습니다.
다만 판매로 차감된 재고까지 발주 합계로 되돌리는 **초기화 작업**이므로 여전히 쓰기 툴로 취급하고 사용자 승인 후 실행하세요.

## 7. 매출 집계 산식

```
revenue(store, date)       = Σ (SALES_DATA.quantity × MENU.price)   where is_deleted=0
today_summary.changeRate   = round((today - yesterday) / yesterday × 1000) / 10   # %, 소수1
today_summary.trend        = "up" if today >= yesterday else "down"
weekly_summary.thisWeek    = revenue[today-6 .. today]
weekly_summary.prevWeek    = revenue[today-13 .. today-7]
```
- 단가는 **현재 MENU.price**를 씁니다 → 가격을 바꾸면 **과거 매출이 소급 변경**됩니다. (시계열 매출 분석 시 치명적 주의점)

## 8. 권한 규칙

| 역할 | 범위 |
|---|---|
| `OWNER` | 자기 매장의 메뉴/매출/예측/재고/발주/알림 |
| `HQ_ADMIN` | 전 매장 목록, 전체 발주 내역, 네트워크 통계 |

> ✅ **2026-09-11 수정**: JWT의 `role` 클레임이 `ROLE_OWNER`/`ROLE_HQ_ADMIN` 권한으로 등록되고, `@EnableMethodSecurity` + @PreAuthorize("hasRole('HQ_ADMIN')")로 본사 전용 API 3개(`GET /api/orders/admin/all`, `GET /api/stores`, `GET /api/sales/all-stores/weekly-summary`)를 보호합니다. OWNER 토큰으로 호출하면 403입니다.
> ✅ **매장 소유권 검사도 추가됨(2026-09-11)**: `security/StoreAccessGuard`가 JWT의 `id` 클레임과 `STORE.hq_user_id`를 대조합니다. OWNER가 남의 `storeId`를 넣으면 **403**이고, 엔티티 id를 받는 PUT/DELETE도 해당 엔티티의 매장을 역추적해 막습니다. HQ_ADMIN은 전 매장 통과.
> 예외: `/api/delivery/**`는 배달기사용 무인증 경로라 가드를 걸지 않았습니다. 가드를 서비스 계층에 놓았다면 이 경로가 깨졌을 것이라 **컨트롤러 계층**에 넣었습니다.

## 9. 에이전트가 지켜야 할 안전 규칙 (요약)

| 규칙 | 이유 |
|---|---|
| `POST /api/sales`를 백필/테스트에 쓰지 말 것 | 재고가 실제로 차감됨 (§2) |
| `POST /api/orders/init-inventory/*`는 사람 승인 후에만 | 판매 차감분을 되돌리는 초기화 작업 (§6) |
| `POST /api/orders/auto/*`, `reorder-after-sale/*`는 write 툴로 분류 | 실제 발주가 생성됨 |
| `DELETE /api/inventory/store/{id}`는 에이전트에 노출 금지 | 매장 재고 전체 삭제 |
| 상태 변경 실패는 이제 400 | 본문에 사유 문자열 (§4) |
| `confidence`를 확률로 해석하지 말 것 | 휴리스틱 (`03-ml-model-card.md` §5) |
