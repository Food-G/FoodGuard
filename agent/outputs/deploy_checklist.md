# 배포 전 설정 변경안 (v3 STEP 5)

작성 2026-10-30 · 기준 `jihwan` `2b93a76` · **코드는 바꾸지 않았다. 변경안과 검증 방법만 적는다.**
관련 이슈: I-26(AI 서비스 인증·CORS), I-27(운영 설정), I-29(예측 25초), I-36(TiDB 유휴 연결), I-14·I-34(비밀 값), I-30(공용 식자재), I-35(스키마 정책)

우선순위: **필수** 배포 전 반드시 / **권장** 시연 안정성 / **선택** 여유가 있으면

---

## 1. 필수

### 1-1. AI 서비스 외부 접근 차단 (I-26)
- 현재
  - 인증 없음. 백엔드가 헤더 없이 호출 (`backend/.../service/PredictionService.java:34`, `OrderExplainService.java:38`, `StoreEventNoteService.java:53`)
  - CORS 전부 허용: `ai-service/main.py:18-21` (`allow_origins=["*"]`, `allow_credentials=True`)
  - 모든 인터페이스에서 대기: `ai-service/main.py:41` (`host="0.0.0.0"`, `reload=True`)
- 변경안
  1. 실행 주소를 `127.0.0.1`로 (백엔드와 같은 서버에서만 접근), 운영에서는 `reload=False`
  2. 공유 키 헤더: AI 서비스 `config.py`에 `INTERNAL_API_KEY`, FastAPI 의존성으로 `X-Internal-Key` 검사(불일치 401). 백엔드 `AppConfig` RestTemplate에 같은 헤더를 붙이는 인터셉터, 값은 `backend/.env`
  3. CORS 미들웨어 제거 (브라우저가 AI 서비스를 직접 부르지 않음 — 프론트는 `/api`만 백엔드로 프록시, `frontend/vite.config.ts:14-21`)
- 영향: `explain`, `events`, `predict`, `train` 모든 호출에 헤더 필요. 키가 다르면 예측·설명·특이사항 저장이 모두 실패
- 검증: 헤더 없는 `curl -X POST http://127.0.0.1:8000/api/predict/store/1` → 401, 백엔드 경유 예측 → 200. 다른 PC에서 8000 포트 접속 불가 확인. 단위 테스트: 키 없음 401·틀림 401·맞음 통과

### 1-2. 운영 프로필 분리 (I-27, I-35)
- 현재 `backend/src/main/resources/application.properties`
  - `:16` `ddl-auto=update` (기동 시 공유 TiDB 스키마 자동 변경)
  - `:17-18` `show-sql=true`, `format_sql=true` (로그에 모든 SQL)
  - `CorsConfig.java:13-16` 개발 주소(5173, 3000)만, `WebSocketConfig.java:22` `setAllowedOriginPatterns("*")`
- 변경안: `application-prod.properties` 추가, 서버에서 `SPRING_PROFILES_ACTIVE=prod`
  - `ddl-auto=validate` (엔티티와 DB가 다르면 기동 실패로 알림. 스키마 변경은 마이그레이션 SQL로 사람이 실행 — junho 로드맵 R1 방식, I-35 결정 후)
  - `show-sql=false`, `format_sql=false`
  - CORS·WebSocket 허용 출처를 운영 도메인 한 곳으로 (`app.cors.allowed-origins` 속성으로 빼서 프로필별 값)
  - `jwt.expiration`은 현재 1시간(`:23`) 유지 또는 팀 결정
- 영향: `validate`로 바꾸기 전에 현재 공유 DB 스키마와 엔티티가 일치해야 함. 빈 `SALES_TARGET` 테이블(PROJECT_STATUS 13절)은 validate에 영향 없음(엔티티 없는 테이블은 검사 안 함)
- 검증: prod 프로필로 기동해 로그에 SQL이 안 찍히는지, 엔티티 컬럼 하나를 일부러 바꾸면 기동이 실패하는지(로컬 DB에서만), 다른 출처에서 API 호출 시 CORS 거부

### 1-3. 비밀 값 교체와 접근 제한 (I-14, I-34)
- 현재: 옛 DB 비밀번호·JWT 키가 공개 저장소 이력과 `junho` 브랜치 최신 파일에 평문으로 있음
- 변경안 (사람이 직접): TiDB 콘솔에서 비밀번호 재설정, 새 JWT 키 생성, TiDB "IP Access List"를 팀원·서버 IP로 제한. 서버에는 `backend/.env`, `ai-service/.env`로만 배치
- 검증: 옛 비밀번호로 접속 실패, 등록되지 않은 IP에서 접속 실패, 새 값으로 백엔드·AI 기동 성공

---

## 2. 권장

### 2-1. TiDB 유휴 연결 끊김 대응 (I-36)
- 현재: 백엔드 Hikari 설정 없음(`application.properties`에 hikari 항목 없음), AI `ai-service/database.py:10-11` `pool_pre_ping=True`, `pool_recycle=3600`
- 변경안 (junho `dda675c`와 같은 값): `spring.datasource.hikari.max-lifetime=180000`, `spring.datasource.hikari.keepalive-time=60000` / AI `pool_recycle=180`
- 근거: junho 커밋 설명 — TiDB Cloud가 먼저 끊은 연결을 재사용해 30초 타임아웃 후 500, 재예측 중 Lost connection
- 검증: 백엔드를 띄우고 10분 이상 요청 없이 둔 뒤 첫 API 호출이 정상 응답하는지

### 2-2. 예측 요청 비동기화 (I-29)
- 현재: `PredictionController.java:25-26` → `PredictionService.java:31-34`가 AI 서비스를 동기 호출, 백엔드 읽기 타임아웃 60초(`AppConfig.java:21`). 예측 1회 약 25초(글로벌 모델 학습 + conformal 재학습, PROJECT_STATUS P1-2)
- 변경안 (단계적)
  1. 최소: 같은 매장 예측이 진행 중이면 중복 요청 거부(409), 프론트 버튼 비활성화
  2. 중간: 백엔드 `@Async`로 접수만 하고 202 반환, 프론트는 예측 결과를 주기적으로 조회
  3. 근본: AI 서비스에서 글로벌 모델을 하루 1회(예: 새벽) 학습해 저장하고, 매장 예측 요청은 저장된 모델로 예측만 수행 → 요청당 수 초
- 영향: 3번은 "요청마다 최신 판매까지 학습"하던 동작이 "하루 1회 학습"으로 바뀜. 백테스트 조건과 달라지므로 PROJECT_STATUS에 명시
- 검증: 예측 버튼 연타 시 AI 호출 1회, 매장 5곳 동시 요청 시 60초 타임아웃 없음

### 2-3. 공용 식자재 수정 권한 (I-30)
- 현재: `store_id`가 빈 기존 식자재 29개를 아무 점주나 수정 가능 (PROJECT_STATUS 13절)
- 변경안: `store_id`가 없는 식자재의 수정·삭제는 HQ_ADMIN만 허용 (`StoreAccessInterceptor`에서 소유 매장 없음 → 본사 전용)
- 검증: 점주 토큰으로 공용 식자재 PUT → 403, 본사 → 200 (`StoreAccessTest`에 케이스 추가)

### 2-4. 오류 메시지 노출
- 현재: `GlobalExceptionHandler.java:17,22`가 `e.getMessage()`를 그대로 응답. 대부분 한글 업무 메시지라 의도된 것이지만, 라이브러리 예외 메시지(SQL·JSON 파싱)도 400으로 나갈 수 있음
- 변경안: 업무 예외 클래스(예: `BusinessException`)만 메시지를 내보내고, 나머지 `RuntimeException`은 일반 문구 + 서버 로그
- 검증: 잘못된 JSON 본문 요청 시 내부 메시지 대신 일반 문구

---

## 3. 선택

### 3-1. 배포 구성 (I-28)
- 현재: 배포 설정 없음. 계획서 예산은 AWS EC2·RDS
- 변경안 (최소 구성): EC2 1대에 백엔드(8080, 내부), AI(8000, 127.0.0.1), 프론트는 `npm run build` 산출물(`frontend/package.json:8`)을 Nginx로 정적 서빙 + `/api`를 8080으로 프록시 + HTTPS(Let's Encrypt). DB는 TiDB Cloud 그대로
- CI에 배포 단계 추가는 그 다음 (보고서 "CI/CD"를 사실로 만들려면 필요)
- 검증: 외부에서 HTTPS 접속 → 로그인 → 예측 실행 → 발주까지 시연 시나리오 1회 통과

### 3-2. 배송 토큰 만료 (junho 로드맵 B-2)
- 현재: `DeliveryController.java:32,50` 토큰만 맞으면 상태와 무관하게 조회·완료 처리
- 변경안: 발송 후 N일 지난 토큰 거부, 완료된 발주 토큰 재사용 거부
- 검증: 완료된 발주의 토큰으로 완료 요청 → 409

---

## 배포 직전 확인표

| # | 항목 | 확인 방법 | 이슈 |
|---|---|---|---|
| 1 | 비밀 값 교체, TiDB IP 제한 | 옛 비밀번호 접속 실패 | I-14, I-34 |
| 2 | AI 서비스 127.0.0.1 + 공유 키 | 외부·무헤더 호출 401/차단 | I-26 |
| 3 | prod 프로필 (`validate`, SQL 로그 끔, CORS 도메인) | 기동 로그, 타 출처 차단 | I-27 |
| 4 | 스키마 정책 결정·마이그레이션 적용 | 엔티티와 DB 일치 | I-35 |
| 5 | TiDB 유휴 연결 설정 | 10분 대기 후 첫 요청 정상 | I-36 |
| 6 | 예측 중복 요청 방지 | 버튼 연타 시 AI 호출 1회 | I-29 |
| 7 | CI 초록불 | GitHub Actions 탭 | I-28 |
