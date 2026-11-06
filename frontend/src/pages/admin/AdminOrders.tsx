import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography, Paper, Button, CircularProgress, Chip,
  Stack, useTheme, Box, Tab, Tabs, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../../services/orderService';
import { agentService } from '../../services/agentService';
import IconifyIcon from '../../components/base/IconifyIcon';
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
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  HQ_SENT: 'primary',
  DRIVER_RECEIVED: 'secondary',
  DONE: 'success',
  CANCELLED: 'default',
  REJECTED: 'error',
};

// status → { 완료된 단계 수, 현재 활성 단계 }
const STAGE_MAP: Record<string, { done: number; active: number }> = {
  REQUESTED:       { done: 0, active: 0 },
  APPROVED:        { done: 0, active: 1 },
  HQ_SENT:         { done: 1, active: 2 },
  DRIVER_RECEIVED: { done: 2, active: 3 },
  DONE:            { done: 3, active: 0 },
};

const StepBadge = ({ n, done, active }: { n: number; done: number; active: number }) => {
  const isDone = n <= done;
  const isActive = n === active;
  return (
    <Box sx={{
      width: 26, height: 26, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: isDone ? 'success.main' : isActive ? 'primary.main' : 'grey.200',
      color: isDone || isActive ? 'white' : 'text.disabled',
      fontSize: 11, fontWeight: 800, flexShrink: 0,
      boxShadow: isActive ? '0 0 0 3px rgba(25,118,210,0.25)' : 'none',
    }}>
      {isDone ? <IconifyIcon icon="mingcute:check-fill" width={13} /> : n}
    </Box>
  );
};

const StepProgress = ({ status }: { status: string }) => {
  const { done, active } = STAGE_MAP[status] ?? { done: 0, active: 0 };
  return (
    <Stack direction="row" gap={0.5} alignItems="center">
      {[1, 2, 3].map((n, i) => (
        <Stack key={n} direction="row" alignItems="center" gap={0.5}>
          <StepBadge n={n} done={done} active={active} />
          {i < 2 && (
            <Box sx={{ width: 14, height: 2, bgcolor: n <= done ? 'success.main' : 'grey.300', borderRadius: 1 }} />
          )}
        </Stack>
      ))}
    </Stack>
  );
};

const REVIEW_LABEL: Record<string, { label: string; color: any }> = {
  reject: { label: '거절 검토', color: 'error' },
  review: { label: '확인 필요', color: 'warning' },
  approve: { label: '이상 없음', color: 'success' },
};

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
  const [flags, setFlags] = useState<Record<number, any>>({});

  // 심사 결과를 못 불러와도(007 적용 전 등) 발주 처리는 그대로 할 수 있어야 한다
  const loadFlags = async () => {
    try {
      const rows = await agentService.getOrderFlags();
      // 최신순으로 오므로 같은 발주는 가장 최근 심사를 쓴다
      const next: Record<number, any> = {};
      rows.forEach((p) => { if (next[p.payload.orderId] === undefined) next[p.payload.orderId] = { ...p.payload, rationale: p.rationale }; });
      setFlags(next);
    } catch { /* 위험 점수만 표시되지 않는다 */ }
  };

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
        deliveryToken: item.deliveryToken ?? null,
      })));
    } catch {
      setError('발주 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    loadFlags();
    const timer = setInterval(loadOrders, 5000); // 5초마다 자동 갱신
    const flagTimer = setInterval(loadFlags, 60000); // 심사는 5분 주기라 자주 볼 필요가 없다
    return () => { clearInterval(timer); clearInterval(flagTimer); };
  }, []);

  const visibleRows = (filterStoreId ? allRows.filter(r => r.storeId === filterStoreId) : allRows)
    .filter(r => !dismissedIds.has(r.id))
    .map(r => ({ ...r, riskScore: flags[r.id]?.score ?? null, flag: flags[r.id] ?? null }));
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
      // 전용 hq-send API(유통기한·QR)가 아직 없어 상태 변경 API 로 처리한다 (유통기한 입력은 DEV_ROADMAP D-3)
      await orderService.updateStatus(hqSendTarget, 'HQ_SENT');
      withStatus(hqSendTarget, 'HQ_SENT');
      setSuccess('발송 검수가 완료되었습니다.');
      setHqSendTarget(null);
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

  const activeColumns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 170 },
    { field: 'name', headerName: '식자재', flex: 1, minWidth: 130 },
    {
      field: 'quantity', headerName: '수량', width: 100, align: 'right', headerAlign: 'right',
      renderCell: (p) => (
        <Typography fontWeight={600} fontSize={14}>
          {p.value} <span style={{ color: '#999', fontWeight: 400 }}>{p.row.unit}</span>
        </Typography>
      ),
    },
    {
      field: 'riskScore', headerName: 'AI 위험 점수', width: 130, align: 'center', headerAlign: 'center',
      renderCell: (p) => {
        const f = p.row.flag;
        if (!f) return <Typography variant="caption" color="text.disabled">-</Typography>;
        const review = REVIEW_LABEL[f.recommendation];
        return (
          <Tooltip arrow title={
            <Box sx={{ whiteSpace: 'pre-wrap' }}>
              {f.rationale}
              {(f.flags ?? []).map((x: any) => `\n• ${x.detail} (+${x.points})`).join('')}
              {'\n규칙 기반 점수이며 확률이 아닙니다. 판단은 관리자가 합니다.'}
            </Box>
          }>
            <Chip label={`${f.score} ${review?.label ?? ''}`} color={review?.color ?? 'default'} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
          </Tooltip>
        );
      },
    },
    {
      field: 'steps', headerName: '진행 단계', width: 160,
      renderCell: (p) => <StepProgress status={p.row.status} />,
      sortable: false,
    },
    {
      field: 'status', headerName: '현재 상태', width: 160,
      renderCell: (p) => (
        <Chip
          label={STATUS_LABEL[p.value] ?? p.value}
          color={STATUS_COLOR[p.value] ?? 'default'}
          size="small" variant="filled" sx={{ fontWeight: 700, fontSize: 11 }}
        />
      ),
    },
    {
      field: 'actions', headerName: '처리', width: 210, sortable: false,
      renderCell: (p) => {
        const { status, id } = p.row;
        if (status === 'REQUESTED') return (
          <Stack direction="row" gap={0.5}>
            <Button variant="contained" size="small" onClick={() => handleApprove(id)} sx={{ borderRadius: 2, fontSize: 12 }}>
              승인
            </Button>
            <Button variant="outlined" color="error" size="small" onClick={() => handleReject(id)} sx={{ borderRadius: 2, fontSize: 12 }}>
              거절
            </Button>
          </Stack>
        );
        if (status === 'APPROVED') return (
          <Button variant="contained" color="success" size="small"
            onClick={() => setHqSendTarget(id)} sx={{ borderRadius: 2, fontSize: 12 }}>
            발송 검수완료 →
          </Button>
        );
        if (status === 'HQ_SENT') {
          const driverUrl = p.row.deliveryToken
            ? `${window.location.origin}/driver/${p.row.deliveryToken}`
            : null;
          return driverUrl ? (
            <Button variant="contained" color="secondary" size="small"
              onClick={() => { navigator.clipboard.writeText(driverUrl); setSuccess('드라이버 링크가 복사되었습니다.'); }}
              sx={{ borderRadius: 2, fontSize: 11 }}>
              링크 복사
            </Button>
          ) : null;
        }
        if (status === 'DRIVER_RECEIVED') return (
          <Chip label="가맹점주 검수 대기 중" size="small" variant="outlined" color="warning" sx={{ fontWeight: 600 }} />
        );
        return null;
      },
    },
  ];

  const doneColumns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 180 },
    { field: 'name', headerName: '식자재', flex: 1, minWidth: 160 },
    {
      field: 'quantity', headerName: '수량', width: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => (
        <Typography fontWeight={600} fontSize={14}>
          {p.value} <span style={{ color: '#999', fontWeight: 400 }}>{p.row.unit}</span>
        </Typography>
      ),
    },
    {
      field: 'status', headerName: '처리 결과', width: 150,
      renderCell: (p) => (
        <Chip
          label={STATUS_LABEL[p.value] ?? p.value}
          color={STATUS_COLOR[p.value] ?? 'default'}
          size="small" variant="filled" sx={{ fontWeight: 700 }}
        />
      ),
    },
  ];

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      {filterStoreId && (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="outlined" size="small"
            startIcon={<IconifyIcon icon="mingcute:arrow-left-line" width={14} />}
            onClick={() => navigate('/admin/orders')}
          >
            전체 발주 보기
          </Button>
        </Stack>
      )}

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {/* 승인 대기 중인 가맹점 요약 */}
      {!filterStoreId && (() => {
        const pendingByStore = Object.values(
          allRows
            .filter(r => r.status === 'REQUESTED')
            .reduce<Record<number, { storeId: number; storeName: string; count: number }>>((acc, r) => {
              if (!acc[r.storeId]) acc[r.storeId] = { storeId: r.storeId, storeName: r.storeName, count: 0 };
              acc[r.storeId].count += 1;
              return acc;
            }, {})
        );
        if (pendingByStore.length === 0) return null;
        return (
          <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.warning.light}`, borderRadius: 3, bgcolor: 'warning.50' }}>
            <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
              <IconifyIcon icon="mingcute:alert-fill" color={theme.palette.warning.main} width={18} />
              <Typography variant="subtitle2" fontWeight={700} color="warning.dark">
                승인 대기 중인 가맹점 ({pendingByStore.length}곳)
              </Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {pendingByStore.map(s => (
                <Chip
                  key={s.storeId}
                  label={`${s.storeName}  ${s.count}건`}
                  color="warning"
                  variant="filled"
                  clickable
                  onClick={() => navigate(`/admin/orders?storeId=${s.storeId}&storeName=${encodeURIComponent(s.storeName)}`)}
                  sx={{ fontWeight: 700, fontSize: 13 }}
                />
              ))}
            </Stack>
          </Paper>
        );
      })()}

      {/* 3단계 흐름 안내 */}
      <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="subtitle2" color="text.secondary" mb={1.5} fontWeight={700}>
          검수 책임 흐름
        </Typography>
        <Stack direction="row" gap={1} alignItems="stretch" flexWrap="wrap">
          {[
            {
              n: 1, label: '본사 발송 검수완료', desc: '발주 승인 후 발송 처리',
              color: 'primary.main', bg: 'primary.50',
              statuses: ['REQUESTED', 'APPROVED'],
            },
            {
              n: 2, label: '배달기사 수령 검수완료', desc: '배달기사가 제품 확인 후 처리',
              color: 'success.main', bg: 'success.50',
              statuses: ['HQ_SENT'],
            },
            {
              n: 3, label: '가맹점주 수령 검수완료', desc: '가맹점주가 제품 확인 후 처리',
              color: 'warning.main', bg: 'warning.50',
              statuses: ['DRIVER_RECEIVED'],
            },
          ].map((item, i) => {
            const count = allRows.filter(r => item.statuses.includes(r.status)).length;
            return (
              <Stack key={item.n} direction="row" alignItems="center" gap={1} sx={{ flex: 1, minWidth: 220 }}>
                <Box sx={{ flex: 1, px: 2, py: 1.5, bgcolor: 'action.hover', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color={item.color} fontWeight={800}>
                      [{item.n}단계] {item.label}
                    </Typography>
                    {count > 0 && (
                      <Chip label={`${count}건`} size="small" color="error" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                    )}
                  </Stack>
                  <Typography variant="caption" display="block" color="text.secondary" mt={0.3}>
                    {item.desc}
                  </Typography>
                </Box>
                {i < 2 && <Typography color="text.disabled" fontSize={20} sx={{ flexShrink: 0 }}>→</Typography>}
              </Stack>
            );
          })}
        </Stack>
      </Paper>

      {/* 탭 */}
      <Paper sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}`, px: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)}>
            <Tab
              label={
                <Stack direction="row" gap={1} alignItems="center">
                  진행 중 발주
                  {activeRows.length > 0 && (
                    <Chip label={activeRows.length} size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Stack>
              }
            />
            <Tab
              label={
                <Stack direction="row" gap={1} alignItems="center">
                  완료된 발주
                  {doneRows.length > 0 && (
                    <Chip label={doneRows.length} size="small" color="default" sx={{ height: 18, fontSize: 10 }} />
                  )}
                </Stack>
              }
            />
          </Tabs>
        </Box>

        <Box sx={{ p: 2 }}>
          {tab === 1 && doneRows.length > 0 && (
            <Stack direction="row" justifyContent="flex-end" mb={1.5}>
              <Button
                size="small" variant="outlined" color="error"
                startIcon={<IconifyIcon icon="mingcute:delete-2-line" />}
                onClick={handleClearCompleted}
              >
                목록 초기화
              </Button>
            </Stack>
          )}

          <Box sx={{ height: 520 }}>
            {loading ? (
              <Stack alignItems="center" justifyContent="center" height="100%">
                <CircularProgress />
              </Stack>
            ) : tab === 0 ? (
              activeRows.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
                  <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={48} />
                  <Typography color="text.secondary" fontWeight={600}>처리 대기 중인 발주가 없습니다.</Typography>
                </Stack>
              ) : (
                <DataGrid
                  rows={activeRows}
                  columns={activeColumns}
                  disableRowSelectionOnClick
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                    sorting: { sortModel: [{ field: 'riskScore', sort: 'desc' }] },
                  }}
                  pageSizeOptions={[10, 20]}
                  sx={{ border: 'none', '& .MuiDataGrid-cell': { alignItems: 'center' } }}
                />
              )
            ) : (
              doneRows.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
                  <Typography color="text.secondary" fontWeight={600}>완료된 발주가 없습니다.</Typography>
                </Stack>
              ) : (
                <DataGrid
                  rows={doneRows}
                  columns={doneColumns}
                  disableRowSelectionOnClick
                  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                  pageSizeOptions={[10, 20]}
                  sx={{ border: 'none' }}
                />
              )
            )}
          </Box>
        </Box>
      </Paper>

      <Dialog open={hqSendTarget !== null} onClose={() => setHqSendTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>발송 검수 완료</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" pt={1}>
            발송 처리하면 배달기사 링크를 복사할 수 있습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHqSendTarget(null)}>취소</Button>
          <Button variant="contained" color="success" onClick={handleHqSendConfirm}>
            발송 검수완료
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default AdminOrders;
