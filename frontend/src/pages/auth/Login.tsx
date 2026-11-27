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
  alpha,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import AuthVisual, { enter } from '../../components/AuthVisual';

import { authService } from '../../services/authService';

const FEATURES = [
  { icon: 'mingcute:brain-fill', text: 'AI 수요 예측으로 필요한 만큼만 발주' },
  { icon: 'mingcute:robot-line', text: '에이전트가 먼저 찾고, 결정은 사장님이' },
  { icon: 'mingcute:heart-line', text: '남는 식자재는 이웃에게 기부로' },
];

const fieldSx = {
  '& .MuiFilledInput-root': {
    bgcolor: 'grey.50',
    borderRadius: 3,
    '&:before, &:after': { display: 'none' },
  },
};

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
      setError('로그인 실패: 정보를 다시 확인해 주세요.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      <AuthVisual
        eyebrow="AI FOOD MANAGEMENT"
        title={<>버려지는 식자재 없이,<br />똑똑한 매장 운영</>}
        features={FEATURES}
      />

      {/* ── 로그인 폼 ── */}
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{
          flex: { md: '1 1 45%' }, bgcolor: 'background.paper', position: 'relative',
          px: { xs: 3, sm: 5 }, py: { xs: 4, md: 6 },
          mt: { xs: -4, md: 0 }, borderRadius: { xs: '28px 28px 0 0', md: 0 }, // 모바일: 배너 위로 살짝 겹치는 시트
        }}
      >
        <Stack component="form" onSubmit={handleSubmit} gap={3} sx={{ width: 1, maxWidth: 420 }}>
          <Box sx={enter(2)}>
            <Typography variant="h4" fontWeight={800} color="text.primary" gutterBottom>
              반갑습니다!
            </Typography>
            <Typography variant="body1" color="text.secondary">
              서비스 이용을 위해 로그인이 필요합니다.
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

          <Box sx={enter(3)}>
            <TextField
              fullWidth
              variant="filled"
              label="이메일 주소"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={fieldSx}
            />
          </Box>

          <Box sx={enter(4)}>
            <TextField
              fullWidth
              variant="filled"
              label="비밀번호"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={fieldSx}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)}>
                      <IconifyIcon icon={showPassword ? 'mingcute:eye-2-line' : 'mingcute:eye-close-line'} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            size="large"
            endIcon={<IconifyIcon icon="mingcute:arrow-right-line" />}
            sx={{
              py: 1.8,
              borderRadius: 3,
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: (theme) => `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`,
              transition: 'transform .2s, box-shadow .2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.primary.main, 0.32)}` },
              ...enter(5),
            }}
          >
            로그인하기
          </Button>

          <Box textAlign="center" sx={enter(6)}>
            <Typography variant="body2" color="text.secondary">
              계정이 없으신가요?{' '}
              <Link component={RouterLink} to="/signup" fontWeight={700} underline="none">
                회원가입 하기
              </Link>
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
};

export default Login;
