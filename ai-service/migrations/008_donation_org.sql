-- 기부처 (DEV_ROADMAP AG-3). 2026-11-06
--
-- 로드맵 초안의 DONATION 테이블은 넣지 않았다: 공용 DB 에 donation_record 가 이미 있다 (2026-11-06 확인, 0행).
-- 실행은 팀 합의 후 사람이 한다 (R1). 한 번만 실행할 것 (INSERT 가 중복된다).
-- 테이블이 없어도 서버는 기동하고 기관 목록 API 만 503 을 돌려준다 (기동 시 감지 → 적용 후 재시작).

CREATE TABLE IF NOT EXISTS DONATION_ORG (
  org_id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  org_name           VARCHAR(100) NOT NULL,
  org_type           VARCHAR(30) NOT NULL,   -- ORPHANAGE, NURSING_HOME, FOOD_BANK, OTHER (프론트 기관 유형과 같음)
  region             VARCHAR(50) NOT NULL,   -- 매장 region 과 포함 관계로 매칭 (경남 ↔ 경남 창원시)
  accepts_categories VARCHAR(255) NULL,      -- 쉼표 구분 INGREDIENT.category, NULL = 전체
  contact            VARCHAR(100) NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE
);

-- 시연용 가상 데이터. 실존 기관이 아니며 연락처도 없다.
INSERT INTO DONATION_ORG (org_name, org_type, region, accepts_categories, contact) VALUES
  ('[예시] 가상 푸드뱅크 서울', 'FOOD_BANK', '서울', '채소류,빵류,유제품', NULL),
  ('[예시] 가상 양로원 서울', 'NURSING_HOME', '서울', '채소류,빵류', NULL),
  ('[예시] 가상 푸드뱅크 경남', 'FOOD_BANK', '경남', '채소류,빵류,유제품', NULL),
  ('[예시] 가상 아동시설 경남', 'ORPHANAGE', '경남', '빵류,유제품', NULL),
  ('[예시] 가상 푸드뱅크 창원', 'FOOD_BANK', '창원', '채소류,빵류,유제품', NULL);
