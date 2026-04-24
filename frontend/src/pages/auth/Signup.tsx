import React, { useState } from 'react';
import {
  Box,
  Link,
  Paper,
  Stack,
  Button,
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Image from '../../components/base/Image';
import { authService } from '../../services/authService';
const logoWithText = '/Logo-with-text.png';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    password: '',
    confirmPassword: '',
    role: 'OWNER',
    storeName: '',
    region: '',
    address: '',
    phone: '',
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      await authService.signup(formData);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <Box component="figure" mb={5} mx="auto" textAlign="center">
        <Link component={RouterLink} to="/">
          <Image src={logoWithText} alt="logo with text" height={60} />
        </Link>
      </Box>
      <Paper
        sx={{
          py: 6,
          px: { xs: 5, sm: 7.5 },
          maxWidth: 600,
          mx: 'auto'
        }}
      >
        <Stack component="form" onSubmit={handleSubmit} justifyContent="center" gap={3}>
          <Typography variant="h3" textAlign="center" color="text.secondary">
            계정 생성
          </Typography>
          <Typography variant="h6" fontWeight={500} textAlign="center" color="text.primary" mb={2}>
            이미 계정이 있으신가요?{' '}
            <Link component={RouterLink} to="/login" sx={{ cursor: 'pointer' }} underline="none">
              로그인
            </Link>
          </Typography>
          
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">회원가입 성공! 로그인 페이지로 이동합니다.</Alert>}

          <Typography variant="subtitle1" fontWeight="bold">기본 정보</Typography>
          
          <TextField
            variant="filled"
            label="이름 (실명)"
            name="userName"
            required
            fullWidth
            value={formData.userName}
            onChange={handleChange}
            sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
          />

          <TextField
            variant="filled"
            label="이메일 주소"
            name="email"
            type="email"
            required
            fullWidth
            value={formData.email}
            onChange={handleChange}
            sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
          />
          
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              variant="filled"
              label="비밀번호"
              name="password"
              required
              fullWidth
              type="password"
              value={formData.password}
              onChange={handleChange}
              sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
            />
            <TextField
              variant="filled"
              label="비밀번호 확인"
              name="confirmPassword"
              required
              fullWidth
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
            />
          </Stack>

          <FormControl fullWidth variant="filled">
            <InputLabel>가입 유형</InputLabel>
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange}
              sx={{ bgcolor: 'grey.A100', borderRadius: 2, '&:before, &:after': { display: 'none' } }}
            >
              <MenuItem value="OWNER">가맹점 점주</MenuItem>
              <MenuItem value="HQ">본사 관리자</MenuItem>
            </Select>
          </FormControl>

          {formData.role === 'OWNER' && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight="bold">가맹점 정보 (필수)</Typography>
              
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                <TextField
                  variant="filled"
                  label="매장명"
                  name="storeName"
                  required
                  fullWidth
                  value={formData.storeName}
                  onChange={handleChange}
                  sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
                />
                <TextField
                  variant="filled"
                  label="지역 (예: 서울 강남구)"
                  name="region"
                  required
                  fullWidth
                  value={formData.region}
                  onChange={handleChange}
                  sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
                />
              </Stack>

              <TextField
                variant="filled"
                label="상세 주소"
                name="address"
                required
                fullWidth
                value={formData.address}
                onChange={handleChange}
                sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
              />

              <TextField
                variant="filled"
                label="매장 전화번호"
                name="phone"
                required
                fullWidth
                placeholder="02-1234-5678"
                value={formData.phone}
                onChange={handleChange}
                sx={{ '.MuiFilledInput-root': { bgcolor: 'grey.A100' }, borderRadius: 2 }}
              />
            </>
          )}
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ fontWeight: 'fontWeightRegular', py: 1.5, mt: 2 }}
          >
            가입하기
          </Button>

          <Typography variant="body2" textAlign="center" color="text.secondary">
            가입 시 FoodGuard의{' '}
            <Link href="#!" underline="none">이용약관</Link>
            에 동의하게 됩니다.
          </Typography>
        </Stack>
      </Paper>
    </>
  );
};

export default Signup;
