# 02. API 카탈로그 (에이전트 실행 표면)

> 출처: `backend/.../controller/*.java`, `ai-service/routers/*.py`, `frontend/src/services/*.ts` 대조 검증.
> 에이전트의 **툴 = 아래 엔드포인트**. 구현된 것과 아닌 것을 반드시 구분하세요 (§4).

## 0. 접속 정보

| 서비스 | URL | 인증 |
|---|---|---|
| Spring Boot API | `http://localhost:8080` | `Authorization: Bearer <JWT>` |
| Python AI Service | `http://localhost:8000` | **없음** (내부 호출 전제) |
| Frontend (Vite dev) | `http://localhost:5173` | `/api` → 8080 프록시 |
| DB | TiDB Cloud MySQL (`application.properties`) | 계정 정보는 저장소에 평문 존재 — **에이전트 자산에 복사 금지** |

**인증 예외 (permitAll)**: `/api/auth/**`, `/api/delivery/**`, `/ws/**`, `/error`. 그 외 전부 JWT 필요.
**역할 검사**: JWT의 `role` 클레임이 `ROLE_OWNER` / `ROLE_HQ_ADMIN` 권한으로 등록되며, 본사 전용 API 3개는 @PreAuthorize("hasRole('HQ_ADMIN')")로 보호됩니다 — OWNER 토큰으로 호출하면 **403**입니다.
**JWT 클레임**: `sub`=email, `role`=OWNER|HQ_ADMIN, `id`=userId. 만료 3600000ms(1시간).
**로그인 응답**: `200 OK` + **JWT 문자열 본문 그대로** (JSON 아님). 실패 시 `401` + 메시지 텍스트.

## 1. Spring Boot API

### 인증 `/api/auth`
| 메서드 | 경로 | 본문 | 반환 |
|---|---|---|---|
| POST | `/signup` | `SignupRequest` | 텍스트 |
| POST | `/login` | `{email, password}` | JWT 문자열 |

### 매장 `/api/stores`
| 메서드 | 경로 | 비고 |
|---|---|---|
| POST | `/` | `{storeName, address, phone, region, openedAt, hqUserId}` — `region`은 날씨 조회 키 |
| GET | `/my/{userId}` | 점주 소유 매장 |
| GET | `/` | 전체 — **HQ_ADMIN 전용(403)** |
| PUT | `/{id}` | |
| DELETE | `/{id}` | |

### 메뉴 `/api/menus`
| POST `/` | GET `/{storeId}` (활성만) | PUT `/{id}` | DELETE `/{id}` (=비활성화) |

### 레시피 `/api/menu-ingredients`
| POST `/` | GET `/menu/{menuId}` | DELETE `/{id}` |
본문: `{menuId, ingredientId, qtyPerUnit, unit, tolerance}`

### 식자재 `/api/ingredients`
| POST `/` | GET `/` (전체) | PUT `/{id}` | DELETE `/{id}` |

### 재고 `/api/inventory`
| POST `/` | GET `/{storeId}` | PUT `/{id}` | DELETE `/{id}` | DELETE `/store/{storeId}` |

### 매출 `/api/sales`
| 메서드 | 경로 | 반환 |
|---|---|---|
| POST | `/` | 등록 + **레시피 기반 재고 자동 차감** (부수효과 주의) |
| GET | `/{storeId}` | 삭제 안 된 전체 |
| GET | `/{storeId}/range?start=&end=` | 기간 조회 |
| DELETE | `/{id}` | soft delete |
| GET | `/{storeId}/today-summary` | `{revenue, qty, trend:"up"\|"down", changeRate}` |
| GET | `/{storeId}/weekly-summary` | `{thisWeekRevenue, prevWeekRevenue}` |
| GET | `/all-stores/weekly-summary` | `{storeId: revenue}` — **HQ_ADMIN 전용(403)** |

### 예측 `/api/predictions`
| 메서드 | 경로 | 반환 |
|---|---|---|
| GET | `/{storeId}` | 오늘 이후 예측 리스트 (`PredictionResultDto[]`) |
| POST | `/{storeId}/trigger` | AI 서비스 호출 후 `{status, message, storeId}` — **AI 실패해도 200**, `status:"error"`로 내려옴 |
| GET | `/{storeId}/summary` | `{storeId, dates[], byMenu{menuName: [...]}, total}` |

### 발주 `/api/orders`
| 메서드 | 경로 | 비고 |
|---|---|---|
| POST | `/` | `{storeId, ingredientId, quantity}` → status `REQUESTED` |
| GET | `/{storeId}` | 매장 발주 내역 (status 7종) |
| GET | `/admin/all` | 전체 — **HQ_ADMIN 전용(403)** |
| PUT | `/{id}/status` | `{status}` — `APPROVED` 시 토큰 발급, `DONE` 시 **재고 자동 증가**. 허용 외 값은 **400** |
| DELETE | `/{id}` | `REQUESTED`만 취소 가능 → `CANCELLED`. 그 외 상태는 **400** |
| GET | `/recommend/{storeId}` | **AI 발주 추천 미리보기** (읽기 전용) |
| POST | `/auto/{storeId}` | 추천분 일괄 발주 등록 |
| POST | `/reorder-after-sale/{storeId}` | 예측 갱신 → 자동 발주 → 임계치 미만 보충 |
| POST | `/init-inventory/{storeId}` | 발주 합계를 재고로 **설정**(멱등, 반복 호출해도 동일) |

`GET /recommend/{storeId}` 반환 항목:
```json
{"ingredientId":60003,"ingredientName":"쌀","unit":"kg",
 "requiredQty":12.4,"currentStock":3.0,"orderQty":9.4}
```

### 알림 `/api/notifications`
| POST `/` | GET `/{storeId}/unread` | PUT `/{id}/read` |
> ✅ POST는 매장 소유 점주를 수신자로 채우도록 수정되어 정상 동작합니다 (2026-09-11).

### 배송 `/api/delivery` (무인증, 토큰 기반)
| 메서드 | 경로 | 반환 |
|---|---|---|
| GET | `/{token}` | `{orderId, storeName, storeAddress, ingredientName, quantity, unit, status, token}` |
| POST | `/{token}/complete` | 발주 `DONE` 전환 + WS 브로드캐스트 |

**WebSocket (STOMP over SockJS)**: 엔드포인트 `/ws`, 앱 prefix `/app`, 브로커 `/topic`
- 발행: `/app/delivery/{token}/start`, `/app/delivery/{token}/location` (`{lat, lng}`)
- 구독: `/topic/delivery/{token}` → `{type: "START"|"LOCATION"|"DONE", ...}`

## 2. Python AI Service (`http://localhost:8000`)

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/health` | `{status, service, version}` |
| POST | `/api/predict/store/{store_id}` | 전 활성 메뉴 학습+예측+DB 저장. `{status, message, store_id, menus_predicted}` |
| POST | `/api/predict/store/{store_id}/menu/{menu_id}` | 단일 메뉴. 예측 배열 반환 |
| GET | `/api/predict/store/{store_id}` | 저장된 예측 조회 (메뉴별 그룹) |
| POST | `/api/train/store/{store_id}` | 강제 재학습. `{scores: {menu_id: 0~100}}` |

> AI 서비스는 **Spring을 거치지 않고 DB에 직접 SQL**로 읽고 씁니다 (`services/data_service.py`). 즉 `PREDICTION_RESULT` 쓰기 주체가 둘이 아니라 파이썬 한 곳입니다.
> 예측은 **동기 호출**이고 메뉴 수 × 날씨 API 호출만큼 오래 걸립니다. 에이전트는 타임아웃을 넉넉히(60s+) 잡으세요.

## 3. 의존성 체인

```
[에이전트] → Spring /api/predictions/{id}/trigger
              → RestTemplate → AI /api/predict/store/{id}
                  → Open-Meteo (과거 날씨, 키 불필요)
                  → 기상청 단기/중기예보 (KMA_API_KEY 필요, 없으면 날씨 없이 동작)
                  → TiDB 직접 write (PREDICTION_RESULT)
            ← Spring /api/orders/recommend/{id} 로 결과 소비
```

## 4. ⚠️ 프론트엔드가 호출하지만 **백엔드에 없는** 엔드포인트

아래는 `frontend/src/services/*.ts`에 있지만 대응 컨트롤러가 존재하지 않습니다. **에이전트 툴로 등록하면 안 됩니다** (404).

| 프론트 호출 | 파일 | 상태 |
|---|---|---|
| `POST /api/donations/{storeId}`, `/{id}/complete`, `/{id}/cancel`, `GET /donations/store/{storeId}` | `donationService.ts` | 미구현 (기부 기능 = 기획만) |
| `GET /api/waste-prediction/{storeId}`, `/{storeId}/summary` | `wastePredictionService.ts` | 미구현 (폐기 예측 = 기획만) |
| `POST /api/orders/{id}/hq-send` | `orderService.ts` | 미구현 |
| `POST /api/orders/scan` | `orderService.ts` | 미구현 |
| `POST /api/orders/{id}/driver-receive`, `/owner-receive` | `orderService.ts` | 미구현 |
| `POST /api/delivery/group/{groupToken}/driver-receive` | `orderService.ts` | 미구현 |

→ **이 갭이 에이전트의 기회 영역**입니다 (`06-agent-blueprints.md` 참고). 특히 폐기 예측·기부 매칭은 AI 에이전트로 구현하기 좋은 자리입니다.
