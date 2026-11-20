# FoodGuard - ER Diagram

```mermaid
erDiagram
    USER {
        bigint user_id PK
        varchar email UK
        varchar user_name
        varchar password_hash
        varchar role
        datetime created_at
        datetime updated_at
    }

    STORE {
        bigint store_id PK
        varchar store_name
        varchar address
        varchar phone
        varchar region
        tinyint is_active
        date opened_at
        bigint hq_user_id FK
        datetime created_at
    }

    MENU {
        bigint menu_id PK
        bigint store_id FK
        varchar menu_name
        varchar category
        tinyint is_active
        int price
        longtext image_url
        datetime created_at
    }

    SALES_DATA {
        bigint sales_id PK
        bigint store_id FK
        bigint menu_id FK
        date sales_date
        int quantity
        tinyint is_deleted
        datetime created_at
        datetime updated_at
    }

    INGREDIENT {
        bigint ingredient_id PK
        varchar ingredient_name
        varchar unit
        varchar category
        datetime created_at
    }

    PREDICTION_RESULT {
        bigint prediction_id PK
        bigint store_id FK
        bigint menu_id FK
        date target_date
        int predicted_qty
        decimal confidence
        varchar model_version
        datetime created_at
    }

    NOTIFICATION {
        bigint notification_id PK
        bigint user_id FK
        bigint store_id FK
        varchar type
        tinyint is_read
        text message
        datetime created_at
    }

    INVENTORY {
        bigint inventory_id PK
        bigint store_id FK
        bigint ingredient_id FK
        decimal current_qty
        decimal min_threshold
        varchar unit
        datetime updated_at
    }

    MENU_INGREDIENT {
        bigint menu_ingredient_id PK
        bigint menu_id FK
        bigint ingredient_id FK
        decimal qty_per_unit
        varchar unit
        decimal tolerance
        datetime created_at
    }

    ORDER_REQUEST {
        bigint order_id PK
        bigint store_id FK
        bigint ingredient_id FK
        varchar status
        decimal ordered_qty
        datetime ordered_at
        datetime approved_at
        varchar delivery_token
        datetime updated_at
    }

    USER ||--o{ STORE : "owns (hq_user_id)"
    USER ||--o{ NOTIFICATION : "receives"
    STORE ||--o{ MENU : "has"
    STORE ||--o{ SALES_DATA : "records"
    STORE ||--o{ PREDICTION_RESULT : "receives"
    STORE ||--o{ NOTIFICATION : "scoped to"
    STORE ||--o{ INVENTORY : "manages"
    STORE ||--o{ ORDER_REQUEST : "places"
    MENU ||--o{ SALES_DATA : "sold as"
    MENU ||--o{ PREDICTION_RESULT : "predicted for"
    MENU ||--o{ MENU_INGREDIENT : "requires"
    INGREDIENT ||--o{ MENU_INGREDIENT : "used in"
    INGREDIENT ||--o{ INVENTORY : "tracked as"
    INGREDIENT ||--o{ ORDER_REQUEST : "ordered as"
```

## 주요 설계 결정
- `SALES_DATA.total_price` — DB에 저장하지 않음 (`@Transient`). 매출 집계는 `SUM(quantity * menu.price)` JPQL로 계산
- `ORDER_REQUEST.prediction_id` — **실제 테이블에 컬럼 없음**. 엔티티에서 `@Transient` 미사용 필드
- `ORDER_REQUEST.delivery_token` — APPROVED 전환 시 UUID 발급. 배달기사가 무인증으로 `/api/delivery/{token}` 접근하는 키
- `MENU_INGREDIENT.tolerance` — 로스율(%). 발주 필요량과 재고 차감량에 `× (1 + tolerance/100)` 로 반영
- `INVENTORY.current_qty` / `OrderRequest.ordered_qty` — BigDecimal (소수점 지원). 재고는 **음수 허용**(부족분 표시)
- Soft delete: `SALES_DATA.is_deleted = 1`, `MENU.is_active = 0`
- `USER` 엔티티에는 `store_id` 필드가 없음. 사용자↔매장 연결은 `STORE.hq_user_id` 단방향

> 상세 스키마와 컬럼별 주의사항은 `agent-assets/01-domain-model.md` 참고.
