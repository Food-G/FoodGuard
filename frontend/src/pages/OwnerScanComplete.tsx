import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography, Stack, Paper } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

type ScanState = 'loading' | 'success' | 'already_done' | 'error';

const OwnerScanComplete = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<ScanState>('loading');
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('유효하지 않은 QR 코드입니다.'); return; }

    let cancelled = false;

    fetch(`/api/orders/owner-scan?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) {
          if (data?.error === '이미 처리된 발주입니다.') {
            setState('already_done');
          } else {
            setState('error');
            setErrorMsg(data?.error ?? '처리 중 오류가 발생했습니다.');
          }
          return;
        }
        setResult(data);
        setState('success');
      })
      .catch(() => { if (!cancelled) { setState('error'); setErrorMsg('서버에 연결할 수 없습니다.'); } });

    return () => { cancelled = true; };
  }, [token]);

  const bg = state === 'success' ? '#f0fdf4' : state === 'already_done' ? '#eff6ff' : state === 'error' ? '#fef2f2' : '#f9fafb';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      {state === 'loading' && (
        <Stack alignItems="center" gap={2}>
          <CircularProgress size={52} />
          <Typography color="text.secondary" fontWeight={600}>검수 처리 중...</Typography>
        </Stack>
      )}

      {state === 'success' && result && (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 5, maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid #bbf7d0' }}>
          <Box sx={{ fontSize: 72, lineHeight: 1, mb: 2 }}>✅</Box>
          <Typography variant="h5" fontWeight={800} color="success.dark" gutterBottom>
            가맹점주 검수 완료
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={3}>
            {result.storeName}
          </Typography>
          <Box sx={{ bgcolor: '#f0fdf4', borderRadius: 3, p: 2.5, textAlign: 'left' }}>
            <Row label="식자재" value={`${result.ingredientName}`} />
            <Row label="수량" value={`${result.quantity} ${result.unit}`} />
            {result.expiryDate && <Row label="유통기한" value={result.expiryDate} />}
          </Box>
          <Typography variant="caption" color="text.secondary" mt={2} display="block">
            재고에 자동 반영되었습니다.
          </Typography>
        </Paper>
      )}

      {state === 'already_done' && (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 5, maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid #bfdbfe' }}>
          <Box sx={{ fontSize: 72, lineHeight: 1, mb: 2 }}>✅</Box>
          <Typography variant="h5" fontWeight={800} color="primary.dark" gutterBottom>검수 완료</Typography>
          <Typography color="text.secondary">이미 검수가 완료된 발주입니다.</Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>재고에 반영되었습니다.</Typography>
        </Paper>
      )}

      {state === 'error' && (
        <Paper elevation={0} sx={{ p: 5, borderRadius: 5, maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid #fecaca' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <IconifyIcon icon="mingcute:alert-fill" width={64} color="#ef4444" />
          </Box>
          <Typography variant="h5" fontWeight={800} color="error.dark" gutterBottom>처리 실패</Typography>
          <Typography color="text.secondary">{errorMsg || '알 수 없는 오류가 발생했습니다.'}</Typography>
        </Paper>
      )}
    </Box>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <Stack direction="row" gap={1} mb={0.75}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 64 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={600}>{value}</Typography>
  </Stack>
);

export default OwnerScanComplete;
