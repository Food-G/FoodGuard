-- 예측 이력 보존 (append-only). 2026-10-16
--
-- PREDICTION_RESULT 는 재예측 때 미래분을 DELETE 하고 created_at 도 비어 있어서
-- "언제 한 예측이 얼마나 맞았나"를 알 수 없다. 이 테이블은 지우지 않는다.
--   source = 'live'     : 실제 서비스에서 저장한 예측 (save_predictions_bulk 가 같이 기록)
--   source = 'backtest' : 과거 데이터로 시점을 되돌려 만든 예측 (ml/backtest.py)
-- 메뉴가 삭제돼도 이력이 남도록 FK 는 걸지 않는다.

CREATE TABLE IF NOT EXISTS prediction_log (
    log_id         BIGINT       NOT NULL AUTO_INCREMENT,
    run_id         VARCHAR(36)  NOT NULL,              -- 한 번의 예측/백테스트 실행 묶음
    source         VARCHAR(20)  NOT NULL DEFAULT 'live',
    store_id       BIGINT       NOT NULL,
    menu_id        BIGINT       NOT NULL,
    predicted_at   DATETIME     NOT NULL,              -- 예측을 만든 시점 (백테스트는 기준일 23:59:59)
    target_date    DATE         NOT NULL,
    horizon_days   INT          NOT NULL,              -- target_date - DATE(predicted_at)
    predicted_qty  INT          NOT NULL,
    confidence     DECIMAL(5,2) NULL,
    model_version  VARCHAR(50)  NULL,
    PRIMARY KEY (log_id),
    KEY idx_eval (store_id, menu_id, target_date),
    KEY idx_run (run_id)
);
