# 🎨 Frontend Development Guide

프론트엔드 구현 시 `/sample` 폴더의 디자인과 코드 패턴을 100% 준수합니다.

## 💄 Design System (Based on /sample)
- **UI Framework**: Material UI (MUI) 5
- **Layout Patterns**:
  - 카드형 UI: `Paper` 컴포넌트 (`sx={{ py: 6, px: { xs: 5, sm: 7.5 } }}`) 사용
  - 간격 관리: `Stack` 컴포넌트 (`gap: 4` 또는 `gap: 5`)로 일관성 유지
  - 입력창: `TextField`는 `variant="filled"`와 `bgcolor: 'grey.A100'` 스타일을 기본으로 사용
- **Icons**: 모든 아이콘은 `IconifyIcon` 컴포넌트를 사용하여 통일합니다.
- **Typography**: 제목은 `variant="h3"`, 보조 설명은 `variant="h6"`를 주로 사용합니다.

## 🌐 API & Auth Rules
- **API Service**: `src/services/api.ts`를 통해 모든 요청을 처리하며, 에러 발생 시 `throw new Error('API Request Failed')` 패턴을 유지합니다.
- **Strict Auth**: 로그인 여부는 `isLoggedIn: !!token && !!user`로 판단하며, 잘못된 토큰 유입 시 `useAuth` 훅에서 자동 로그아웃 처리합니다.
- **Navigation**: 단순 `onClick` 이동 대신 `react-router-dom`의 `<Link component={RouterLink} ...>` 사용을 권장합니다.

## 📝 Coding Standard
- **Components**: `src/components/base`에 있는 공통 컴포넌트를 우선적으로 재사용합니다.
- **Typescript**: 모든 Props와 State에는 명확한 Interface/Type을 정의합니다.
