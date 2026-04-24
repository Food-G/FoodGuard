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
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import Image from '../../components/base/Image';
import { authService } from '../../services/authService';
const logoWithText = '/Logo-with-text.png';

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
      setError('로그인 실패: ' + err.message);
    }
  };

  const handleClickShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <>
      <Box component="figure" mb={5} mx="auto" textAlign="center">
        <Link href="/">
          <Image src={logoWithText} alt="logo with text" height={60} />
        </Link>
      </Box>
      <Paper
        sx={{
          py: 6,
          px: { xs: 5, sm: 7.5 },
        }}
      >
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
                ':focus': { bgcolor: 'background.default' },
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
                ':focus': { bgcolor: 'background.default' },
                ':focus-within': { bgcolor: 'background.default' },
              },
              borderRadius: 2,
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
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
          
          <Button
            type="submit"
            sx={{
              fontWeight: 'fontWeightRegular',
              py: 1.5
            }}
          >
            로그인
          </Button>
        </Stack>
      </Paper>
    </>
  );
};

export default Login;
