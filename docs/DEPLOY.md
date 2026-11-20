# 배포 절차

구성: Caddy(HTTPS) → nginx(프론트, `/api`·`/ws` 프록시) → Spring Boot → FastAPI(내부 전용), DB 는 TiDB Cloud.
서버 1대 기준이다. 횟수 제한이 메모리에 있어 여러 대로 늘리면 공유 저장소로 옮겨야 한다.

## 배포 전 (사람이 직접)

- [ ] TiDB 접속 허용 IP 를 서버 IP 와 팀원 IP 로 제한
- [ ] `JWT_SECRET` 새로 생성. 이전 값은 git 이력에 남아 있었다
- [ ] 저장소에 비밀번호가 남은 브랜치 정리 (`junho` 의 `application.properties`). DB 비밀번호는 교체됨
- [ ] 도메인 A 레코드를 서버 IP 로 연결, 서버 방화벽은 22·80·443 만

## 스키마

운영은 `ddl-auto=none` 이라 **자동으로 바뀌지 않는다.** 엔티티를 바꾸면 SQL 을 직접 실행한다.
공유 DB 를 쓰면 지금 스키마가 그대로 반영되어 있다. `validate` 는 공유 DB 의 대문자 `STORE`·`USER` 때문에 쓸 수 없다.

## 실행

```bash
cp .env.prod.example .env.prod
```

값을 채운 뒤:

```bash
docker compose --env-file .env.prod up -d --build
```

## Claude CLI 로그인

AI 기능(근거 설명, 특이사항, 입력, 제안, 참모, 리포트, 비서)은 서비스 안의 `claude` 가 로그인되어 있어야 한다. 로그인은 볼륨에 남는다.

```bash
docker compose --env-file .env.prod exec ai-service claude
```

**시제품용이다.** 실제 점주에게 서비스하려면 Anthropic API 키 방식으로 바꾸는 것이 맞다 (사용량·비용 관리, 약관). `services/claude_cli.py` 한 곳만 바꾸면 된다. 로그인이 안 되어 있으면 AI 기능만 503 오류이고 나머지는 동작한다.

## 확인

```bash
curl -fs https://도메인/api/health
```

`{"status":"ok"}` 이면 DB 까지 정상이다. 이어서 로그인, 예측 실행, POS 결제를 한 번씩 한다.

## 운영

- 로그: `docker compose logs -f backend`
- 재고·데이터 점검 알림은 매일 07:00 (KST) 자동 실행
- AI 호출은 사용자당 분당 20회 (`app.ai.max-calls-per-minute`), 로그인 실패 10회면 그 계정 10분 차단
- 백업: TiDB Cloud 자동 백업 설정을 확인한다

## 알려진 한계

- 예측 1회 약 30초 (요청 안에서 모델 학습). 매장이 많아지면 야간 학습으로 분리 필요
- 수요 예측 정확도·폐기 감소 수치는 데모 데이터 기준이다 (`ai-service/PROJECT_STATUS.md`)
