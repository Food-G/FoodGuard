import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, useTheme,
} from '@mui/material';
import { orderService } from '../services/orderService';
import IconifyIcon from '../components/base/IconifyIcon';
import QrScanner from '../components/QrScanner';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  HQ_SENT: '발송완료',
  DRIVER_RECEIVED: '배달기사 수령',
  DONE: '완료',
  CANCELLED: '취소됨',
  REJECTED: '거절됨',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  HQ_SENT: 'primary',
  DRIVER_RECEIVED: 'secondary',
  DONE: 'success',
  CANCELLED: 'default',
  REJECTED: 'error',
};

const Orders = ({ user }: any) => {
  const theme = useTheme();
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanning, setScanning] = useState(false);

  const loadOrders = async (sid: number) => {
    try {
      const orders = await orderService.getByStore(sid);
      const hiddenStatuses = new Set(['DONE', 'CANCELLED', 'REJECTED']);
      setRows((orders ?? []).filter((item: any) => !hiddenStatuses.has(item.status)).map((item: any) => ({
        id: item.id,
        name: item.ingredient?.name ?? '-',
        quantity: item.orderedQty ?? item.quantity,
        unit: item.ingredient?.unit ?? '',
        status: item.status,
        orderedAt: item.orderedAt ? new Date(item.orderedAt).toLocaleString() : '-',
      })));
    } catch {
      setError('발주 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    loadOrders(storeId).finally(() => setLoading(false));
    const timer = setInterval(() => loadOrders(storeId), 5000);
    return () => clearInterval(timer);
  }, [storeId, storeLoading]);
  const handleCancel = async (id: number) => {
    if (!await confirm('발주를 취소하시겠습니까?')) return;
    try {
      await orderService.cancel(id);
      setSuccess('발주가 취소되었습니다.');
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('취소에 실패했습니다.');
    }
  };

  const handleQrScan = async (qrData: string) => {
    setScanning(false);
    try {
      const result = await orderService.scanQr(qrData);
      setSuccess(`${result.ingredientName} 검수 완료. 재고에 반영되었습니다.`);
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('QR 스캔 처리에 실패했습니다.');
    }
  };

  const handleAutoOrder = async () => {
    if (!storeId) return;
    setOrdering(true);
    setError('');
    setSuccess('');
    try {
      const result = await orderService.autoOrder(storeId);
      const count = Array.isArray(result) ? result.length : 0;
      if (count === 0) {
        setSuccess('현재 재고가 충분하여 발주가 필요한 식자재가 없습니다.');
      } else {
        setSuccess(`${count}건 발주가 등록되었습니다.`);
        await loadOrders(storeId);
      }
    } catch (e: any) {
      try { setError(JSON.parse(e.message).error); } catch { setError('자동 발주 등록에 실패했습니다.'); }
    } finally {
      setOrdering(false);
    }
  };

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={ordering
            ? <CircularProgress size={16} color="inherit" />
            : <IconifyIcon icon="mingcute:sparkles-line" />}
          onClick={handleAutoOrder}
          disabled={ordering}
          sx={{ px: 3, py: 1.5, borderRadius: 3 }}
        >
          {ordering ? '발주 등록 중...' : 'AI 예측 기반 자동 발주'}
        </Button>
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {scanning && (
        <QrScanner
          title="점주 검수 QR 스캔"
          onScan={handleQrScan}
          onClose={() => setScanning(false)}
        />
      )}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={700}>발주 내역</Typography>
          <Chip label={`총 ${rows.length}건`} size="small" color="primary" variant="outlined" />
        </Stack>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : rows.length === 0 ? (
          <Stack alignItems="center" gap={1.5} py={6}>
            <IconifyIcon icon="mingcute:inbox-line" width={44} color={theme.palette.text.disabled} />
            <Typography color="text.secondary">진행 중인 발주가 없습니다.</Typography>
          </Stack>
        ) : (
          // 슬라이드형 세로 스크롤 영역 (스크롤바 숨김)
          <Box
            sx={{
              maxHeight: 560,
              overflowY: 'auto',
              pr: 0.5,
              scrollbarWidth: 'none',                       // Firefox
              msOverflowStyle: 'none',                      // IE/Edge
              '&::-webkit-scrollbar': { display: 'none' },  // Chrome/Safari
            }}
          >
            <Stack gap={1.2}>
              {rows.map((row) => (
                <Stack
                  key={row.id}
                  direction="row"
                  alignItems="center"
                  gap={2}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: `1px solid ${theme.palette.divider}`,
                    transition: 'box-shadow .15s, border-color .15s',
                    '&:hover': { boxShadow: theme.shadows[2], borderColor: theme.palette.primary.light },
                  }}
                >
                  <Box
                    sx={{
                      width: 44, height: 44, flexShrink: 0, borderRadius: 2,
                      bgcolor: 'secondary.light', color: 'secondary.dark',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <IconifyIcon icon="mingcute:package-2-line" width={22} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.orderedAt}</Typography>
                  </Box>
                  <Typography fontWeight={700} fontSize={15} sx={{ whiteSpace: 'nowrap' }}>
                    {row.quantity} <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>{row.unit}</Box>
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[row.status] ?? row.status}
                    color={STATUS_COLOR[row.status] ?? 'default'}
                    size="small" variant="filled" sx={{ fontWeight: 700, minWidth: 72 }}
                  />
                  <Box sx={{ width: 96, textAlign: 'right' }}>
                    {row.status === 'REQUESTED' && (
                      <Button color="error" size="small" variant="outlined"
                        onClick={() => handleCancel(row.id as number)} sx={{ borderRadius: 2 }}>
                        취소
                      </Button>
                    )}
                    {row.status === 'DRIVER_RECEIVED' && (
                      <Button color="success" size="small" variant="contained"
                        onClick={() => setScanning(true)} sx={{ borderRadius: 2 }}
                        startIcon={<IconifyIcon icon="mingcute:scan-line" width={16} />}>
                        QR
                      </Button>
                    )}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};

export default Orders;
