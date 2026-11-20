import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography, Paper, Button, CircularProgress, Chip,
  Stack, useTheme, Box,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import { orderService } from '../../services/orderService';
import IconifyIcon from '../../components/base/IconifyIcon';
import QrCodeDisplay from '../../components/QrCodeDisplay';
import { useConfirm } from '../../hooks/useConfirm';
import AlertMessages from '../../components/AlertMessages';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '승인 대기',
  APPROVED: '발송 필요',
  HQ_SENT: '배달기사 수령 대기',
  DRIVER_RECEIVED: '가맹점주 검수 대기',
  DONE: '완료',
  CANCELLED: '취소됨',
  REJECTED: '거절됨',
};

// 진행 단계 (mine: 본사가 처리할 단계)
const STAGES = [
  { status: 'REQUESTED',       label: '승인 대기',     who: '본사 승인',       mine: true },
  { status: 'APPROVED',        label: '발송 필요',     who: '본사 발송 검수',  mine: true },
  { status: 'HQ_SENT',         label: '기사 수령 대기', who: '배달기사 검수',   mine: false },
  { status: 'DRIVER_RECEIVED', label: '점주 검수 대기', who: '가맹점주 검수',   mine: false },
];
const PAGE = 30;
const ACTIVE_STATUSES = new Set(['REQUESTED', 'APPROVED', 'HQ_SENT', 'DRIVER_RECEIVED']);
const DONE_STATUSES   = new Set(['CANCELLED', 'REJECTED']); // DONE은 표시 안 함 (자동 소멸)

const AdminOrders = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterStoreId = searchParams.get('storeId') ? Number(searchParams.get('storeId')) : null;

  const [allRows, setAllRows] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('admin_dismissed_order_ids');
      return stored ? new Set<number>(JSON.parse(stored)) : new Set<number>();
    } catch { return new Set<number>(); }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);
  const confirm = useConfirm();
  const [hqSendTarget, setHqSendTarget] = useState<number | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [qrData, setQrData] = useState<{ data: string; name: string } | null>(null);

  const loadOrders = async () => {
    try {
      const orders = await orderService.getAll();
      setAllRows((orders ?? []).map((item: any) => ({
        id: item.id,
        storeId: item.store?.id ?? null,
        storeName: item.store?.storeName ?? '-',
        name: item.ingredient?.name ?? '-',
        quantity: item.orderedQty ?? item.quantity,
        unit: item.ingredient?.unit ?? '',
        status: item.status,
        orderedAt: item.orderedAt ? new Date(item.orderedAt).toLocaleString() : '-',
        deliveryGroupToken: item.deliveryGroupToken ?? null,
      })));
    } catch {
      setError('발주 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 5000); // 5초마다 자동 갱신
    return () => clearInterval(timer);
  }, []);

  const visibleRows = (filterStoreId ? allRows.filter(r => r.storeId === filterStoreId) : allRows)
    .filter(r => !dismissedIds.has(r.id));
  const activeRows = visibleRows.filter(r => ACTIVE_STATUSES.has(r.status));
  const doneRows   = visibleRows.filter(r => DONE_STATUSES.has(r.status));

  const withStatus = (id: number, status: string) =>
    setAllRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));

  const handleApprove = async (id: number) => {
    try {
      await orderService.approve(id);
      withStatus(id, 'APPROVED');
      setSuccess('발주가 승인되었습니다.');
    } catch { setError('승인에 실패했습니다.'); }
  };

  const handleReject = async (id: number) => {
    if (!await confirm({ message: '이 발주를 거절하시겠습니까?', confirmLabel: '거절', severity: 'error' })) return;
    try {
      await orderService.updateStatus(id, 'REJECTED');
      withStatus(id, 'REJECTED');
      setSuccess('발주가 거절되었습니다.');
    } catch { setError('거절 처리에 실패했습니다.'); }
  };

  const handleHqSendConfirm = async () => {
    if (hqSendTarget === null) return;
    try {
      const row = allRows.find(r => r.id === hqSendTarget);
      const result = await orderService.hqSend(hqSendTarget, expiryDate || undefined);
      withStatus(hqSendTarget, 'HQ_SENT');
      setSuccess('발송 검수가 완료되었습니다.');
      setHqSendTarget(null);
      setExpiryDate('');
      if (result?.qrToken) {
        const qrUrl = `${window.location.origin}/driver/scan?token=${result.qrToken}`;
        setQrData({ data: qrUrl, name: row?.name ?? '식자재' });
      }
    } catch {
      setError('발송 검수 처리에 실패했습니다.');
      setHqSendTarget(null);
    }
  };

  const handleClearCompleted = () => {
    const next = new Set([...dismissedIds, ...doneRows.map(r => r.id)]);
    setDismissedIds(next);
    localStorage.setItem('admin_dismissed_order_ids', JSON.stringify([...next]));
    setSuccess('완료된 발주 목록이 초기화되었습니다.');
  };

  const [stage, setStage] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const filterStoreName = searchParams.get('storeName');
  const actionCount = activeRows.filter(r => r.status === 'REQUESTED' || r.status === 'APPROVED').length;
  const listRows = (tab === 0 ? activeRows : doneRows).filter(r => tab === 1 || !stage || r.status === stage);
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  const pendingByStore = Object.values(
    allRows
      .filter(r => r.status === 'REQUESTED')
      .reduce<Record<number, { storeId: number; storeName: string; count: number }>>((acc, r) => {
        if (!acc[r.storeId]) acc[r.storeId] = { storeId: r.storeId, storeName: r.storeName, count: 0 };
        acc[r.storeId].count += 1;
        return acc;
      }, {})
  );

  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.paper',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  // 행 오른쪽 처리 버튼 (상태별)
  const actions = (r: any) => {
    if (r.status === 'REQUESTED') return (
      <Stack direction="row" gap={1}>
        <Button size="small" variant="text" color="error" onClick={() => handleReject(r.id)}>거절</Button>
        <Button size="small" onClick={() => handleApprove(r.id)}>승인</Button>
      </Stack>
    );
    if (r.status === 'APPROVED') return (
      <Button size="small" onClick={() => setHqSendTarget(r.id)}>발송 검수</Button>
    );
    if (r.status === 'HQ_SENT' && r.deliveryGroupToken) {
      const driverUrl = `${window.location.origin}/driver/group/${r.deliveryGroupToken}`;
      return (
        <Button size="small" variant="outlined" startIcon={<IconifyIcon icon="mingcute:link-line" width={16} />}
          onClick={() => { navigator.clipboard.writeText(driverUrl); setSuccess('드라이버 링크가 복사되었습니다.'); }}>
          기사 링크
        </Button>
      );
    }
    return null;
  };

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>
            {filterStoreId ? `${filterStoreName ?? '선택한 가맹점'} · ` : ''}본사가 처리할 발주
          </Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `${actionCount}건`}
          </Typography>
        </Box>
        {filterStoreId && (
          <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:arrow-left-line" width={16} />}
            onClick={() => navigate('/admin/orders')}>
            전체 발주 보기
          </Button>
        )}
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {/* 단계별 건수 (누르면 그 단계만) */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        {STAGES.map((s, i) => {
          const count = activeRows.filter(r => r.status === s.status).length;
          const selected = stage === s.status;
          return (
            <Paper
              key={s.status} onClick={() => { setTab(0); setStage(selected ? null : s.status); setShown(PAGE); }}
              sx={{
                p: 4, cursor: 'pointer', outline: selected ? `2px solid ${theme.palette.primary.main}` : 'none',
                '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' },
              }}
            >
              <Typography variant="body2" color="text.secondary" mb={1}>{i + 1}. {s.label}</Typography>
              <Typography fontSize={26} fontWeight={700} color={s.mine && count > 0 ? 'primary.main' : 'text.primary'}>
                {count}<Box component="span" fontSize={15} fontWeight={600} color="text.secondary" ml={0.5}>건</Box>
              </Typography>
              <Typography variant="body2" color="text.disabled">{s.who}</Typography>
            </Paper>
          );
        })}
      </Box>

      {/* 승인 대기 가맹점 */}
      {!filterStoreId && pendingByStore.length > 0 && (
        <Stack direction="row" alignItems="center" gap={1.5} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary" fontWeight={600}>승인 대기 가맹점</Typography>
          {pendingByStore.map(s => pill(`${s.storeName} ${s.count}건`, false,
            () => navigate(`/admin/orders?storeId=${s.storeId}&storeName=${encodeURIComponent(s.storeName)}`)))}
        </Stack>
      )}

      <Paper sx={{ p: 5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} gap={2} flexWrap="wrap">
          <Stack direction="row" gap={1} sx={{ bgcolor: 'background.default', p: 0.75, borderRadius: 999 }}>
            {pill(`진행 중 ${activeRows.length}`, tab === 0, () => { setTab(0); setShown(PAGE); })}
            {pill(`취소·거절 ${doneRows.length}`, tab === 1, () => { setTab(1); setShown(PAGE); })}
          </Stack>
          {tab === 1 && doneRows.length > 0 && (
            <Button size="small" variant="text" color="error" startIcon={<IconifyIcon icon="mingcute:delete-2-line" />} onClick={handleClearCompleted}>
              목록 정리
            </Button>
          )}
          {tab === 0 && stage && (
            <Button size="small" variant="text" onClick={() => setStage(null)}>단계 필터 해제</Button>
          )}
        </Stack>

        {loading ? (
          <Stack alignItems="center" py={8}><CircularProgress /></Stack>
        ) : listRows.length === 0 ? (
          <Stack alignItems="center" py={8} gap={1}>
            {tab === 0 && <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={44} />}
            <Typography color="text.secondary" fontWeight={600}>
              {tab === 0 ? '처리 대기 중인 발주가 없습니다.' : '취소·거절된 발주가 없습니다.'}
            </Typography>
          </Stack>
        ) : (
          <>
            {listRows.slice(0, shown).map((r) => {
              const step = STAGES.findIndex(s => s.status === r.status);
              return (
                <Box key={r.id} sx={{ py: 3.5, ...rowSx }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={2}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize={15} noWrap>
                        {r.storeName} · {r.name} <Box component="span" fontWeight={700}>{r.quantity}{r.unit}</Box>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">{r.orderedAt}</Typography>
                    </Box>
                    <Typography fontWeight={700} fontSize={14} sx={{ whiteSpace: 'nowrap' }}
                      color={r.status === 'REJECTED' ? 'error.main' : STAGES[step]?.mine ? 'primary.main' : 'text.secondary'}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Typography>
                    {actions(r)}
                  </Stack>
                  {step >= 0 && (
                    <Stack direction="row" gap={0.75} mt={2}>
                      {STAGES.map((s, i) => (
                        <Box key={s.status} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= step ? 'primary.main' : 'divider' }} />
                      ))}
                    </Stack>
                  )}
                </Box>
              );
            })}
            {listRows.length > shown && (
              <Button variant="outlined" fullWidth onClick={() => setShown(shown + PAGE)}>
                {Math.min(PAGE, listRows.length - shown)}건 더 보기
              </Button>
            )}
          </>
        )}
      </Paper>

      {/* 유통기한 입력 다이얼로그 */}
      <Dialog open={hqSendTarget !== null} onClose={() => { setHqSendTarget(null); setExpiryDate(''); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>발송 검수 완료</DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              해당 식자재의 유통기한을 입력하면 QR 코드가 생성됩니다. (선택 사항)
            </Typography>
            <TextField
              label="유통기한"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="text" onClick={() => { setHqSendTarget(null); setExpiryDate(''); }}>취소</Button>
          <Button onClick={handleHqSendConfirm}>발송 검수완료</Button>
        </DialogActions>
      </Dialog>

      {/* QR 코드 표시 */}
      {qrData && (
        <QrCodeDisplay
          data={qrData.data}
          title={`${qrData.name} QR 코드`}
          subtitle={`이 QR 코드를 패키지에 부착하세요`}
          onClose={() => setQrData(null)}
        />
      )}
    </Stack>
  );
};

export default AdminOrders;
