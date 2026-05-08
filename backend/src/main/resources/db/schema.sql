-- ============================================================
--  DB Schema - 프랜차이즈 AI 수요예측 시스템
--  생성일: 2026-04-24
--  구성: Spring Boot + MySQL
-- ============================================================

-- ============================================================
-- 1. STORE (가맹점)
--    - 가맹점주가 소속된 매장 정보
--    - 본사 관리자가 전체 모니터링하는 단위
-- ============================================================
CREATE TABLE store (
                       store_id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '가맹점 PK',
                       store_name         VARCHAR(100) NOT NULL                COMMENT '가맹점명',
                       region             VARCHAR(100) NOT NULL                COMMENT '지역 (외부 날씨 데이터 매핑용)',
                       address            VARCHAR(255)                         COMMENT '상세 주소',
                       business_type      VARCHAR(50)  NOT NULL                COMMENT '업종 구분 (치킨, 카페 등)',
                       hq_manager_name    VARCHAR(50)                          COMMENT '본사 담당자 성명',
                       hq_manager_contact VARCHAR(20)                          COMMENT '본사 담당자 연락처',
                       is_active          TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '운영 여부',
                       created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                       updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                       PRIMARY KEY (store_id)
) COMMENT '가맹점 테이블';


-- ============================================================
-- 2. USERS (사용자)
--    - 가맹점주(OWNER) / 본사 관리자(ADMIN) 구분
--    - 권한에 따라 대시보드 접근 범위 제어
-- ============================================================
CREATE TABLE users (
                       user_id    BIGINT       NOT NULL AUTO_INCREMENT COMMENT '사용자 PK',
                       store_id   BIGINT                               COMMENT '소속 가맹점 FK (관리자는 NULL)',
                       email      VARCHAR(100) NOT NULL UNIQUE          COMMENT '이메일 (로그인 ID)',
                       password   VARCHAR(255) NOT NULL                 COMMENT '암호화 비밀번호 (BCrypt)',
                       name       VARCHAR(50)  NOT NULL                 COMMENT '성명',
                       contact    VARCHAR(20)                           COMMENT '연락처',
                       role       VARCHAR(20)  NOT NULL DEFAULT 'OWNER' COMMENT '권한: OWNER | ADMIN',
                       is_active  TINYINT(1)   NOT NULL DEFAULT 1       COMMENT '계정 활성 여부',
                       last_login DATETIME                              COMMENT '마지막 로그인 일시',
                       created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                       updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                       PRIMARY KEY (user_id),
                       FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE SET NULL
) COMMENT '사용자 테이블 (가맹점주 / 본사 관리자)';


-- ============================================================
-- 3. MENU (메뉴 마스터)
--    - 가맹점별 판매 메뉴 목록
--    - 매출·예측 데이터가 메뉴 단위로 연결됨
-- ============================================================
CREATE TABLE menu (
                      menu_id    BIGINT        NOT NULL AUTO_INCREMENT COMMENT '메뉴 PK',
                      store_id   BIGINT        NOT NULL                COMMENT '가맹점 FK',
                      menu_name  VARCHAR(100)  NOT NULL                COMMENT '메뉴명',
                      unit_price DECIMAL(10,2) NOT NULL                COMMENT '단가',
                      category   VARCHAR(50)                           COMMENT '메뉴 카테고리 (음료, 식사 등)',
                      is_active  TINYINT(1)    NOT NULL DEFAULT 1      COMMENT '판매 여부',
                      created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      PRIMARY KEY (menu_id),
                      FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '메뉴 마스터 테이블';


-- ============================================================
-- 4. SALES (매출 데이터)
--    - 일일 메뉴별 판매 기록 (CRUD 대상)
--    - AI 예측 모델의 핵심 학습 데이터
-- ============================================================
CREATE TABLE sales (
                       sales_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '매출 PK',
                       store_id     BIGINT        NOT NULL                COMMENT '가맹점 FK',
                       menu_id      BIGINT        NOT NULL                COMMENT '메뉴 FK',
                       sold_at      DATETIME      NOT NULL                COMMENT '판매 일시',
                       quantity     INT           NOT NULL                COMMENT '판매 수량',
                       unit_price   DECIMAL(10,2) NOT NULL                COMMENT '단가 (판매 시점 기준)',
                       total_amount DECIMAL(12,2) NOT NULL                COMMENT '결제 금액 (quantity × unit_price)',
                       created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                       updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                       PRIMARY KEY (sales_id),
                       FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
                       FOREIGN KEY (menu_id)  REFERENCES menu(menu_id)   ON DELETE RESTRICT
) COMMENT '매출 데이터 테이블';


-- ============================================================
-- 5. INVENTORY (식자재 재고)
--    - 가맹점별 식자재 현황 (CRUD 대상)
--    - 폐기율 집계 및 발주 기준 데이터
-- ============================================================
CREATE TABLE inventory (
                           inventory_id    BIGINT        NOT NULL AUTO_INCREMENT COMMENT '재고 PK',
                           store_id        BIGINT        NOT NULL                COMMENT '가맹점 FK',
                           ingredient_name VARCHAR(100)  NOT NULL                COMMENT '식자재명',
                           current_stock   DECIMAL(10,3) NOT NULL DEFAULT 0      COMMENT '현재 재고 수량',
                           unit            VARCHAR(20)   NOT NULL                COMMENT '단위 (kg, box, ea 등)',
                           expiry_date     DATE                                  COMMENT '유통기한',
                           waste_quantity  DECIMAL(10,3) NOT NULL DEFAULT 0      COMMENT '폐기 수량 (폐기율 계산용)',
                           threshold_stock DECIMAL(10,3)                         COMMENT '발주 기준 재고 (이하면 발주 권장)',
                           created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                           updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                           PRIMARY KEY (inventory_id),
                           FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '식자재 재고 테이블';


-- ============================================================
-- 6. EXTERNAL_DATA (외부 데이터)
--    - 날씨·공휴일·이벤트 정보
--    - AI 예측 모델의 외부 변수 (Feature)
--    - store.region 값과 매핑하여 사용
-- ============================================================
CREATE TABLE external_data (
                               external_id       BIGINT       NOT NULL AUTO_INCREMENT COMMENT '외부 데이터 PK',
                               record_date       DATE         NOT NULL                COMMENT '기준 날짜',
                               region            VARCHAR(100) NOT NULL                COMMENT '지역 (store.region 매핑)',
                               temperature       DECIMAL(5,2)                         COMMENT '기온 (℃)',
                               precipitation     DECIMAL(6,2)                         COMMENT '강수량 (mm)',
                               weather_condition VARCHAR(50)                          COMMENT '날씨 상태 (맑음/흐림/비/눈)',
                               is_holiday        TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '공휴일 여부',
                               holiday_name      VARCHAR(100)                         COMMENT '공휴일명 (ex. 설날, 추석)',
                               special_event     VARCHAR(200)                         COMMENT '특수 이벤트 (지역 축제 등)',
                               created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                               PRIMARY KEY (external_id),
                               UNIQUE KEY uq_external_date_region (record_date, region)
) COMMENT '외부 데이터 테이블 (날씨, 공휴일, 이벤트)';


-- ============================================================
-- 7. PREDICTION (AI 수요 예측 결과)
--    - AI 모델이 생성한 메뉴별 예상 판매량 + 발주 권장량
--    - 1주일치 날짜별·메뉴별로 레코드 생성
-- ============================================================
CREATE TABLE prediction (
                            prediction_id      BIGINT        NOT NULL AUTO_INCREMENT COMMENT '예측 PK',
                            store_id           BIGINT        NOT NULL                COMMENT '대상 가맹점 FK',
                            menu_id            BIGINT        NOT NULL                COMMENT '대상 메뉴 FK',
                            predicted_at       DATETIME      NOT NULL                COMMENT '예측 생성 일시',
                            target_date        DATE          NOT NULL                COMMENT '예측 대상 날짜',
                            predicted_quantity INT           NOT NULL                COMMENT '예상 판매량',
                            recommended_order  DECIMAL(10,3)                         COMMENT '권장 발주량',
                            accuracy_score     DECIMAL(5,4)                          COMMENT '예측 정확도 (0.0000~1.0000)',
                            model_version      VARCHAR(50)                           COMMENT '사용된 AI 모델 버전',
                            created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            PRIMARY KEY (prediction_id),
                            FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
                            FOREIGN KEY (menu_id)  REFERENCES menu(menu_id)   ON DELETE CASCADE
) COMMENT 'AI 수요 예측 결과 테이블';


-- ============================================================
-- 8. ORDER_REQUEST (발주 요청)
--    - 가맹점주가 AI 예측 참고 후 본사/유통업체에 발주
--    - 본사 관리자가 상태 업데이트 (공급망 관리)
-- ============================================================
CREATE TABLE order_request (
                               order_id     BIGINT        NOT NULL AUTO_INCREMENT COMMENT '발주 PK',
                               store_id     BIGINT        NOT NULL                COMMENT '가맹점 FK',
                               user_id      BIGINT        NOT NULL                COMMENT '요청자 FK (가맹점주)',
                               ordered_at   DATETIME      NOT NULL                COMMENT '발주 요청 일시',
                               status       VARCHAR(20)   NOT NULL DEFAULT 'REQUESTED'
                                   COMMENT '상태: REQUESTED | CONFIRMED | SHIPPED | COMPLETED | CANCELLED',
                               total_amount DECIMAL(12,2)                         COMMENT '총 발주 금액',
                               note         VARCHAR(500)                          COMMENT '특이사항 메모',
                               created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                               updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                               PRIMARY KEY (order_id),
                               FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE,
                               FOREIGN KEY (user_id)  REFERENCES users(user_id)  ON DELETE RESTRICT
) COMMENT '발주 요청 테이블';


-- ============================================================
-- 9. ORDER_ITEM (발주 품목 상세)
--    - order_request 1건에 여러 식자재 품목 (1:N)
-- ============================================================
CREATE TABLE order_item (
                            order_item_id   BIGINT        NOT NULL AUTO_INCREMENT COMMENT '발주 품목 PK',
                            order_id        BIGINT        NOT NULL                COMMENT '발주 FK',
                            ingredient_name VARCHAR(100)  NOT NULL                COMMENT '식자재명',
                            quantity        DECIMAL(10,3) NOT NULL                COMMENT '발주 수량',
                            unit            VARCHAR(20)   NOT NULL                COMMENT '단위 (kg, box 등)',
                            unit_price      DECIMAL(10,2)                         COMMENT '단가',
                            subtotal        DECIMAL(12,2)                         COMMENT '소계 (quantity × unit_price)',
                            PRIMARY KEY (order_item_id),
                            FOREIGN KEY (order_id) REFERENCES order_request(order_id) ON DELETE CASCADE
) COMMENT '발주 품목 상세 테이블';


-- ============================================================
-- 10. NOTIFICATION (알림)
--    - 재고 부족, 발주 승인 등 가맹점 알림
-- ============================================================
CREATE TABLE notification (
                              notification_id BIGINT       NOT NULL AUTO_INCREMENT COMMENT '알림 PK',
                              store_id        BIGINT       NOT NULL                COMMENT '대상 가맹점 FK',
                              message         VARCHAR(500) NOT NULL                COMMENT '알림 내용',
                              type            VARCHAR(50)                          COMMENT '알림 유형 (재고부족/발주승인 등)',
                              is_read         TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '읽음 여부',
                              created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                              PRIMARY KEY (notification_id),
                              FOREIGN KEY (store_id) REFERENCES store(store_id) ON DELETE CASCADE
) COMMENT '알림 테이블';


-- ============================================================
-- 인덱스 (조회 성능 최적화)
-- ============================================================
-- 매출: 가맹점별·날짜 범위 집계 (대시보드 핵심 쿼리)
CREATE INDEX idx_sales_store_date       ON sales(store_id, sold_at);
-- 재고: 가맹점별 식자재 목록
CREATE INDEX idx_inventory_store        ON inventory(store_id);
-- 유통기한 임박 알림용
CREATE INDEX idx_inventory_expiry       ON inventory(expiry_date);
-- 예측: 가맹점+날짜 기준 조회
CREATE INDEX idx_prediction_store_date  ON prediction(store_id, target_date);
-- 외부 데이터: 날짜+지역 조회
CREATE INDEX idx_external_date_region   ON external_data(record_date, region);
-- 발주: 가맹점별 이력 조회
CREATE INDEX idx_order_store_date       ON order_request(store_id, ordered_at DESC);
-- 발주: 상태별 필터 (본사 관리자 화면)
CREATE INDEX idx_order_status           ON order_request(status);
-- 사용자: 권한별 조회
CREATE INDEX idx_users_role             ON users(role);