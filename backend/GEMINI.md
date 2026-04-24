# 🔙 Backend Development Guide

백엔드 개발 시 MySQL 8.0.45 스키마와의 호환성을 최우선으로 합니다.

## 🗄 Database & Entity Rules (MySQL 8.0.45)
- **Column Mapping**: 모든 엔티티 필드는 `@Column(name = "xxx_id")` 등 DB 컬럼명을 명시적으로 매핑합니다. (PK는 반드시 `xxx_id` 형식)
- **Service Compatibility**: 기존 Service 코드가 요구하는 필드/메서드가 DB에 없을 경우, `@Transient`를 사용하여 데이터베이스 통신에서는 제외하되 컴파일 에러를 방지합니다.
- **Join Mapping**: `Long id` 대신 `@ManyToOne` 객체 지향 연관 관계를 사용하여 리포지토리 쿼리 메서드가 동작하게 합니다.

## 🔑 API & Security
- **Auth Status**: 로그인 실패 시 단순히 문자열을 반환하지 말고, 반드시 `401 Unauthorized` 또는 `400 Bad Request` 응답을 사용합니다.
- **Logging**: 주요 로직(로그인, 회원가입 등)에는 `log.info`를 사용하여 실행 내역을 추적 가능하게 합니다.

## 📝 Coding Standard
- **Lombok**: `@Getter`, `@Setter`, `@NoArgsConstructor`를 필수로 사용합니다.
- **Validation**: 입력 데이터에 대한 유효성 검증을 Controller/Service 레이어에서 철저히 수행합니다.
