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
    </>  );
};

export default Login;
