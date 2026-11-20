-- 입고 로트 (DEV_ROADMAP D-3). 2026-10-30
--
-- 로드맵 초안의 `ALTER TABLE INGREDIENT ADD COLUMN shelf_life_days` 는 넣지 않았다:
-- 공용 DB 의 ingredient 테이블에 shelf_life_days INT NULL 이 이미 있다 (2026-10-30 확인, 전부 NULL).
-- 값은 ai-service/seed_shelf_life.py 로 채운다 (사람 확인 후 --apply).
--
-- 재고 행(INVENTORY.current_qty)이 진실이다. 로트 합계가 어긋나면 서버(InventoryLedger)가
-- 먼저 들어온·유통기한이 이른 로트부터 깎거나, 모자라면 expiry_date NULL 로트로 보정한다.
-- 실행은 팀 합의 후 사람이 한다 (R1). 테이블이 없으면 서버는 로트 관리만 건너뛴다 (기동 시 감지 → 적용 후 재시작).
-- 기존 재고 이관: ai-service/backfill_lots.py (사람 확인 후 --apply).

CREATE TABLE IF NOT EXISTS INVENTORY_LOT (
  lot_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id      BIGINT NOT NULL,
  ingredient_id BIGINT NOT NULL,
  order_id      BIGINT NULL,                 -- 발주 입고 로트면 ORDER_REQUEST id, 보정·이관 로트는 NULL
  received_qty  DECIMAL(12,3) NOT NULL,
  remaining_qty DECIMAL(12,3) NOT NULL,
  received_at   DATETIME NOT NULL,
  expiry_date   DATE NULL,                   -- NULL = 유통기한 관리 안 함 (보관일수 없음 또는 보정분)
  INDEX idx_lot_fifo (store_id, ingredient_id, expiry_date)
);
