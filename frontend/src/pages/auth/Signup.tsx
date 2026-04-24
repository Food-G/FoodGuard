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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import Image from '../../components/base/Image';
import { authService } from '../../services/authService';
const logoWithText = '/Logo-with-text.png';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('OWNER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await authService.signup({ email, password, role });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
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
        <Stack component="form" onSubmit={handleSubmit} justifyContent="center" gap={4}>
          <Typography variant="h3" textAlign="center" color="text.secondary">
            계정 생성
          </Typography>
          <Typography variant="h6" fontWeight={500} textAlign="center" color="text.primary">
            이미 계정이 있으신가요?{' '}
            <Link component={RouterLink} to="/login" sx={{ cursor: 'pointer' }} underline="none">
              로그인
            </Link>
          </Typography>
          
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">회원가입 성공! 로그인 페이지로 이동합니다.</Alert>}

          <TextField
            variant="filled"
            label="이메일 주소"
            type="email"
            required
            fullWidth
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
            fullWidth
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

          <TextField
            variant="filled"
            label="비밀번호 확인"
            required
            fullWidth
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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

          <FormControl fullWidth variant="filled">
            <InputLabel>가입 유형</InputLabel>
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as string)}
              sx={{
                bgcolor: 'grey.A100',
                borderRadius: 2,
                '&:before, &:after': { display: 'none' },
              }}
            >
              <MenuItem value="OWNER">가맹점 점주</MenuItem>
              <MenuItem value="HQ">본사 관리자</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{
              fontWeight: 'fontWeightRegular',
              py: 1.5,
              mt: 2
            }}
          >
            가입하기
          </Button>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            가입 시 FoodGuard의{' '}
            <Link href="#!" underline="none">
              이용약관
            </Link>
            에 동의하게 됩니다.
          </Typography>
          
          <Divider>또는</Divider>

          <Stack gap={1.5} direction="row" justifyContent="space-between">
            <Button
              startIcon={<IconifyIcon icon="flat-color-icons:google" />}
              variant="outlined"
              fullWidth
              sx={{ fontSize: 'subtitle2.fontSize' }}
            >
              Google
            </Button>
            <Button
              startIcon={<IconifyIcon icon="logos:facebook" />}
              variant="outlined"
              fullWidth
              sx={{ fontSize: 'subtitle2.fontSize' }}
            >
              Facebook
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
};

export default Signup;
