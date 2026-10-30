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
        AIROUTE["Endpoints<br/>POST /api/predict/store/{id}<br/>POST /api/train/store/{id}<br/>POST /api/explain/order<br/>POST /api/events/parse"]
        FEAT["Feature Engineering<br/>영업일 달력 정렬<br/>weekday lag_7/14, rolling_mean<br/>store_dow_ratio, holiday (KR)<br/>store_id·menu_id, 특이사항 배율"]
        MODEL["Global XGBoost (전 매장×메뉴 1개)<br/>L1 손실, scale 대비 보정 비율 학습<br/>+ 식자재 7일 사용량 safety_factor<br/>(model_version xgb_global_v2.1)"]
        WEATHER["Weather Service<br/>Open-Meteo (historical)<br/>KMA API (forecast)"]
        LLM["Claude CLI<br/>발주 근거 설명 · 특이사항 수치화<br/>(수요 예측에는 쓰지 않음)"]
    end

    subgraph DB["TiDB Cloud (MySQL 호환)"]
        TABLES["Tables<br/>USER / STORE / MENU<br/>SALES_DATA / SALES_DAY_FLAG<br/>INGREDIENT / MENU_INGREDIENT<br/>PREDICTION_RESULT / STORE_EVENT_NOTE<br/>INVENTORY / ORDER_REQUEST<br/>WASTE_RECORD / DONATION_RECORD<br/>NOTIFICATION"]
    end

    FE -->|"HTTP + JWT Bearer token"| SEC
    SEC --> CTR
    CTR --> SVC
    SVC --> REPO
    REPO -->|"JDBC / JPA"| TABLES
    SVC -->|"POST /api/predict/store/{id}<br/>(storeId만 전달)"| RT
    RT -->|"HTTP"| AIROUTE
    AIROUTE -->|"판매·메뉴·레시피·휴무·특이사항 조회<br/>(SQLAlchemy 순수 SQL)"| TABLES
    AIROUTE --> FEAT
    FEAT --> MODEL
    MODEL --> AIROUTE
    WEATHER -.->|"날씨 feature 주입"| FEAT
    AIROUTE -->|"PREDICTION_RESULT 저장<br/>(미래분 삭제 후 재삽입)"| TABLES
    AIROUTE -->|"status만 반환"| RT
    AIROUTE -.->|"explain · events"| LLM
```

## 기술 스택 상세

| 계층 | 기술 |
|------|------|
| Frontend | React 18, TypeScript, Vite, MUI v5, Apache ECharts, React Router v6 |
| Backend | Spring Boot 3.x, Spring Security, Spring Data JPA, Lombok, JWT (jjwt) |
| AI Service | Python 3.11, FastAPI, XGBoost (글로벌 모델), scikit-learn, pandas, numpy, SQLAlchemy, Claude CLI(설명·특이사항) |
| Database | TiDB Cloud (MySQL 호환) |
| Weather | Open-Meteo API (historical, free), KMA 기상청 API (forecast) |

## 주요 설계 패턴
- **Role-Based Access**: JWT claim의 `role` 필드로 OWNER/HQ_ADMIN 분기
- **AI 트리거 방식**: Backend가 storeId만 담아 Python을 동기 HTTP 호출 → AI 서비스가 DB를 직접 읽어 글로벌 모델 학습·예측 후 `PREDICTION_RESULT`에 직접 저장. Backend는 결과를 DB에서 다시 읽음
- **주문 추천**: PredictionResult → MenuIngredient → (예측 필요량 - 현재재고 - 발주중) = 권장 발주량
- **주문 수령 자동화**: OrderRequest status = RECEIVED → Inventory.currentQty 자동 증가
