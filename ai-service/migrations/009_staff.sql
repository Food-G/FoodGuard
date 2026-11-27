-- 매장 직원 (직원 관리 화면: 직원 목록·출퇴근 현황). 2026-11-27
--
-- 실행은 팀 합의 후 사람이 한다 (R1). CREATE TABLE IF NOT EXISTS 라 여러 번 실행해도 된다.
-- 테이블이 없어도 서버는 기동하고 직원 API 만 503 을 돌려준다 (기동 시 감지 → 적용 후 재시작).

CREATE TABLE IF NOT EXISTS STAFF (
  staff_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id    BIGINT NOT NULL,
  name        VARCHAR(50) NOT NULL,
  role        VARCHAR(30) NOT NULL,          -- 매니저, 주방, 홀, 파트타임 등 (자유 입력)
  work_days   VARCHAR(27) NOT NULL,          -- 쉼표 구분 요일: MON,TUE,WED,THU,FRI,SAT,SUN
  start_time  CHAR(5) NOT NULL,              -- 'HH:MM' (24시간)
  end_time    CHAR(5) NOT NULL,              -- 'HH:MM', start_time 보다 늦어야 한다 (자정 넘는 근무는 아직 없음)
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_staff_store (store_id)
);
