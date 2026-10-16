# FoodGuard - Use Case Diagram

```mermaid
graph LR
    subgraph Actors
        OWNER["🧑‍💼 OWNER<br/>(가맹점 점주)"]
        ADMIN["👔 HQ_ADMIN<br/>(본사 관리자)"]
    end

    subgraph UC_OWNER["점주 기능"]
        UC1["대시보드 조회<br/>(오늘 매출 · 예측 수량)"]
        UC2["메뉴 관리<br/>(등록 · 수정 · 비활성화)"]
        UC3["판매 실적 입력<br/>(날짜별 메뉴 판매량)"]
        UC4["판매 기록 삭제<br/>(소프트 삭제)"]
        UC5["AI 수요 예측 실행<br/>(내일 메뉴별 판매량 예측)"]
        UC6["예측 결과 조회<br/>(예측 vs 실제 비교 차트)"]
        UC7["식재료 재고 관리<br/>(재고량 · 임계치 설정)"]
        UC8["발주 추천 조회<br/>(예측 기반 AI 추천)"]
        UC9["발주 요청 생성"]
        UC10["발주 상태 변경<br/>(PENDING→APPROVED→RECEIVED)"]
        UC11["알림 수신 확인<br/>(재고부족 · 주문)"]
    end

    subgraph UC_ADMIN["본사 관리자 기능"]
        UC12["전체 가맹점 목록 조회"]
        UC13["가맹점별 주간 매출 비교"]
        UC14["네트워크 전체 통계 조회<br/>(전주 대비 성장률 · 매출 비중)"]
        UC15["전체 발주 내역 조회"]
        UC16["가맹점 등록 (회원가입 시)"]
    end

    OWNER --> UC1
    OWNER --> UC2
    OWNER --> UC3
    OWNER --> UC4
    OWNER --> UC5
    OWNER --> UC6
    OWNER --> UC7
    OWNER --> UC8
    OWNER --> UC9
    OWNER --> UC10
    OWNER --> UC11

    ADMIN --> UC12
    ADMIN --> UC13
    ADMIN --> UC14
    ADMIN --> UC15
    ADMIN --> UC16
```

## 페이지 ↔ 기능 매핑

| 페이지 | 경로 | 역할 | 핵심 기능 |
|--------|------|------|-----------|
| Dashboard | `/dashboard` | OWNER | 오늘 매출, 내일 예측, 알림 수 |
| 메뉴 관리 | `/menus` | OWNER | 메뉴 CRUD |
| 판매 실적 입력 | `/sales` | OWNER | 판매 데이터 입력 · 삭제 |
| AI 수요 예측 | `/predictions` | OWNER | 예측 실행 · 결과 차트 · 과거 판매 현황 |
| 재고 관리 | `/inventory` | OWNER | 재고 조회 · 수정 |
| 발주 관리 | `/orders` | OWNER | 추천 발주 · 발주 CRUD · 상태 변경 |
| 알림 | `/notifications` | OWNER | 알림 목록 · 읽음 처리 |
| 가맹점 관리 | `/admin/stores` | HQ_ADMIN | 전체 가맹점 · 주간 매출 차트 |
| 통계 | `/admin/stats` | HQ_ADMIN | 네트워크 매출 통계 · 비교 차트 |
| 발주 내역 | `/admin/orders` | HQ_ADMIN | 전체 발주 현황 |
