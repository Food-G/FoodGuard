-- AI 에이전트 공통 기반 (DEV_ROADMAP AG-0). 2026-10-30
--
-- AGENT_RUN      : 에이전트 1회 실행 기록 (agent-service 가 생성·종료 보고)
-- AGENT_PROPOSAL : 에이전트가 낸 제안. 사람이 승인하면 Spring ProposalExecutor 가 실행한다 (R5)
--
-- 실행은 팀 합의 후 사람이 한다 (R1). 이 테이블이 없어도 서버는 기동하며, /api/agent/** 호출만 실패한다.

CREATE TABLE IF NOT EXISTS AGENT_RUN (
  run_id        VARCHAR(36) PRIMARY KEY,
  agent         VARCHAR(30) NOT NULL,      -- order_advisor, waste, donation, hq_review, mlops, audit, inbound, chat, echo
  store_id      BIGINT NULL,
  trigger_type  VARCHAR(20) NOT NULL,      -- SCHEDULE, EVENT, MANUAL, CHAT
  status        VARCHAR(20) NOT NULL,      -- RUNNING, OK, FAILED
  model         VARCHAR(50) NULL,
  input_tokens  INT NULL,
  output_tokens INT NULL,
  result_json   JSON NULL,                 -- 최종 구조화 출력 + 도구 호출 로그
  error         TEXT NULL,
  started_at    DATETIME NOT NULL,
  finished_at   DATETIME NULL,
  INDEX idx_run_agent_store (agent, store_id, started_at)
);

CREATE TABLE IF NOT EXISTS AGENT_PROPOSAL (
  proposal_id  BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id       VARCHAR(36) NOT NULL,
  agent        VARCHAR(30) NOT NULL,
  store_id     BIGINT NOT NULL,
  type         VARCHAR(30) NOT NULL,      -- ORDER_CREATE, WASTE_RECORD, DONATION_CREATE, DISCOUNT_SUGGEST, ORDER_REDUCE, AUDIT_REPORT, WEEKLY_BRIEFING, MODEL_PROMOTE, ORDER_FLAG
  payload      JSON NOT NULL,             -- 결정적 코드가 만든 실행 파라미터 (LLM 이 만들지 않음, R4)
  rationale    TEXT NOT NULL,             -- LLM 브리핑
  fingerprint  VARCHAR(64) NULL,
  status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, APPROVED, REJECTED, EXECUTED, FAILED, STALE, EXPIRED
  expires_at   DATETIME NOT NULL,
  decided_by   BIGINT NULL,
  decided_at   DATETIME NULL,
  exec_result  JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prop_store_status (store_id, status)
);

-- USER.role enum 에 AGENT 추가 (아래 2) 의 UPDATE 가 'Data truncated' 로 실패하지 않도록)
ALTER TABLE USER MODIFY role ENUM('OWNER','HQ_ADMIN','AGENT') NOT NULL DEFAULT 'OWNER';

-- ── 에이전트 서비스 계정 (사람이 1회 실행) ─────────────────────────────
-- 회원가입 API 는 AGENT 역할을 받지 않으므로, 일반 계정으로 가입한 뒤 역할만 바꾼다.
--   1) POST /api/auth/signup  {"email":"agent@foodguard.local","password":"<랜덤>","userName":"FoodGuard Agent","role":"OWNER"}
--      (storeName 을 비워 두면 매장이 생기지 않는다)
--   2) UPDATE USER SET role = 'AGENT' WHERE email = 'agent@foodguard.local';
--   3) ai-service/.env 에 FOODGUARD_AGENT_EMAIL / FOODGUARD_AGENT_PASSWORD 추가
