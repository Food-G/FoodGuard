import React, { useState } from 'react';
import {
  Box,
  Link,
  Stack,
  Button,
  TextField,
  IconButton,
  Typography,
  InputAdornment,
  Alert,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import AuthShell from '../../components/AuthShell';

import { authService } from '../../services/authService';

const Login = ({ onLogin }: { onLogin: (token: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = await authService.login({ email, password });
      onLogin(token);
      navigate('/');
    } catch (err: any) {
      // 서버 안내 문구 (틀린 정보, 반복 실패 차단)
      setError(err.message || '로그인에 실패했습니다.');
    }
  };

  return (
    <AuthShell>
      <Stack component="form" onSubmit={handleSubmit} gap={4}>
        <Box mb={2}>
          <Typography fontSize={28} fontWeight={700} mb={1}>로그인</Typography>
          <Typography color="text.secondary" fontSize={15}>가맹점 계정으로 로그인해 주세요.</Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <TextField
          fullWidth
          label="이메일"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          fullWidth
          label="비밀번호"
          required
          autoComplete="current-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ mr: 1 }}>
                  <IconifyIcon icon={showPassword ? 'mingcute:eye-2-line' : 'mingcute:eye-close-line'} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button type="submit" fullWidth size="large" sx={{ py: 2, fontSize: 16, mt: 2 }}>
          로그인
        </Button>

        <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
          계정이 없으신가요?{' '}
          <Link component={RouterLink} to="/signup" fontWeight={700} underline="none">
            회원가입
          </Link>
        </Typography>
      </Stack>
    </AuthShell>
  );
};

export default Login;
