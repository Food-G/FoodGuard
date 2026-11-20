import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack, useTheme,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel,
} from '@mui/material';
import { orderService } from '../services/orderService';
import { notificationService } from '../services/notificationService';
import { api } from '../services/api';
import IconifyIcon from '../components/base/IconifyIcon';
import QrScanner from '../components/QrScanner';
import OrderExplainDialog from '../components/OrderExplainDialog';
import OrderReviewDialog from '../components/agent/OrderReviewDialog';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '승인 대기',
  APPROVED: '승인됨',
  HQ_SENT: '발송중',
  DRIVER_RECEIVED: '배달기사 검수완료',
  DONE: '입고완료',
  CANCELLED: '취소됨',
  REJECTED: '거절됨',
};
// 진행 단계 (배송 조회처럼 막대로 보여 준다)
const STEPS = ['REQUESTED', 'APPROVED', 'HQ_SENT', 'DRIVER_RECEIVED', 'DONE'];

interface Recommendation { ingredientId: number; ingredientName: string; unit: string; orderQty: number; coverageDays: number }

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
  const [orderDialog, setOrderDialog] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [orderForm, setOrderForm] = useState({ ingredientId: '', quantity: '' });
  const [submitting, setSubmitting] = useState(false);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);

  const loadRecs = (sid: number) =>
    orderService.getRecommend(sid)
      .then((r: Recommendation[]) => setRecs((r ?? []).filter((i) => i.orderQty > 0)))
      .catch(() => setRecs([]));

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
        qrToken: item.qrToken ?? null,
      })));
    } catch {
      setError('발주 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    loadOrders(storeId).finally(() => setLoading(false));
    loadRecs(storeId);
    const timer = setInterval(() => loadOrders(storeId), 5000);
    // 페이지 진입 시 ORDER 알림 모두 읽음 처리
    notificationService.getUnread(storeId).then((data: any[]) => {
      (data ?? []).filter((n) => n.type === 'ORDER').forEach((n) => notificationService.markAsRead(n.id).catch(() => {}));
    }).catch(() => {});
    return () => clearInterval(timer);
  }, [storeId, storeLoading]);
  const handleOwnerQrScan = async (qrData: string) => {
    setScanning(false);
    try {
      const tokenMatch = qrData.match(/[?&]token=([^&]+)/);
      if (!tokenMatch) { setError('QR 코드 형식이 올바르지 않습니다.'); return; }
      const result = await orderService.scanQrByOwner(decodeURIComponent(tokenMatch[1]));
      setSuccess(`${result.ingredientName} 검수 완료. 재고에 반영되었습니다.`);
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('QR 스캔 처리에 실패했습니다. 배달기사 수령 확인 후 검수 가능합니다.');
    }
  };

  const driversReceivedQrCodes = rows
    .filter((r: any) => r.status === 'DRIVER_RECEIVED' && r.qrToken)
    .map((r: any) => ({
      data: `${window.location.origin}/owner/scan?token=${r.qrToken}`,
      label: `${r.name} ${r.quantity}${r.unit}`,
    }));

  const openOrderDialog = async () => {
    if (!ingredients.length) {
      const data = await api.get('/ingredients').catch(() => []);
      setIngredients(data ?? []);
    }
    setOrderForm({ ingredientId: '', quantity: '' });
    setOrderDialog(true);
  };

  const handleOrderSubmit = async () => {
    if (!storeId || !orderForm.ingredientId || !orderForm.quantity) return;
    setSubmitting(true);
    try {
      await orderService.create({ storeId, ingredientId: Number(orderForm.ingredientId), quantity: Number(orderForm.quantity) });
      setSuccess('발주 신청이 완료되었습니다.');
      setOrderDialog(false);
      await loadOrders(storeId);
    } catch {
      setError('발주 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };
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
        loadRecs(storeId);
      }
    } catch (e: any) {
      try { setError(JSON.parse(e.message).error); } catch { setError('자동 발주 등록에 실패했습니다.'); }
    } finally {
      setOrdering(false);
    }
  };

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const waitingQr = rows.filter((r) => r.status === 'DRIVER_RECEIVED').length;

  // 오른쪽 AI 도우미 행 (Square 오른쪽 목록)
  const aiAction = (icon: string, title: string, desc: string, onClick: () => void) => (
    <Stack
      direction="row" alignItems="center" gap={2.5} onClick={storeId ? onClick : undefined}
      sx={{ py: 3, cursor: storeId ? 'pointer' : 'default', opacity: storeId ? 1 : 0.5, ...rowSx }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconifyIcon icon={icon} width={20} color={theme.palette.primary.main} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} fontSize={15}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{desc}</Typography>
      </Box>
      <IconifyIcon icon="mingcute:right-line" width={18} color={theme.palette.text.disabled} />
    </Stack>
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 + 발주 버튼 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>진행 중인 발주</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `${rows.length}건`}
          </Typography>
          {waitingQr > 0 && (
            <Typography fontSize={15} color="primary.main" mt={1}>
              배달기사가 도착했어요. {waitingQr}건은 QR로 검수해 주세요.
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1.5} flexWrap="wrap">
          <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={openOrderDialog}>
            직접 발주
          </Button>
          <Button
            startIcon={ordering ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="mingcute:sparkles-line" />}
            onClick={handleAutoOrder}
            disabled={ordering || !storeId}
          >
            {ordering ? '발주 등록 중...' : 'AI 추천대로 발주'}
          </Button>
        </Stack>
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {storeId && <OrderExplainDialog open={explainOpen} storeId={storeId} onClose={() => setExplainOpen(false)} />}
      {storeId && <OrderReviewDialog open={reviewOpen} storeId={storeId} onClose={() => setReviewOpen(false)} onOrdered={() => { loadOrders(storeId); loadRecs(storeId); }} />}

      <Dialog open={orderDialog} onClose={() => setOrderDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>직접 발주</DialogTitle>
        <DialogContent>
          <Stack gap={2.5} mt={1}>
            <FormControl fullWidth size="small">
              <InputLabel>식자재 선택</InputLabel>
              <Select
                label="식자재 선택"
                value={orderForm.ingredientId}
                onChange={e => setOrderForm(f => ({ ...f, ingredientId: e.target.value }))}
              >
                {ingredients.map((ing: any) => (
                  <MenuItem key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="수량"
              type="number"
              size="small"
              value={orderForm.quantity}
              onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))}
              inputProps={{ min: 0.1, step: 0.1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => setOrderDialog(false)}>취소</Button>
          <Button
            onClick={handleOrderSubmit}
            disabled={submitting || !orderForm.ingredientId || !orderForm.quantity}
            startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            신청
          </Button>
        </DialogActions>
      </Dialog>

      {scanning && (
        <QrScanner
          title="점주 검수 QR 스캔"
          onScan={handleOwnerQrScan}
          onClose={() => setScanning(false)}
          displayQrCodes={driversReceivedQrCodes}
        />
      )}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
        {/* 진행 중인 발주 (배송 조회처럼 단계 막대) */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>발주 진행 상황</Typography>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress /></Stack>
          ) : rows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              진행 중인 발주가 없어요. 오른쪽 추천을 보고 발주해 보세요.
            </Typography>
          ) : rows.map((r) => {
            const step = STEPS.indexOf(r.status);
            const qrReady = r.status === 'DRIVER_RECEIVED';
            return (
              <Box key={r.id} sx={{ py: 3.5, ...rowSx }}>
                <Stack direction="row" alignItems="center" gap={2}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize={15} noWrap>
                      {r.name} <Box component="span" fontWeight={700}>{r.quantity}{r.unit}</Box>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{r.orderedAt}</Typography>
                  </Box>
                  <Typography fontWeight={700} fontSize={14} color={qrReady ? 'primary.main' : 'text.secondary'} sx={{ whiteSpace: 'nowrap' }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Typography>
                  {qrReady && (
                    <Button size="small" startIcon={<IconifyIcon icon="mingcute:camera-line" />} onClick={() => setScanning(true)}>
                      QR 검수
                    </Button>
                  )}
                  <Button size="small" variant="text" color="error" onClick={() => handleCancel(r.id)}>
                    취소
                  </Button>
                </Stack>
                {step >= 0 && (
                  <Stack direction="row" gap={0.75} mt={2}>
                    {STEPS.slice(0, -1).map((s, i) => (
                      <Box key={s} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= step ? 'primary.main' : 'divider' }} />
                    ))}
                  </Stack>
                )}
              </Box>
            );
          })}
        </Paper>

        <Stack gap={5}>
          {/* AI 추천 발주량 */}
          <Paper sx={{ p: 5 }}>
            <Typography fontSize={18} fontWeight={700} mb={1}>AI 추천 발주량</Typography>
            {recs == null ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>불러오는 중…</Typography>
            ) : recs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>지금은 더 발주할 식자재가 없어요.</Typography>
            ) : recs.map((r) => (
              <Stack key={r.ingredientId} direction="row" alignItems="center" gap={2} sx={{ py: 2.5, ...rowSx }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap>{r.ingredientName}</Typography>
                  <Typography variant="body2" color="text.secondary">{r.coverageDays}일분</Typography>
                </Box>
                <Typography fontWeight={700} fontSize={15}>{r.orderQty}{r.unit}</Typography>
              </Stack>
            ))}
          </Paper>

          {/* AI 도우미 */}
          <Paper sx={{ px: 5, py: 2 }}>
            {aiAction('mingcute:question-line', '추천 근거 보기', '왜 이만큼인지 AI가 설명해요', () => setExplainOpen(true))}
            {aiAction('mingcute:user-star-line', 'AI 발주 참모', '발주 전에 한 번 더 점검해요', () => setReviewOpen(true))}
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
};

export default Orders;
