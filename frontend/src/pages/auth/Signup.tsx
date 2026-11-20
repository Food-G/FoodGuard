import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Link,
  Stack,
  Button,
  TextField,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import IconifyIcon from '../../components/base/IconifyIcon';
import AuthShell from '../../components/AuthShell';
import { authService } from '../../services/authService';

const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

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

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    password: '',
    confirmPassword: '',
    // 회원가입은 점주만 (본사 관리자 계정은 회원가입으로 만들 수 없다, 백엔드 UserService.signup)
    role: 'OWNER',
    storeName: '',
    region: '',
    address: '',
    phone: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [detailAddress, setDetailAddress] = useState('');
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name as string]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
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

  const passwordAdornment = (shown: boolean, toggle: () => void) => ({
    endAdornment: (
      <InputAdornment position="end">
        <IconButton aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'} onClick={toggle} edge="end" sx={{ mr: 1 }}>
          <IconifyIcon icon={shown ? 'mingcute:eye-2-line' : 'mingcute:eye-close-line'} />
        </IconButton>
      </InputAdornment>
    ),
  });
  const sectionTitle = (text: string) => (
    <Typography fontSize={16} fontWeight={700} mt={2}>{text}</Typography>
  );

  return (
    <AuthShell maxWidth={520}>
      <Stack component="form" onSubmit={handleSubmit} gap={3.5}>
        <Box mb={1}>
          <Typography fontSize={28} fontWeight={700} mb={1}>점주 회원가입</Typography>
          <Typography color="text.secondary" fontSize={15}>
            이미 계정이 있으신가요?{' '}
            <Link component={RouterLink} to="/login" fontWeight={700} underline="none">로그인</Link>
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">회원가입 성공! 로그인 페이지로 이동합니다.</Alert>}

        {sectionTitle('기본 정보')}
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField fullWidth label="이름" name="userName" required value={formData.userName} onChange={handleChange} />
          <TextField fullWidth label="이메일" name="email" type="email" required autoComplete="email" value={formData.email} onChange={handleChange} />
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField
            fullWidth label="비밀번호 (8자 이상)" name="password" required autoComplete="new-password"
            type={showPassword ? 'text' : 'password'} value={formData.password} onChange={handleChange}
            InputProps={passwordAdornment(showPassword, () => setShowPassword(!showPassword))}
          />
          <TextField
            fullWidth label="비밀번호 확인" name="confirmPassword" required autoComplete="new-password"
            type={showConfirmPassword ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange}
            InputProps={passwordAdornment(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
          />
        </Stack>

        {sectionTitle('가맹점 정보')}
        <TextField fullWidth label="매장명" name="storeName" required value={formData.storeName} onChange={handleChange} />
        <TextField
          fullWidth label="주소" name="address" required
          value={formData.address}
          onClick={openPostcode}
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <IconifyIcon icon="mingcute:search-2-line" width={18} />
              </InputAdornment>
            ),
          }}
          placeholder="눌러서 주소 검색"
          sx={{ '& input': { cursor: 'pointer' } }}
        />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <TextField fullWidth label="상세 주소" value={detailAddress} onChange={(e) => setDetailAddress(e.target.value)} placeholder="층·호수" />
          <TextField
            fullWidth label="지역" name="region" required value={formData.region} onChange={handleChange}
            helperText="주소를 검색하면 자동으로 채워져요 (날씨 예보 지역)"
          />
        </Stack>
        <TextField fullWidth label="매장 전화번호" name="phone" required placeholder="02-1234-5678" value={formData.phone} onChange={handleChange} />

        <Button type="submit" fullWidth size="large" sx={{ py: 2, fontSize: 16, mt: 2 }}>
          가입하기
        </Button>
        <Typography variant="body2" textAlign="center" color="text.secondary">
          본사 관리자 계정은 회원가입이 아니라 본사에서 따로 발급해요.
        </Typography>
      </Stack>
    </AuthShell>
  );
};

export default Signup;
