# FoodGuard - Class Diagram (Entity Layer)

```mermaid
classDiagram
    direction TB

    class User {
        +Long id
        +String email
        +String userName
        +String password
        +String role
        +Long storeId
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
    }

    class Store {
        +Long id
        +String storeName
        +String address
        +String phone
        +String region
        +boolean isActive
        +LocalDate openedAt
        +LocalDateTime createdAt
        +User user
    }

    class Menu {
        +Long id
        +String menuName
        +String category
        +boolean isActive
        +Integer price
        +LocalDateTime createdAt
        +Store store
    }

    class SalesData {
        +Long id
        +LocalDate saleDate
        +Integer quantity
        +boolean isDeleted
        +LocalDateTime createdAt
        +LocalDateTime updatedAt
        +Store store
        +Menu menu
        <<Transient>> Integer totalPrice
        <<Transient>> LocalDateTime deletedAt
    }

    class Ingredient {
        +Long id
        +String name
        +String unit
        +String category
        +LocalDateTime createdAt
    }

    class PredictionResult {
        +Long id
        +LocalDate predictionDate
        +Integer predictedQty
        +BigDecimal confidence
        +String modelVersion
        +LocalDateTime createdAt
        +Store store
        +Menu menu
    }

    class Notification {
        +Long id
        +String type
        +boolean isRead
        +String message
        +LocalDateTime createdAt
        +User user
        +Store store
    }

    class Inventory {
        +Long id
        +BigDecimal currentQty
        +BigDecimal minThreshold
        +String unit
        +LocalDateTime updatedAt
        +Store store
        +Ingredient ingredient
        <<Transient>> Double quantity
    }

    class MenuIngredient {
        +Long id
        +BigDecimal qtyPerUnit
        +String unit
        +LocalDateTime createdAt
        +Menu menu
        +Ingredient ingredient
    }

    class OrderRequest {
        +Long id
        +Long predictionId
        +String status
        +BigDecimal orderedQty
        +LocalDateTime orderedAt
        +LocalDateTime updatedAt
        +Store store
        +Ingredient ingredient
        <<Transient>> Double quantity
    }

    User "1" --> "0..*" Store : owns (hq_user_id)
    User "1" --> "0..*" Notification : receives

    Store "1" --> "0..*" Menu : has
    Store "1" --> "0..*" SalesData : records
    Store "1" --> "0..*" PredictionResult : receives
    Store "1" --> "0..*" Notification : scoped to
    Store "1" --> "0..*" Inventory : manages
    Store "1" --> "0..*" OrderRequest : places

    Menu "1" --> "0..*" SalesData : sold as
    Menu "1" --> "0..*" PredictionResult : predicted for
    Menu "1" --> "0..*" MenuIngredient : requires

    Ingredient "1" --> "0..*" MenuIngredient : used in
    Ingredient "1" --> "0..*" Inventory : tracked as
    Ingredient "1" --> "0..*" OrderRequest : ordered as
```

## Role 설명
| Role | 설명 |
|------|------|
| `OWNER` | 개별 가맹점 점주. 자신의 가게 데이터만 접근 |
| `HQ_ADMIN` | 본사 관리자. 전체 가맹점 조회/통계 접근 |

## OrderRequest Status 흐름
`PENDING` → `APPROVED` → `RECEIVED`  
`PENDING` → `CANCELLED`
