import React, { useEffect, useRef, useState } from 'react';
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
  alpha,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import { authService } from '../../services/authService';

declare global {
  interface Window {
    daum: {
      Postcode: new (config: { oncomplete: (data: any) => void }) => { open: () => void };
    };
  }
}

const SIDO_MAP: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
  '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
  '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기',
  '강원도': '강원', '강원특별자치도': '강원', '충청북도': '충북',
  '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북',
  '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주',
};

const normalizeRegion = (sido: string) => SIDO_MAP[sido] ?? sido;

const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

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

  const [detailAddress, setDetailAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const scriptLoaded = useRef(false);

  const loadPostcodeScript = () => {
    if (scriptLoaded.current || document.getElementById('daum-postcode-script')) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = POSTCODE_SCRIPT_URL;
    script.onload = () => { scriptLoaded.current = true; };
    document.head.appendChild(script);
  };

  const openPostcode = () => {
    if (!window.daum?.Postcode) {
      setError('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        const region = normalizeRegion(data.sido);
        setFormData((prev) => ({ ...prev, address: fullAddress, region }));
        setDetailAddress('');
      },
    }).open();
  };

  useEffect(() => {
    loadPostcodeScript();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (formData.role === 'OWNER' && (!formData.address || !formData.region)) {
      setError('주소를 검색해주세요.');
      return;
    }

    try {
      const submitData = {
        ...formData,
        address: detailAddress ? `${formData.address} ${detailAddress}` : formData.address,
      };
      await authService.signup(submitData);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || '회원가입 중 오류가 발생했습니다.');
    }
  };

  const textFieldStyle = {
    '& .MuiFilledInput-root': {
      bgcolor: 'grey.50',
      borderRadius: 3,
      '&:before, &:after': { display: 'none' },
      '&:hover': { bgcolor: 'grey.100' },
      '&.Mui-focused': { bgcolor: 'grey.50' },
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: 'primary.main',
    },
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Stack sx={{ flexGrow: 1, py: 8, px: 2 }} alignItems="center" justifyContent="center">
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Stack direction="row" alignItems="center" gap={1.5} justifyContent="center" mb={2}>
            <IconifyIcon icon="mingcute:leaf-fill" color="primary.main" width={48} height={48} />
            <Typography variant="h2" fontWeight={900} color="primary.main" sx={{ letterSpacing: '-0.05em' }}>
              FoodGuard
            </Typography>
          </Stack>
          <Typography variant="h6" color="text.secondary" fontWeight={500}>
            함께 시작하는 지구를 위한 발걸음
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            py: { xs: 6, sm: 8 },
            px: { xs: 4, sm: 8 },
            width: '100%',
            maxWidth: 640,
            borderRadius: 6,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Stack component="form" onSubmit={handleSubmit} gap={4}>
            <Box textAlign="center" mb={1}>
              <Typography variant="h4" fontWeight={800} color="text.primary" gutterBottom>
                계정 생성하기
              </Typography>
              <Typography variant="body1" color="text.secondary">
                이미 계정이 있으신가요?{' '}
                <Link component={RouterLink} to="/login" fontWeight={700} underline="none">
                  로그인하기
                </Link>
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 3 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ borderRadius: 3 }}>
                회원가입 성공! 로그인 페이지로 이동합니다.
              </Alert>
            )}

            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              기본 정보
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                fullWidth
                variant="filled"
                label="이름 (실명)"
                name="userName"
                required
                value={formData.userName}
                onChange={handleChange}
                sx={textFieldStyle}
              />
              <TextField
                fullWidth
                variant="filled"
                label="이메일 주소"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                sx={textFieldStyle}
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
              <TextField
                fullWidth
                variant="filled"
                label="비밀번호"
                name="password"
                required
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                sx={textFieldStyle}
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
              <TextField
                fullWidth
                variant="filled"
                label="비밀번호 확인"
                name="confirmPassword"
                required
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                sx={textFieldStyle}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                        <IconifyIcon icon={showConfirmPassword ? 'mingcute:eye-2-line' : 'mingcute:eye-close-line'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Stack>

            <FormControl fullWidth variant="filled" sx={textFieldStyle}>
              <InputLabel>가입 유형</InputLabel>
              <Select
                name="role"
                value={formData.role}
                onChange={handleChange}
                sx={{
                  borderRadius: 3,
                  '&:before, &:after': { display: 'none' },
                }}
              >
                <MenuItem value="OWNER">가맹점 점주</MenuItem>
                <MenuItem value="HQ_ADMIN">본사 관리자</MenuItem>
              </Select>
            </FormControl>

            {formData.role === 'OWNER' && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  가맹점 정보
                </Typography>

                <TextField
                  fullWidth
                  variant="filled"
                  label="매장명"
                  name="storeName"
                  required
                  value={formData.storeName}
                  onChange={handleChange}
                  sx={textFieldStyle}
                />

                <Stack gap={1}>
                  <TextField
                    fullWidth
                    variant="filled"
                    label="기본 주소"
                    value={formData.address}
                    placeholder="버튼을 클릭해 주소를 검색하세요"
                    required
                    sx={textFieldStyle}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={openPostcode}
                            sx={{ borderRadius: 1.5, px: 1.5, mr: 0.5, whiteSpace: 'nowrap' }}
                            startIcon={<IconifyIcon icon="mingcute:search-2-line" width={15} />}
                          >
                            주소 검색
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {formData.address && (
                    <TextField
                      fullWidth
                      variant="filled"
                      label="상세 주소"
                      value={detailAddress}
                      onChange={(e) => setDetailAddress(e.target.value)}
                      placeholder="동/호수, 건물명 등 (선택)"
                      sx={textFieldStyle}
                    />
                  )}
                  {formData.region && (
                    <Stack direction="row" gap={1} alignItems="center" sx={{ pl: 0.5 }}>
                      <IconifyIcon icon="mingcute:location-fill" width={14} color="primary.main" />
                      <Typography variant="caption" color="primary.main" fontWeight={700}>
                        지역: {formData.region}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                <TextField
                  fullWidth
                  variant="filled"
                  label="매장 전화번호"
                  name="phone"
                  required
                  placeholder="02-1234-5678"
                  value={formData.phone}
                  onChange={handleChange}
                  sx={textFieldStyle}
                />
              </>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{
                py: 2,
                mt: 2,
                borderRadius: 3,
                fontSize: '1.1rem',
                fontWeight: 700,
                boxShadow: (theme) => `0 8px 16px ${alpha(theme.palette.primary.main, 0.24)}`,
              }}
            >
              회원가입 완료하기
            </Button>

            <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mt: 1 }}>
              가입 시 FoodGuard의{' '}
              <Link href="#!" fontWeight={600} underline="hover">
                이용약관
              </Link>
              에 동의하게 됩니다.
            </Typography>
          </Stack>
        </Paper>

        <Box sx={{ py: 6, textAlign: 'center', opacity: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            © 2026 FoodGuard Team. All rights reserved.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
};

export default Signup;

