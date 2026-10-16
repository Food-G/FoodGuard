import React, { useState } from 'react';
import {
  Box,
  Link,
  Paper,
  Stack,
  Button,
  TextField,
  IconButton,
  Typography,
  InputAdornment,
  Alert,
  alpha,
  Divider
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';

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
      setError('로그인 실패: 정보를 다시 확인해 주세요.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Stack sx={{ flexGrow: 1, py: 10, px: 2 }} alignItems="center" justifyContent="center">
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Stack direction="row" alignItems="center" gap={1.5} justifyContent="center" mb={2}>
            <IconifyIcon icon="mingcute:leaf-fill" color="primary.main" width={48} height={48} />
            <Typography variant="h2" fontWeight={900} color="primary.main" sx={{ letterSpacing: '-0.05em' }}>
              FoodGuard
            </Typography>
          </Stack>
          <Typography variant="h6" color="text.secondary" fontWeight={500}>
            지구를 위한 스마트한 식자재 관리
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            py: 8,
            px: { xs: 4, sm: 6 },
            width: '100%',
            maxWidth: 480,
            borderRadius: 6,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Stack component="form" onSubmit={handleSubmit} gap={4}>
            <Box textAlign="center" mb={2}>
              <Typography variant="h4" fontWeight={800} color="text.primary" gutterBottom>
                반갑습니다!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                서비스 이용을 위해 로그인이 필요합니다.
              </Typography>
            </Box>

            {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}

            <TextField
              fullWidth
              variant="filled"
              label="이메일 주소"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{
                '& .MuiFilledInput-root': {
                  bgcolor: 'grey.50',
                  borderRadius: 3,
                  '&:before, &:after': { display: 'none' }
                }
              }}
            />

            <TextField
              fullWidth
              variant="filled"
              label="비밀번호"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{
                '& .MuiFilledInput-root': {
                  bgcolor: 'grey.50',
                  borderRadius: 3,
                  '&:before, &:after': { display: 'none' }
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      <IconifyIcon icon={showPassword ? 'mingcute:eye-2-line' : 'mingcute:eye-close-line'} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{
                py: 2,
                borderRadius: 3,
                fontSize: '1.1rem',
                fontWeight: 700,
                boxShadow: (theme) => `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`
              }}
            >
              로그인하기
            </Button>

            <Divider>
              <Typography variant="body2" color="text.disabled">또는</Typography>
            </Divider>

            <Stack direction="row" gap={2}>
              <Button fullWidth variant="outlined" sx={{ borderRadius: 3, py: 1.5, borderColor: 'divider', color: 'text.primary' }}>
                <IconifyIcon icon="flat-color-icons:google" width={24} sx={{ mr: 1 }} /> Google
              </Button>
              <Button fullWidth variant="outlined" sx={{ borderRadius: 3, py: 1.5, borderColor: 'divider', color: 'text.primary' }}>
                <IconifyIcon icon="logos:facebook" width={24} sx={{ mr: 1 }} /> Facebook
              </Button>
            </Stack>

            <Box textAlign="center" mt={2}>
              <Typography variant="body2" color="text.secondary">
                계정이 없으신가요?{' '}
                <Link component={RouterLink} to="/signup" fontWeight={700} underline="none">
                  회원가입 하기
                </Link>
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>
      
      <Box sx={{ py: 4, textAlign: 'center', opacity: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          © 2026 FoodGuard Team. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );};

export default Login;
