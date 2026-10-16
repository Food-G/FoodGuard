# FoodGuard - System Architecture

```mermaid
graph TB
    subgraph Client["Client (Browser)"]
        FE["React + MUI + ECharts<br/>Vite / TypeScript<br/>localhost:5173"]
    end

    subgraph Backend["Spring Boot Backend<br/>localhost:8080"]
        direction TB
        SEC["Spring Security<br/>(JWT Filter)"]
        CTR["Controllers<br/>/api/auth<br/>/api/stores<br/>/api/menus<br/>/api/sales<br/>/api/predictions<br/>/api/orders<br/>/api/inventory<br/>/api/notifications"]
        SVC["Services<br/>UserService / StoreService<br/>SalesDataService / PredictionService<br/>OrderRequestService / InventoryService<br/>NotificationService"]
        REPO["JPA Repositories<br/>(Spring Data JPA + JPQL)"]
        RT["RestTemplate<br/>(HTTP client)"]
    end

    subgraph AI["Python AI Service<br/>FastAPI / localhost:8000"]
        direction TB
        AIROUTE["Endpoints<br/>POST /predict/{store_id}<br/>POST /predict-all"]
        FEAT["Feature Engineering<br/>day_of_week, is_weekend<br/>lag_1/7/14, rolling_mean<br/>holiday (KR)"]
        MODEL["RandomForest Predictor<br/>≥30 data: full model<br/>7-29 data: minimal model<br/><7 data: simple avg"]
        WEATHER["Weather Service<br/>Open-Meteo (historical)<br/>KMA API (forecast)"]
    end

    subgraph DB["MySQL Database"]
        TABLES["Tables<br/>USER / STORE / MENU<br/>SALES_DATA / INGREDIENT<br/>PREDICTION_RESULT<br/>INVENTORY / ORDER_REQUEST<br/>MENU_INGREDIENT / NOTIFICATION"]
    end

    FE -->|"HTTP + JWT Bearer token"| SEC
    SEC --> CTR
    CTR --> SVC
    SVC --> REPO
    REPO -->|"JDBC / JPA"| TABLES
    SVC -->|"POST /predict/{storeId}"| RT
    RT -->|"HTTP"| AIROUTE
    AIROUTE --> FEAT
    FEAT --> MODEL
    MODEL --> AIROUTE
    WEATHER -.->|"날씨 feature 주입"| FEAT
    AIROUTE -->|"예측 결과 반환"| RT
    RT -->|"PredictionResult 저장"| REPO
```

## 기술 스택 상세

| 계층 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, MUI v5, Apache ECharts, React Router v6 |
| Backend | Spring Boot 3.x, Spring Security, Spring Data JPA, Lombok, JWT (jjwt) |
| AI Service | Python 3.x, FastAPI, scikit-learn (RandomForest), pandas, numpy |
| Database | MySQL 8.x |
| Weather | Open-Meteo API (historical, free), KMA 기상청 API (forecast) |

## 주요 설계 패턴
- **Role-Based Access**: JWT claim의 `role` 필드로 OWNER/HQ_ADMIN 분기
- **AI 트리거 방식**: Backend → Python 동기 HTTP 호출 후 결과를 DB에 직접 저장
- **주문 추천**: PredictionResult → MenuIngredient → (예측 필요량 - 현재재고 - 발주중) = 권장 발주량
- **주문 수령 자동화**: OrderRequest status = RECEIVED → Inventory.currentQty 자동 증가
