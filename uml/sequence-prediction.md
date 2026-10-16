# FoodGuard - 시퀀스 다이어그램

## 1. AI 수요 예측 트리거 흐름

```mermaid
sequenceDiagram
    actor Owner as 점주 (OWNER)
    participant FE as React Frontend
    participant PC as PredictionController
    participant PS as PredictionService
    participant SDR as SalesDataRepository
    participant RT as RestTemplate
    participant AI as Python AI Service
    participant PRR as PredictionResultRepository

    Owner->>FE: "AI 예측 실행" 버튼 클릭
    FE->>PC: POST /api/predictions/{storeId}/trigger
    PC->>PS: triggerPrediction(storeId)
    PS->>SDR: findByStore(storeId)
    SDR-->>PS: List<SalesData>
    PS->>RT: POST http://localhost:8000/api/predict/store/{storeId}
    RT->>AI: (본문 없음 — AI 서비스가 DB에서 직접 판매 이력 조회)

    AI->>AI: feature_engineering()<br/>(lag, rolling_mean, day_of_week, weather)
    alt data >= 30 rows
        AI->>AI: RandomForest full model
    else data >= 7 rows
        AI->>AI: RandomForest minimal model
    else data < 7 rows
        AI->>AI: simple average
    end

    AI-->>RT: { predictions: [{menu_id, date, qty, confidence}] }
    RT-->>PS: ResponseEntity

    loop 각 예측 결과
        PS->>PRR: save(PredictionResult)
    end

    PS-->>PC: Map { status, count, predictions }
    PC-->>FE: 200 OK + 예측 결과
    FE-->>Owner: 예측 차트 업데이트
```

## 2. 로그인 및 JWT 인증 흐름

```mermaid
sequenceDiagram
    actor User
    participant FE as React Frontend
    participant AC as AuthController
    participant US as UserService
    participant DB as MySQL

    User->>FE: 이메일 + 비밀번호 입력
    FE->>AC: POST /api/auth/login
    AC->>US: login(LoginRequest)
    US->>DB: findByEmail(email)
    DB-->>US: User entity
    US->>US: BCrypt.matches(password, hash)
    alt 비밀번호 불일치
        US-->>AC: throw Exception
        AC-->>FE: 401 Unauthorized
    else 인증 성공
        US->>US: Jwts.builder().claim("role", role).sign()
        US-->>AC: JWT token (String)
        AC-->>FE: 200 OK + token
        FE->>FE: localStorage.setItem("token", token)
        FE->>FE: 역할별 라우팅 (OWNER → /dashboard, HQ_ADMIN → /admin)
    end
```

## 3. 주문 추천 흐름

```mermaid
sequenceDiagram
    actor Owner as 점주 (OWNER)
    participant FE as React Frontend
    participant ORC as OrderRequestController
    participant ORS as OrderRequestService
    participant PRR as PredictionResultRepository
    participant MIR as MenuIngredientRepository
    participant INV as InventoryRepository
    participant ORR as OrderRequestRepository

    Owner->>FE: 발주 추천 요청
    FE->>ORC: GET /api/orders/recommend/{storeId}
    ORC->>ORS: recommend(storeId)

    ORS->>PRR: findByStore(storeId, today 이후)
    PRR-->>ORS: List<PredictionResult>

    loop 각 예측 메뉴
        ORS->>MIR: findByMenu(menuId)
        MIR-->>ORS: List<MenuIngredient>

        loop 각 식재료
            ORS->>ORS: required = predictedQty × qtyPerUnit × (1+tolerance%) → 기준단위 변환
            ORS->>INV: findByStoreAndIngredient(storeId, ingredientId)
            INV-->>ORS: currentQty
            ORS->>ORR: findPendingByStoreAndIngredient(storeId, ingredientId)
            ORR-->>ORS: pendingQty
            ORS->>ORS: recommend = max(0, required - currentQty - pendingQty)
        end
    end

    ORS-->>ORC: List<Map {ingredient, recommendedQty}>
    ORC-->>FE: 200 OK + 추천 발주 목록
    FE-->>Owner: 발주 추천 표시
```

## 4. 발주 수령(DONE) → 재고 자동 반영 흐름

```mermaid
sequenceDiagram
    actor Owner as 점주 (OWNER)
    participant FE as React Frontend
    participant ORC as OrderRequestController
    participant ORS as OrderRequestService
    participant ORR as OrderRequestRepository
    participant INV as InventoryRepository

    Owner->>FE: 발주 수령 처리 (status → DONE)
    FE->>ORC: PUT /api/orders/{id}/status { status: "DONE" }
    ORC->>ORS: updateStatus(id, "DONE")
    ORS->>ORR: findById(id)
    ORR-->>ORS: OrderRequest

    ORS->>ORS: orderRequest.setStatus("DONE")
    ORS->>ORR: save(orderRequest)

    alt status == "DONE" (이전 상태가 DONE 이 아닐 때만)
        ORS->>INV: findByStoreAndIngredient(storeId, ingredientId)
        INV-->>ORS: Inventory
        ORS->>ORS: inventory.currentQty += orderedQty
        ORS->>INV: save(inventory)
    end

    ORS-->>ORC: updated OrderRequest
    ORC-->>FE: 200 OK
    FE-->>Owner: 재고 현황 갱신
```
