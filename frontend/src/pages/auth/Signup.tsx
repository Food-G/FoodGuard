import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Container, Link, Alert, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OWNER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.signup({ email, password, role });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError('회원가입 실패: ' + err.message);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ height: '100vh', display: 'flex', alignItems: 'center' }}>
      <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', borderRadius: 2 }}>
        <Typography component="h1" variant="h4" color="primary" fontWeight="bold" gutterBottom>
          FoodGuard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          플랫폼 회원가입
        </Typography>
        {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ width: '100%', mb: 2 }}>회원가입 성공! 로그인 페이지로 이동합니다.</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="이메일"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>가입 유형</InputLabel>
            <Select
              value={role}
              label="가입 유형"
              onChange={(e) => setRole(e.target.value)}
            >
              <MenuItem value="OWNER">가맹점 점주</MenuItem>
              <MenuItem value="HQ">본사 관리자</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2, py: 1.5, fontWeight: 'bold' }}>
            가입하기
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Link onClick={() => navigate('/login')} sx={{ cursor: 'pointer' }} variant="body2" color="primary">
              {"이미 계정이 있으신가요? 로그인"}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Signup;
