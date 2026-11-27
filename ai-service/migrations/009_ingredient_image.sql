-- 식자재 사진 (2026-11-27). 개발 프로필(ddl-auto=update)은 백엔드가 뜰 때 자동으로 추가한다.
-- 운영(ddl-auto=none)은 배포 전에 한 번 실행한다.
-- NULL = 이름으로 고른 자동 일러스트, 'icon:<이름>' = 고른 일러스트, 'data:image/...' = 올린 사진
ALTER TABLE INGREDIENT ADD COLUMN image_url LONGTEXT NULL;
