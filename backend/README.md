# FoodGuard Backend

Java 17 이상이 필요하다. `JAVA_HOME`이 Java 11을 가리키면 `gradlew`가 "requires at least JVM runtime version 17" 오류로 멈춘다. PowerShell에서는 `$env:JAVA_HOME="C:\Program Files\Java\jdk-17"`처럼 17을 지정한 뒤 실행한다.

## 실행 전 비밀 값 설정

DB 접속 정보와 JWT 서명 키는 저장소에 두지 않는다. 아래 4개 값을 두 방법 중 하나로 넣는다.
값이 없으면 `Could not resolve placeholder 'DB_URL'` 같은 오류로 서버가 뜨지 않는다.

| 이름 | 내용 |
|---|---|
| `DB_URL` | TiDB Cloud 콘솔 Connect 화면의 JDBC URL (예: `jdbc:mysql://<host>:4000/<db>?sslMode=VERIFY_IDENTITY`) |
| `DB_USERNAME` | DB 사용자 |
| `DB_PASSWORD` | DB 비밀번호 |
| `JWT_SECRET` | JWT 서명 키. 32자 이상 임의 문자열 |

DB 값은 팀이 같은 TiDB를 쓰므로 비공개 채널로 공유한다. JWT 키는 아래처럼 만든다.

```bash
openssl rand -base64 48
```

### 방법 1: `application-local.properties` (권장)

`backend/src/main/resources/application-local.properties`를 만든다. 이 파일은 `.gitignore`로 커밋에서 빠진다.

```properties
DB_URL=jdbc:mysql://<host>:4000/<db>?sslMode=VERIFY_IDENTITY
DB_USERNAME=<user>
DB_PASSWORD=<password>
JWT_SECRET=<32자 이상 임의 문자열>
```

### 방법 2: 환경변수

PowerShell (그 창에서만 유효):

```powershell
$env:DB_URL="jdbc:mysql://<host>:4000/<db>?sslMode=VERIFY_IDENTITY"
$env:DB_USERNAME="<user>"
$env:DB_PASSWORD="<password>"
$env:JWT_SECRET="<32자 이상 임의 문자열>"
.\gradlew.bat bootRun
```

IntelliJ는 Run Configuration → Environment variables에 같은 값을 넣는다.

## 계정 권한

회원가입은 점주(`OWNER`)만 가능하다. 본사 관리자 계정은 DB에서 직접 바꾼다.

```sql
UPDATE USER SET role = 'HQ_ADMIN' WHERE email = '<본사 계정 이메일>';
```
