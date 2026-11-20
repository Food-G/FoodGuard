-- 직원 관리·PIN 출퇴근·POS 좌석 배치 (hyeon 병합, 2026-11-20)
-- 운영(ddl-auto=none)은 테이블을 자동으로 만들지 않으므로 배포 전에 한 번 직접 실행한다.
-- 개발(ddl-auto=update)로 백엔드를 띄운 적이 있으면 이미 있을 수 있어 IF NOT EXISTS.
-- 컬럼은 엔티티(Employee, EmployeeSchedule, Attendance, PosTable)와 같다.

CREATE TABLE IF NOT EXISTS EMPLOYEE (
    employee_id  BIGINT      NOT NULL AUTO_INCREMENT,
    store_id     BIGINT      NOT NULL,
    name         VARCHAR(50) NOT NULL,
    phone        VARCHAR(20),
    hourly_wage  INT         NOT NULL,
    pin          VARCHAR(4)  NOT NULL,
    active       BIT(1)      NOT NULL,
    created_at   DATETIME(6),
    PRIMARY KEY (employee_id)
);

CREATE TABLE IF NOT EXISTS EMPLOYEE_SCHEDULE (
    schedule_id  BIGINT  NOT NULL AUTO_INCREMENT,
    employee_id  BIGINT  NOT NULL,
    store_id     BIGINT  NOT NULL,
    weekday      INT     NOT NULL,
    start_time   TIME(6) NOT NULL,
    end_time     TIME(6) NOT NULL,
    PRIMARY KEY (schedule_id)
);

CREATE TABLE IF NOT EXISTS ATTENDANCE (
    attendance_id  BIGINT      NOT NULL AUTO_INCREMENT,
    employee_id    BIGINT      NOT NULL,
    store_id       BIGINT      NOT NULL,
    clock_in       DATETIME(6) NOT NULL,
    clock_out      DATETIME(6),
    PRIMARY KEY (attendance_id)
);

CREATE TABLE IF NOT EXISTS POS_TABLE (
    table_id  BIGINT      NOT NULL AUTO_INCREMENT,
    store_id  BIGINT      NOT NULL,
    name      VARCHAR(20) NOT NULL,
    x         INT         NOT NULL,
    y         INT         NOT NULL,
    w         INT         NOT NULL,
    h         INT         NOT NULL,
    seats     INT         NOT NULL,
    PRIMARY KEY (table_id)
);
