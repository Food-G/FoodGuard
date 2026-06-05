import { useEffect, useState } from 'react';
import {
  Typography, Paper, Stack, Button, TextField,
  Alert, CircularProgress, Chip, Box, Divider,} from '@mui/material';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const StoreRegister = ({ user }: any) => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ storeName: '', address: '', phone: '' });
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
    if (!form.storeName || !form.address || !form.phone) {
      setError('모든 항목을 입력해주세요.');      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await storeService.create({ ...form, userId: user.id });
      setSuccess('가게가 등록되었습니다!');
      setForm({ storeName: '', address: '', phone: '' });      await loadStores();
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
                <Chip label={`ID: ${store.id}`} size="small" color="primary" variant="outlined" />
              </Stack>            ))}
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
          <TextField
            label="주소"
            name="address"
            value={form.address}
            onChange={handleChange}
            fullWidth
            required
          />          <TextField
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
