import { useEffect, useState } from 'react';
import {
  Typography, Paper, Stack, Button, TextField, MenuItem,
  Alert, CircularProgress, Box, useTheme,
} from '@mui/material';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

// 날씨 예보 지역 (회원가입 주소 검색의 시·도 약칭과 같다). 비우면 백엔드가 '서울'로 둔다
const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

const StoreRegister = ({ user }: any) => {
  const theme = useTheme();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ storeName: '', address: '', phone: '', region: '' });
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

  useEffect(() => { loadStores(); }, [user]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName || !form.address || !form.phone || !form.region) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await storeService.create({ ...form, userId: user.id });
      setSuccess('가게가 등록되었습니다!');
      setForm({ storeName: '', address: '', phone: '', region: '' });
      await loadStores();
    } catch {
      setError('가게 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Box>
        <Typography color="text.secondary" fontSize={15} mb={1}>내 가게</Typography>
        <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
          {loading ? '-' : `${stores.length}곳`}
        </Typography>
        {!loading && stores.length === 0 && (
          <Typography fontSize={15} color="text.secondary" mt={1}>AI 예측 서비스를 사용하려면 가게를 먼저 등록하세요.</Typography>
        )}
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px' }, alignItems: 'start' }}>
        {/* 내 가게 목록 */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>가게 목록</Typography>
          {loading ? (
            <Stack alignItems="center" py={6}><CircularProgress /></Stack>
          ) : stores.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>등록된 가게가 없습니다.</Typography>
          ) : stores.map((store) => (
            <Stack key={store.id} direction="row" alignItems="center" gap={3} sx={{ py: 3, ...rowSx }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon="mingcute:store-2-line" width={20} color={theme.palette.primary.main} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600} fontSize={15} noWrap>{store.storeName}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {store.region ? `${store.region} · ` : ''}{store.address}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{store.phone}</Typography>
            </Stack>
          ))}
        </Paper>

        {/* 가게 등록 */}
        <Paper component="form" onSubmit={handleSubmit} sx={{ p: 5, gap: 3 }}>
          <Typography fontSize={18} fontWeight={700}>새 가게</Typography>
          <TextField label="가게 이름" name="storeName" value={form.storeName} onChange={handleChange} size="small" fullWidth required />
          <TextField label="주소" name="address" value={form.address} onChange={handleChange} size="small" fullWidth required />
          <TextField
            select label="지역" name="region" value={form.region} onChange={handleChange} size="small" fullWidth required
            helperText="날씨 예보에 쓰여요. 수요 예측에 반영됩니다."
          >
            {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField label="전화번호" name="phone" value={form.phone} onChange={handleChange} placeholder="010-0000-0000" size="small" fullWidth required />
          <Button
            type="submit" fullWidth disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="mingcute:add-line" />}
          >
            {submitting ? '등록 중...' : '가게 등록'}
          </Button>
        </Paper>
      </Box>
    </Stack>
  );
};

export default StoreRegister;
