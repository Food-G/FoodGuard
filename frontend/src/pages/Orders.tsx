import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, useTheme, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Divider,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  DONE: '완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  DONE: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const Orders = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelledCount, setCancelledCount] = useState(0);

  // 발주 추천 미리보기 다이얼로그
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadOrders = async (sid: number) => {
    try {
      const orders = await orderService.getByStore(sid);
      const all = orders ?? [];
      setCancelledCount(all.filter((o: any) => o.status === 'CANCELLED').length);
      setRows(all
        .filter((item: any) => item.status !== 'CANCELLED')
        .map((item: any) => ({
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
    if (!user?.id) return;
    storeService.getMyStores(user.id).then(async (stores: any[]) => {
      if (!stores?.length) return;
      const sid = stores[0].id;
      setStoreId(sid);
      try {
        await loadOrders(sid);
      } catch {
        setError('발주 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [user]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('발주를 취소하시겠습니까?')) return;
    try {
      await orderService.cancel(id);
      setSuccess('발주가 취소되었습니다.');
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('취소에 실패했습니다.');
    }
  };

  const handleCancelAll = async () => {
    const requestedRows = rows.filter((r) => r.status === 'REQUESTED');
    if (requestedRows.length === 0) return;
    if (!window.confirm(`대기중인 발주 ${requestedRows.length}건을 모두 취소하시겠습니까?`)) return;
    try {
      await Promise.all(requestedRows.map((r) => orderService.cancel(r.id)));
      setSuccess(`${requestedRows.length}건 발주가 모두 취소되었습니다.`);
    } catch {
      setError('전체 취소 중 오류가 발생했습니다.');
    } finally {
      if (storeId) await loadOrders(storeId);
    }
  };

  // 1단계: 추천 목록 조회 → 다이얼로그 열기
  const handleOpenPreview = async () => {
    if (!storeId) return;
    setPreviewing(true);
    setError('');
    setSuccess('');
    try {
      const recs = await orderService.recommend(storeId);
      const list = Array.isArray(recs) ? recs : [];
      if (list.length === 0) {
        setError('발주가 필요한 식자재가 없거나 AI 예측 데이터가 없습니다. 예측 페이지에서 먼저 예측을 실행해주세요.');
        return;
      }
      setRecommendations(list);
      setSelectedIds(new Set(list.map((r: any) => r.ingredientId)));
      setPreviewOpen(true);
    } catch {
      setError('추천 목록을 불러오지 못했습니다.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map((r) => r.ingredientId)));
    }
  };

  const handleToggle = (ingId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  // 2단계: 선택 항목만 발주 등록
  const handleConfirmOrder = async () => {
    if (!storeId || selectedIds.size === 0) return;
    setConfirming(true);
    try {
      const selected = recommendations.filter((r) => selectedIds.has(r.ingredientId));
      await Promise.all(
        selected.map((r) =>
          orderService.create({ storeId, ingredientId: r.ingredientId, quantity: r.orderQty })
        )
      );
      setSuccess(`${selected.length}건 발주가 등록되었습니다.`);
      setPreviewOpen(false);
    } catch {
      setError('발주 등록에 실패했습니다.');
    } finally {
      setConfirming(false);
      await loadOrders(storeId);
    }
  };

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 180 },
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 160 },
    {
      field: 'quantity', headerName: '발주 수량', width: 150, align: 'right', headerAlign: 'right',
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize={14}>
          {params.value} <span style={{ color: '#888', fontWeight: 400 }}>{params.row.unit}</span>
        </Typography>
      ),
    },
    {
      field: 'status', headerName: '상태', width: 110,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABEL[params.value] ?? params.value}
          color={STATUS_COLOR[params.value] ?? 'default'}
          size="small" variant="filled" sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: 'actions', headerName: '관리', width: 90,
      renderCell: (params) =>
        params.row.status === 'REQUESTED' ? (
          <Button color="error" size="small" variant="outlined"
            onClick={() => handleCancel(params.id as number)} sx={{ borderRadius: 2 }}>
            취소
          </Button>
        ) : null,
    },
  ];

  const allSelected = recommendations.length > 0 && selectedIds.size === recommendations.length;

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 식자재 발주 시스템</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={previewing
            ? <CircularProgress size={16} color="inherit" />
            : <IconifyIcon icon="mingcute:sparkles-line" />}
          onClick={handleOpenPreview}
          disabled={previewing}
          sx={{ px: 3, py: 1.5, borderRadius: 3 }}
        >
          {previewing ? '분석 중...' : 'AI 예측 기반 자동 발주'}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Typography variant="h6" fontWeight={700}>발주 내역</Typography>
            {cancelledCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                (취소된 발주 {cancelledCount}건 숨김 — 자동 발주 시 자동 재계산됨)
              </Typography>
            )}
          </Stack>
          {rows.some((r) => r.status === 'REQUESTED') && (
            <Button color="error" size="small" variant="outlined" onClick={handleCancelAll} sx={{ borderRadius: 2 }}>
              전체 취소
            </Button>
          )}
        </Stack>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter
            autoHeight
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 700 },
            }}
          />
        )}
      </Paper>

      {/* AI 추천 발주 미리보기 다이얼로그 */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:sparkles-line" />
            <Typography variant="h6" fontWeight={700}>AI 예측 발주 추천</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            발주할 항목을 선택하고 등록하세요. ({recommendations.length}개 추천)
          </Typography>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'secondary.light' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={handleToggleAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>식자재명</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>현재 재고</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>7일 필요량</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>발주 수량</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations.map((rec) => (
                  <TableRow
                    key={rec.ingredientId}
                    hover
                    selected={selectedIds.has(rec.ingredientId)}
                    onClick={() => handleToggle(rec.ingredientId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(rec.ingredientId)}
                        onChange={() => handleToggle(rec.ingredientId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{rec.ingredientName}</TableCell>
                    <TableCell align="right">
                      {rec.currentStock} <span style={{ color: '#888' }}>{rec.unit}</span>
                    </TableCell>
                    <TableCell align="right">
                      {rec.requiredQty} <span style={{ color: '#888' }}>{rec.unit}</span>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color="primary.main" fontSize={14}>
                        {rec.orderQty} <span style={{ fontWeight: 400, color: '#888' }}>{rec.unit}</span>
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {selectedIds.size}개 선택됨
          </Typography>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" onClick={() => setPreviewOpen(false)} disabled={confirming}>
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmOrder}
              disabled={confirming || selectedIds.size === 0}
              startIcon={confirming ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {confirming ? '등록 중...' : `${selectedIds.size}건 발주 등록`}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Orders;
