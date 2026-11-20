-- 매장 예약 (2026-11-20)
-- 운영(ddl-auto=none)은 테이블을 자동으로 만들지 않으므로 배포 전에 한 번 직접 실행한다.
-- 개발(ddl-auto=update)로 백엔드를 띄운 적이 있으면 이미 있을 수 있어 IF NOT EXISTS.
-- 컬럼은 엔티티(Reservation)와 같다.

CREATE TABLE IF NOT EXISTS RESERVATION (
    reservation_id    BIGINT       NOT NULL AUTO_INCREMENT,
    store_id          BIGINT       NOT NULL,
    customer_name     VARCHAR(50)  NOT NULL,
    phone             VARCHAR(20),
    reservation_date  DATE         NOT NULL,
    reservation_time  TIME(6)      NOT NULL,
    guests            INT          NOT NULL,
    status            VARCHAR(20)  NOT NULL,
    note              VARCHAR(200),
    created_at        DATETIME(6),
    PRIMARY KEY (reservation_id)
);
