import { ReactElement, ReactNode } from 'react';
import { Box } from '@mui/material';

// 로그인·회원가입 화면이 각자 전체 화면 레이아웃을 그린다
const AuthLayout = ({ children }: { children: ReactNode }): ReactElement => {
  return <Box minHeight="100vh" bgcolor="background.default">{children}</Box>;
};

export default AuthLayout;
