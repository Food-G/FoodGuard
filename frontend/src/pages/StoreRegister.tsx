import { useEffect, useRef, useState } from 'react';
import {
  Typography, Paper, Stack, Button, TextField,
  Alert, CircularProgress, Chip, Box, Divider, InputAdornment,
} from '@mui/material';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

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

const StoreRegister = ({ user }: any) => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    storeName: '', address: '', detailAddress: '', phone: '', region: '',
  });
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

  const loadStores = async () => {
    if (!user?.id) return;
    try {
      const data = await storeService.getMyStores(user.id);
      setStores(data ?? []);
    } catch {
      setError('가게 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
    loadPostcodeScript();
  }, [user]);

  const openPostcode = () => {
    if (!window.daum?.Postcode) {
      setError('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        const region = normalizeRegion(data.sido);
        setForm((prev) => ({ ...prev, address: fullAddress, region, detailAddress: '' }));
      },
    }).open();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.address || !form.phone || !form.region) {
      setError('가게 이름, 주소, 전화번호를 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    const fullAddress = form.detailAddress
      ? `${form.address} ${form.detailAddress}`
      : form.address;
    try {
      await storeService.create({ storeName: form.storeName, address: fullAddress, phone: form.phone, region: form.region, userId: user.id });
      setSuccess('가게가 등록되었습니다!');
      setForm({ storeName: '', address: '', detailAddress: '', phone: '', region: '' });
      await loadStores();
    } catch {
      setError('가게 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap={4} maxWidth={600}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>가게 등록</Typography>
        <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ mt: 0.5 }}>
          AI 예측 서비스를 사용하려면 가게를 먼저 등록하세요.
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 내 가게 목록 */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>내 가게 목록</Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : stores.length === 0 ? (
          <Typography color="text.secondary" variant="body2">등록된 가게가 없습니다.</Typography>
        ) : (
          <Stack gap={1.5}>
            {stores.map((store) => (
              <Stack key={store.id} direction="row" alignItems="center" justifyContent="space-between"
                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Stack>
                  <Typography fontWeight={700}>{store.storeName}</Typography>
                  <Typography variant="body2" color="text.secondary">{store.address}</Typography>
                  <Typography variant="body2" color="text.secondary">{store.phone}</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                  {store.region && (
                    <Chip label={store.region} size="small" color="primary" variant="outlined" />
                  )}
                  <Chip label={`ID: ${store.id}`} size="small" variant="outlined" />
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <Divider />

      {/* 가게 등록 폼 */}
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={3}>
          <IconifyIcon icon="mingcute:add-circle-fill" color="primary.main" />
          <Typography variant="h6" fontWeight={700}>새 가게 등록</Typography>
        </Stack>
        <Stack component="form" onSubmit={handleSubmit} gap={2.5}>
          <TextField
            label="가게 이름"
            name="storeName"
            value={form.storeName}
            onChange={handleChange}
            fullWidth
            required
          />

          {/* 주소 검색 */}
          <Stack gap={1}>
            <TextField
              label="기본 주소"
              value={form.address}
              placeholder="아래 버튼을 클릭해 주소를 검색하세요"
              fullWidth
              required
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={openPostcode}
                      sx={{ borderRadius: 1.5, px: 1.5, whiteSpace: 'nowrap' }}
                      startIcon={<IconifyIcon icon="mingcute:search-2-line" width={15} />}
                    >
                      주소 검색
                    </Button>
                  </InputAdornment>
                ),
              }}
            />
            {form.address && (
              <TextField
                label="상세 주소"
                name="detailAddress"
                value={form.detailAddress}
                onChange={handleChange}
                placeholder="동/호수, 건물명 등 (선택)"
                fullWidth
              />
            )}
            {form.region && (
              <Stack direction="row" gap={1} alignItems="center">
                <IconifyIcon icon="mingcute:location-fill" width={15} color="primary.main" />
                <Typography variant="caption" color="primary.main" fontWeight={700}>
                  지역: {form.region}
                </Typography>
              </Stack>
            )}
          </Stack>

          <TextField
            label="전화번호"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            placeholder="010-0000-0000"
            fullWidth
            required
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
          >
            {submitting ? '등록 중...' : '가게 등록'}
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default StoreRegister;
