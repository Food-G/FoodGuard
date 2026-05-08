-- ============================================================
--  DB Schema - 프랜차이즈 AI 수요예측 시스템
--  구성: Spring Boot + MySQL (TiDB Cloud)
-- ============================================================

CREATE TABLE IF NOT EXISTS store (
    store_id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '가맹점 PK',
    store_name         VARCHAR(100) NOT NULL                COMMENT '가맹점명',
    region             VARCHAR(100) NOT NULL                COMMENT '지역',
    address            VARCHAR(255)                         COMMENT '상세 주소',
    business_type      VARCHAR(50)  NOT NULL                COMMENT '업종 구분',
    hq_manager_name    VARCHAR(50)                          COMMENT '본사 담당자 성명',
    hq_manager_contact VARCHAR(20)                          COMMENT '본사 담당자 연락처',
    is_active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id)
) COMMENT '가맹점 테이블';

CREATE TABLE IF NOT EXISTS users (
    user_id    BIGINT       NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
    store_id   BIGINT                               COMMENT '소속 가맹점 FK',
    email      VARCHAR(100) NOT NULL UNIQUE          COMMENT '이메일',
    password   VARCHAR(255) NOT NULL                 COMMENT '암호화 비밀번호',
    name       VARCHAR(50)  NOT NULL                 COMMENT '성명',
    contact    VARCHAR(20)                           COMMENT '연락처',
    role       VARCHAR(20)  NOT NULL DEFAULT 'OWNER' COMMENT 'OWNER | ADMIN',
    is_active  TINYINT(1)   NOT NULL DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL
) COMMENT '사용자 테이블';

CREATE TABLE IF NOT EXISTS menu (
    menu_id    BIGINT        NOT NULL AUTO_INCREMENT COMMENT '메뉴 PK',
    store_id   BIGINT        NOT NULL                COMMENT '가맹점 FK',
    menu_name  VARCHAR(100)  NOT NULL                COMMENT '메뉴명',
    unit_price DECIMAL(10,2) NOT NULL                COMMENT '단가',
    category   VARCHAR(50)                           COMMENT '카테고리',
    is_active  TINYINT(1)    NOT NULL DEFAULT 1,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (menu_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '메뉴 테이블';

CREATE TABLE IF NOT EXISTS sales (
    sales_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '매출 PK',
    store_id     BIGINT        NOT NULL                COMMENT '가맹점 FK',
    menu_id      BIGINT        NOT NULL                COMMENT '메뉴 FK',
    sold_at      DATETIME      NOT NULL                COMMENT '판매 일시',
    quantity     INT           NOT NULL                COMMENT '판매 수량',
    unit_price   DECIMAL(10,2) NOT NULL                COMMENT '단가',
    total_amount DECIMAL(12,2) NOT NULL                COMMENT '결제 금액',
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (sales_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id)  REFERENCES menu(menu_id)   ON DELETE RESTRICT
) COMMENT '매출 데이터 테이블';

CREATE TABLE IF NOT EXISTS inventory (
    inventory_id    BIGINT        NOT NULL AUTO_INCREMENT COMMENT '재고 PK',
    store_id        BIGINT        NOT NULL                COMMENT '가맹점 FK',
    ingredient_name VARCHAR(100)  NOT NULL                COMMENT '식자재명',
    current_stock   DECIMAL(10,3) NOT NULL DEFAULT 0,
    unit            VARCHAR(20)   NOT NULL                COMMENT '단위',
    expiry_date     DATE,
    waste_quantity  DECIMAL(10,3) NOT NULL DEFAULT 0,
    threshold_stock DECIMAL(10,3),
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (inventory_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '재고 테이블';

CREATE TABLE IF NOT EXISTS external_data (
    external_id       BIGINT       NOT NULL AUTO_INCREMENT COMMENT '외부 데이터 PK',
    record_date       DATE         NOT NULL,
    region            VARCHAR(100) NOT NULL,
    temperature       DECIMAL(5,2),
    precipitation     DECIMAL(6,2),
    weather_condition VARCHAR(50),
    is_holiday        TINYINT(1)   NOT NULL DEFAULT 0,
    holiday_name      VARCHAR(100),
    special_event     VARCHAR(200),
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (external_id),
    UNIQUE KEY uq_external_date_region (record_date, region)
) COMMENT '외부 데이터 테이블';

CREATE TABLE IF NOT EXISTS prediction (
    prediction_id      BIGINT        NOT NULL AUTO_INCREMENT COMMENT '예측 PK',
    store_id           BIGINT        NOT NULL,
    menu_id            BIGINT        NOT NULL,
    predicted_at       DATETIME      NOT NULL,
    target_date        DATE          NOT NULL,
    predicted_quantity INT           NOT NULL,
    recommended_order  DECIMAL(10,3),
    accuracy_score     DECIMAL(5,4),
    model_version      VARCHAR(50),
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (prediction_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
    FOREIGN KEY (menu_id)  REFERENCES menu(menu_id)   ON DELETE CASCADE
) COMMENT '예측 결과 테이블';

CREATE TABLE IF NOT EXISTS order_request (
    order_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '발주 PK',
    store_id     BIGINT        NOT NULL,
    user_id      BIGINT        NOT NULL,
    ordered_at   DATETIME      NOT NULL,
    status       VARCHAR(20)   NOT NULL DEFAULT 'REQUESTED',
    total_amount DECIMAL(12,2),
    note         VARCHAR(500),
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(user_id)  ON DELETE RESTRICT
) COMMENT '발주 요청 테이블';

CREATE TABLE IF NOT EXISTS order_item (
    order_item_id   BIGINT        NOT NULL AUTO_INCREMENT COMMENT '발주 품목 PK',
    order_id        BIGINT        NOT NULL,
    ingredient_name VARCHAR(100)  NOT NULL,
    quantity        DECIMAL(10,3) NOT NULL,
    unit            VARCHAR(20)   NOT NULL,
    unit_price      DECIMAL(10,2),
    subtotal        DECIMAL(12,2),
    PRIMARY KEY (order_item_id),
    FOREIGN KEY (order_id) REFERENCES order_request(order_id) ON DELETE CASCADE
) COMMENT '발주 품목 테이블';

CREATE TABLE IF NOT EXISTS notification (
    notification_id BIGINT       NOT NULL AUTO_INCREMENT COMMENT '알림 PK',
    store_id        BIGINT       NOT NULL,
    message         VARCHAR(500) NOT NULL,
    type            VARCHAR(50),
    is_read         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '알림 테이블';

-- 인덱스 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_sales_store_date      ON sales(store_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_inventory_store       ON inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry      ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_prediction_store_date ON prediction(store_id, target_date);
CREATE INDEX IF NOT EXISTS idx_external_date_region  ON external_data(record_date, region);
CREATE INDEX IF NOT EXISTS idx_order_store_date      ON order_request(store_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status          ON order_request(status);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);
