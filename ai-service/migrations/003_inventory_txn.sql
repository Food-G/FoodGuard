-- 재고 원장 (DEV_ROADMAP D-2). 2026-10-30
-- 모든 재고 변동을 1행씩 남긴다 → 폐기율·회전율 산출, "왜 재고가 줄었나" 추적.
-- 쓰기는 backend service/InventoryLedger 한 곳에서만 한다.
-- 실행은 팀 합의 후 사람이 한다 (R1). 테이블이 없으면 서버는 원장 기록만 건너뛴다 (기동 시 감지 → 적용 후 재시작).

CREATE TABLE IF NOT EXISTS INVENTORY_TXN (
  txn_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id      BIGINT NOT NULL,
  ingredient_id BIGINT NOT NULL,
  delta_qty     DECIMAL(12,3) NOT NULL,      -- 기준단위(kg/L/개), +입고 −소모
  reason        VARCHAR(20) NOT NULL,        -- SALE, ORDER_DONE, WASTE, DONATION, ADJUST, INIT
  ref_type      VARCHAR(20) NULL,            -- SALES_DATA, ORDER_REQUEST, WASTE_RECORD, DONATION, INVENTORY, INGREDIENT
  ref_id        BIGINT NULL,
  qty_after     DECIMAL(12,3) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    BIGINT NULL,                 -- user_id (제안 승인자 포함). 배달기사 완료 같은 무인증 경로는 NULL
  INDEX idx_txn_store_ing_time (store_id, ingredient_id, created_at)
);
