# 01. 도메인 모델 (Ground Truth)

> 출처: `backend/src/main/java/com/foodguard/entity/*.java` 및 `ai-service/services/data_service.py`의 실제 SQL.
> `uml/er-diagram.md`보다 **이 문서가 최신**입니다 (차이는 맨 아래 "문서 드리프트" 참고).
> DB: TiDB Cloud (MySQL 8 호환), `spring.jpa.hibernate.ddl-auto=none` → **스키마는 수동 관리**. 엔티티를 바꿔도 테이블은 안 바뀝니다.

## 1. 테이블 정의

### USER
| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_id | BIGINT PK | auto |
| email | VARCHAR UK | 로그인 ID |
| user_name | VARCHAR(50) | |
| password_hash | VARCHAR | BCrypt |
| role | VARCHAR(20) | `OWNER` \| `HQ_ADMIN` |
| created_at / updated_at | DATETIME | DB default |

> ⚠️ 엔티티에 `store_id` 필드가 **없습니다**. ER 다이어그램에는 있지만 `User.java`에는 매핑되어 있지 않습니다. 사용자↔매장 연결은 `STORE.hq_user_id` 단방향입니다.

### STORE
| 컬럼 | 타입 | 비고 |
|---|---|---|
| store_id | BIGINT PK | |
| store_name | VARCHAR(100) NOT NULL | |
| address | VARCHAR(255) | |
| phone | VARCHAR(20) | |
| region | VARCHAR(100) NOT NULL | **날씨 API 좌표 조회 키** (예: "서울", "부산") |
| is_active | BOOLEAN NOT NULL | |
| opened_at | DATE NOT NULL | |
| hq_user_id | BIGINT FK → USER | 소유 점주 |
| created_at | DATETIME | |

### MENU
| 컬럼 | 타입 | 비고 |
|---|---|---|
| menu_id | BIGINT PK | |
| store_id | BIGINT FK NOT NULL | |
| menu_name | VARCHAR(100) NOT NULL | |
| category | VARCHAR(50) | |
| is_active | BOOLEAN NOT NULL | 삭제 = `is_active=0` (soft) |
| price | INT NOT NULL | **매출 계산의 유일한 단가 소스** |
| image_url | LONGTEXT | base64 data URI 허용 |
| created_at | DATETIME | |

### SALES_DATA
| 컬럼 | 타입 | 비고 |
|---|---|---|
| sales_id | BIGINT PK | |
| store_id, menu_id | BIGINT FK NOT NULL | |
| sales_date | DATE NOT NULL | 일 단위 (시각 없음) |
| quantity | INT NOT NULL | |
| is_deleted | BOOLEAN NOT NULL | soft delete |
| created_at / updated_at | DATETIME | |

> `total_price`는 **컬럼이 아닙니다** (`@Transient`). 매출 = `SUM(quantity × MENU.price)` JPQL로 계산.
> 같은 (store, menu, date)에 행이 여러 개 있을 수 있음 → AI 서비스는 `GROUP BY sales_date, SUM(quantity)`로 집계해서 읽습니다.

### INGREDIENT
| 컬럼 | 타입 | 비고 |
|---|---|---|
| ingredient_id | BIGINT PK | |
| ingredient_name | VARCHAR(100) NOT NULL | |
| unit | VARCHAR(20) NOT NULL | **기준(발주/재고) 단위**: `kg` \| `L` \| `개` |
| category | VARCHAR(50) | |
| created_at | DATETIME | |

### MENU_INGREDIENT (레시피 / BOM)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| menu_ingredient_id | BIGINT PK | |
| menu_id, ingredient_id | BIGINT FK NOT NULL | |
| qty_per_unit | DECIMAL(10,2) NOT NULL | 메뉴 1개당 소요량 (**레시피 단위** 기준) |
| unit | VARCHAR(20) NOT NULL | **레시피 단위**: `g` \| `ml` \| `개` |
| tolerance | DECIMAL(5,2) NOT NULL | 오차/로스율 **%** (기본 0) |
| created_at | DATETIME | |

> 단위가 2계층입니다. `MENU_INGREDIENT.unit`(g/ml) → `INGREDIENT.unit`(kg/L)로 **1000 나누기 변환**이 코드에 하드코딩되어 있습니다. (`04-business-rules.md` §3)

### INVENTORY
| 컬럼 | 타입 | 비고 |
|---|---|---|
| inventory_id | BIGINT PK | |
| store_id, ingredient_id | BIGINT FK NOT NULL | (store, ingredient) 사실상 유니크 |
| current_qty | DECIMAL(10,2) NOT NULL | **음수 허용** (부족분 표시 용도로 의도적) |
| min_threshold | DECIMAL(10,2) NOT NULL | 재주문 임계치 |
| unit | VARCHAR(20) NOT NULL | INGREDIENT.unit과 동기화 |
| updated_at | DATETIME | 애플리케이션이 직접 세팅 |

### PREDICTION_RESULT
| 컬럼 | 타입 | 비고 |
|---|---|---|
| prediction_id | BIGINT PK | |
| store_id, menu_id | BIGINT FK NOT NULL | |
| target_date | DATE NOT NULL | Java 필드명은 `predictionDate` |
| predicted_qty | INT NOT NULL | |
| confidence | DECIMAL(5,2) | **0~100 스케일** (0~1 아님) |
| model_version | VARCHAR(50) | 현재 `rf_weather_v1.0` |
| created_at | DATETIME | |

> 재예측 시 `target_date >= CURDATE()` 행을 **DELETE 후 INSERT** (upsert 아님). 과거 예측은 보존되지만 오늘 이후는 매번 덮어씀 → **예측 정확도 사후 검증용 이력이 남지 않음** (갭, `05-data-inventory.md` 참고).

### ORDER_REQUEST
| 컬럼 | 타입 | 비고 |
|---|---|---|
| order_id | BIGINT PK | |
| store_id, ingredient_id | BIGINT FK NOT NULL | |
| status | VARCHAR NOT NULL | `REQUESTED` → `APPROVED` → `HQ_SENT` → `DRIVER_RECEIVED` → `DONE`, 이탈: `REJECTED` / `CANCELLED` |
| ordered_qty | DECIMAL(10,2) NOT NULL | INGREDIENT.unit 기준 |
| ordered_at | DATETIME | |
| approved_at | DATETIME | APPROVED 전환 시각 |
| delivery_token | VARCHAR(64) | APPROVED 시 UUID 발급, 기사용 무인증 접근키 |
| updated_at | DATETIME | DB 관리 |

> ⚠️ `prediction_id` 컬럼은 **실제 테이블에 없습니다** (`@Transient`). ER 다이어그램과 다름.
> ⚠️ 상태값은 **7종**: `REQUESTED / APPROVED / HQ_SENT / DRIVER_RECEIVED / DONE / REJECTED / CANCELLED`.
> 재고 자동 증가는 `DONE` 전환에서만 일어납니다. `REJECTED`는 본사 거절, `CANCELLED`는 점주 취소입니다.
> ER·시퀀스 문서의 `PENDING/RECEIVED`는 **구버전**입니다.

### NOTIFICATION
| 컬럼 | 타입 | 비고 |
|---|---|---|
| notification_id | BIGINT PK | |
| user_id | BIGINT FK **NOT NULL** | |
| store_id | BIGINT FK nullable | |
| type | VARCHAR | `STOCK` \| `WASTE` \| `ORDER` \| `ACCURACY` |
| is_read | BOOLEAN NOT NULL | |
| message | TEXT NOT NULL | |
| created_at | DATETIME | |

> ✅ **수정됨(2026-09-11)**: `NotificationService.create()`가 `STORE.hq_user_id`의 점주를 수신자로 채웁니다. 매장에 소유 점주가 없으면 명시적 예외를 던집니다.

## 2. 관계 요약

```
USER 1──n STORE (hq_user_id)
STORE 1──n MENU, SALES_DATA, PREDICTION_RESULT, INVENTORY, ORDER_REQUEST, NOTIFICATION
MENU 1──n SALES_DATA, PREDICTION_RESULT, MENU_INGREDIENT
INGREDIENT 1──n MENU_INGREDIENT, INVENTORY, ORDER_REQUEST
```

핵심 조인 경로 (에이전트가 가장 많이 쓸 경로):
```
PREDICTION_RESULT(menu_id, predicted_qty)
  → MENU_INGREDIENT(menu_id → ingredient_id, qty_per_unit, unit, tolerance)
    → INVENTORY(store_id, ingredient_id, current_qty)
      → ORDER_REQUEST(status IN ('REQUESTED','APPROVED'))
        ⇒ 발주 추천량
```

## 3. 문서 드리프트 (uml/ vs 코드)

| 항목 | uml 문서 | 실제 코드 | 조치 |
|---|---|---|---|
| 발주 상태 | `PENDING → APPROVED → RECEIVED` | `REQUESTED → APPROVED → HQ_SENT → DRIVER_RECEIVED → DONE`, `REJECTED`, `CANCELLED` | 코드·실데이터가 정답 |
| `ORDER_REQUEST.prediction_id` | 존재 | `@Transient`, 컬럼 없음 | 코드가 정답 |
| `USER.store_id` | 존재 | 엔티티에 없음 | 코드가 정답 |
| `MENU_INGREDIENT.tolerance` | 없음 | 존재 (로스율 %) | 문서 누락 |
| `ORDER_REQUEST.approved_at / delivery_token` | 없음 | 존재 | 문서 누락 |
| `MENU.image_url` | 없음 | 존재 (LONGTEXT) | 문서 누락 |
| AI 트리거 URL | `POST /predict/{storeId}` | `POST /api/predict/store/{storeId}` | 코드가 정답 |

> ✅ **2026-09-11에 `uml/` 문서를 코드에 맞게 정정했습니다.** 위 표는 무엇이 왜 바뀌었는지의 기록으로 남겨둡니다.
