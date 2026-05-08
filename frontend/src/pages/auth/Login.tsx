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
<<<<<<< HEAD
=======

const FoodGuardLoginLogo = () => (
  <Stack alignItems="center" gap={1.5} mb={1}>
    <Box
      sx={{
        width: 72,
        height: 72,
        borderRadius: '20px',
        background: 'linear-gradient(135deg, #43a047 0%, #1e88e5 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(67,160,71,0.35)',
      }}
    >
      <IconifyIcon icon="mingcute:leaf-fill" color="white" width={40} height={40} />
    </Box>
    <Box textAlign="center">
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: '2rem',
          lineHeight: 1,
          background: 'linear-gradient(135deg, #43a047 0%, #1e88e5 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px',
        }}
      >
        FoodGuard
      </Typography>
      <Typography
        sx={{
          fontSize: '0.7rem',
          color: 'text.secondary',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          mt: 0.3,
        }}
      >
        AI 식자재 수요 예측 플랫폼
      </Typography>
    </Box>
  </Stack>
);
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)

const Login = ({ onLogin }: { onLogin: (token: string) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const token = await authService.login({ email, password });
      onLogin(token);
      navigate('/');
    } catch (err: any) {
      setError('로그인 실패: 정보를 다시 확인해 주세요.');
    }
  };

  return (
<<<<<<< HEAD
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
=======
    <>
      <Box mb={4} mx="auto" textAlign="center">
        <FoodGuardLoginLogo />
      </Box>
      <Paper sx={{ py: 6, px: { xs: 5, sm: 7.5 } }}>
        <Stack component="form" onSubmit={handleSubmit} justifyContent="center" gap={5}>
          <Typography variant="h3" textAlign="center" color="text.secondary">
            로그인
          </Typography>
          <Typography variant="h6" fontWeight={500} textAlign="center" color="text.primary">
            계정이 없으신가요?{' '}
            <Link component={RouterLink} to="/signup" sx={{ cursor: 'pointer' }} underline="none">
              회원가입
            </Link>
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            variant="filled"
            label="이메일"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{
              '.MuiFilledInput-root': {
                bgcolor: 'grey.A100',
                ':hover': { bgcolor: 'background.default' },
                ':focus-within': { bgcolor: 'background.default' },
              },
              borderRadius: 2,
            }}
          />
          <TextField
            variant="filled"
            label="비밀번호"
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{
              '.MuiFilledInput-root': {
                bgcolor: 'grey.A100',
                ':hover': { bgcolor: 'background.default' },
                ':focus-within': { bgcolor: 'background.default' },
              },
              borderRadius: 2,
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((p) => !p)}
                    size="small"
                    edge="end"
                    sx={{ mr: 2 }}
                  >
                    {showPassword ? (
                      <IconifyIcon icon="el:eye-open" color="text.secondary" />
                    ) : (
                      <IconifyIcon icon="el:eye-close" color="text.primary" />
                    )}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button type="submit" sx={{ fontWeight: 'fontWeightRegular', py: 1.5 }}>
            로그인
          </Button>
        </Stack>
      </Paper>
    </>
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
  );
};

export default Login;
