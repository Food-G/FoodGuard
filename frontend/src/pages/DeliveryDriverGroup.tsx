import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Stack, Typography, Paper, Alert,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { orderService } from '../services/orderService';

const STAGES = ['본사 발송완료', '배달기사 검수완료', '가맹점주 검수완료'];
const STAGE_ICONS = ['📦', '🚚', '✅'];

const statusToStage: Record<string, number> = {
  HQ_SENT: 0,
  DRIVER_RECEIVED: 1,
  DONE: 2,
};

const DeliveryDriverGroup = () => {
  const { groupToken } = useParams<{ groupToken: string }>();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const currentStage = info ? (statusToStage[info.status] ?? -1) : -1;

  const loadInfo = () => {
    if (!groupToken) return;
    fetch(`/api/delivery/group/${groupToken}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError('배달 정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInfo(); }, [groupToken]);

  const handleDriverReceive = async () => {
    setConfirming(true);
    try {
      await orderService.driverReceiveGroup(groupToken!);
      setInfo((prev: any) => ({ ...prev, status: 'DRIVER_RECEIVED' }));
    } catch {
      setError('검수 처리에 실패했습니다.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );

  if (error && !info) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  if (info?.status === 'DONE') return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
      <Typography fontSize={64}>✅</Typography>
      <Typography variant="h5" fontWeight={800} color="success.main">모든 검수 완료!</Typography>
      <Typography color="text.secondary" textAlign="center">
        {info?.storeName} 가맹점의 모든 검수가 완료되었습니다.
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', pb: 4 }}>
      {/* 헤더 */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', px: 3, py: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography fontSize={28}>🚚</Typography>
          <Box>
            <Typography fontWeight={800} fontSize={18}>FoodGuard 배달 검수</Typography>
            <Typography fontSize={13} sx={{ opacity: 0.85 }}>배달기사 전용 페이지</Typography>
          </Box>
        </Stack>
      </Box>

      <Stack gap={2} sx={{ px: 2, pt: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* 검수 단계 표시 */}
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="caption" color="text.secondary" mb={1.5} display="block">검수 책임 흐름</Typography>
          <Stack direction="row" justifyContent="space-between">
            {STAGES.map((label, i) => (
              <Stack key={i} alignItems="center" gap={0.5} sx={{ flex: 1, opacity: i <= currentStage ? 1 : 0.3 }}>
                <Typography fontSize={20}>{STAGE_ICONS[i]}</Typography>
                <Typography variant="caption" fontWeight={i === currentStage ? 700 : 400}
                  color={i === currentStage ? 'primary.main' : 'text.secondary'} textAlign="center" sx={{ fontSize: 10 }}>
                  {label}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Box sx={{ height: 5, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden', mt: 1.5 }}>
            <Box sx={{
              height: '100%', bgcolor: 'primary.main', borderRadius: 3,
              width: currentStage < 0 ? '0%' : `${((currentStage + 1) / STAGES.length) * 100}%`,
              transition: 'width 0.5s',
            }} />
          </Box>
        </Paper>

        {/* 배달지 정보 */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1.5}>배달지 정보</Typography>
          <Stack direction="row" gap={1} alignItems="center">
            <Typography fontSize={20}>🏪</Typography>
            <Box>
              <Typography fontWeight={700}>{info?.storeName}</Typography>
              <Typography variant="body2" color="text.secondary">{info?.storeAddress}</Typography>
            </Box>
          </Stack>
        </Paper>

        {/* 배달 품목 목록 */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography fontSize={18}>📋</Typography>
              <Typography fontWeight={700}>배달 품목 ({info?.items?.length ?? 0}건)</Typography>
            </Stack>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>식자재</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>수량</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(info?.items ?? []).map((item: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell sx={{ fontWeight: 600 }}>{item.ingredientName}</TableCell>
                  <TableCell align="right">
                    {item.quantity}
                    <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                      {item.unit}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* 상태별 안내 및 버튼 */}
        {info?.status === 'APPROVED' && (
          <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontSize={20}>⏳</Typography>
              <Typography fontWeight={600} color="warning.dark">본사 발송 처리 대기 중입니다.</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              본사에서 상품을 발송 처리하면 검수가 시작됩니다.
            </Typography>
          </Paper>
        )}

        {info?.status === 'HQ_SENT' && (
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={handleDriverReceive}
            disabled={confirming}
            sx={{ borderRadius: 3, py: 2, fontSize: 16, fontWeight: 700 }}
            startIcon={confirming ? <CircularProgress size={20} color="inherit" /> : <Typography fontSize={20}>✅</Typography>}
          >
            {confirming ? '처리 중...' : '배달기사 검수완료 — 제품 확인 완료'}
          </Button>
        )}

        {info?.status === 'DRIVER_RECEIVED' && (
          <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontSize={20}>✅</Typography>
              <Typography fontWeight={700} color="success.dark">배달기사 검수 완료!</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {info?.storeName} 가맹점주의 최종 검수 확인을 기다리고 있습니다.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
};

export default DeliveryDriverGroup;
