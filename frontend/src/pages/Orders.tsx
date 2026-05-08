import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Autocomplete,} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import { inventoryService } from '../services/inventoryService';
import IconifyIcon from '../components/base/IconifyIcon';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
  REQUESTED: { label: '요청됨', color: 'warning' },
  APPROVED:  { label: '승인됨', color: 'info' },
  REJECTED:  { label: '반려됨', color: 'error' },
  DONE:      { label: '완료',   color: 'success' },
};

const Orders = ({ user }: any) => {
  const [rows, setRows]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [storeId, setStoreId]   = useState<number | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);

  // 신규 발주 다이얼로그
  const [openDialog, setOpenDialog]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<any>(null);
  const [orderQty, setOrderQty]       = useState('');

  /* ────── 데이터 로드 ────── */
  const fetchOrders = async (sid: number) => {
    const orders = await orderService.getByStore(sid);
    setRows(
      (orders || []).map((item: any) => ({
        id:         item.id,
        name:       item.ingredient?.name ?? '-',
        unit:       item.ingredient?.unit ?? '',
        quantity:   Number(item.orderedQty ?? item.quantity ?? 0),
        status:     item.status ?? 'REQUESTED',
        orderedAt:  item.orderedAt
          ? new Date(item.orderedAt).toLocaleString('ko-KR')
          : '-',
      }))
    );
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const uid = user?.userId ?? user?.id;
        if (!uid) return;
        const stores = await storeService.getMyStores(uid);
        if (stores?.length > 0) {
          const sid = stores[0].id;
          setStoreId(sid);
          const [, inv] = await Promise.all([
            fetchOrders(sid),
            inventoryService.getByStore(sid),
          ]);
          setInventory(inv || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();  }, [user]);

  /* ────── 발주 취소 ────── */
  const handleCancel = async (id: number) => {
    if (!window.confirm('발주를 취소하시겠습니까?')) return;
    try {
      await orderService.cancel(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);    }
  };

  /* ────── 신규 발주 등록 ────── */
  const handleCreateOrder = async () => {
    if (!selectedIngredient) { setFormError('식자재를 선택해주세요.'); return; }
    if (!orderQty || Number(orderQty) <= 0) { setFormError('발주 수량을 입력해주세요.'); return; }
    if (!storeId) return;

    setSubmitting(true);
    setFormError('');
    try {
      await orderService.create({
        storeId,
        ingredientId: selectedIngredient.ingredientId,
        quantity: Number(orderQty),
      });
      setOpenDialog(false);
      setSelectedIngredient(null);
      setOrderQty('');
      await fetchOrders(storeId);
    } catch (e: any) {
      setFormError('발주 등록 실패: ' + (e.message ?? ''));
    } finally {
      setSubmitting(false);
    }
  };

  /* ────── 컬럼 정의 ────── */
  const columns: GridColDef[] = [
    {
      field: 'orderedAt',
      headerName: '발주 일시',
      width: 180,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">{p.value}</Typography>
      ),
    },
    {
      field: 'name',
      headerName: '식자재명',
      flex: 1,
      minWidth: 160,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={600} color="text.primary">{p.value}</Typography>
      ),
    },
    {
      field: 'quantity',
      headerName: '발주 수량',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={700} color="primary.main">
          {p.value} {p.row.unit}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: '상태',
      width: 120,
      renderCell: (p) => {
        const s = STATUS_MAP[p.value] ?? { label: p.value, color: 'default' };
        return <Chip label={s.label} color={s.color} size="small" />;
      },
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 90,
      sortable: false,
      renderCell: (p) =>
        p.row.status === 'REQUESTED' ? (
          <Button
            size="small"
            color="error"
            variant="outlined"
            sx={{ minWidth: 52, fontSize: '0.72rem' }}
            onClick={() => handleCancel(p.row.id)}
          >
            취소
          </Button>
        ) : null,
    },
  ];

  /* ────── 렌더 ────── */
  return (
    <Stack gap={4}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={700} color="text.primary">
            식자재 발주 내역
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            총 {rows.length}건
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<IconifyIcon icon="mingcute:shopping-cart-fill" />}
          onClick={() => { setFormError(''); setSelectedIngredient(null); setOrderQty(''); setOpenDialog(true); }}
          sx={{ px: 3, py: 1.2 }}
        >
          신규 발주 등록
        </Button>
      </Stack>

      {/* 발주 목록 */}
      <Paper sx={{ height: 620, width: '100%', p: 2 }}>        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 2 }}>
            <IconifyIcon icon="mingcute:shopping-cart-line" width={56} height={56} color="text.disabled" />
            <Typography color="text.secondary">발주 내역이 없습니다.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 20]}
            sx={{ border: 'none' }}          />
        )}
      </Paper>

      {/* 신규 발주 다이얼로그 */}
      <Dialog open={openDialog} onClose={() => !submitting && setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:shopping-cart-fill" color="primary.main" />
            신규 발주 등록
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={3} mt={1}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {/* 재고 목록에서 식자재 선택 */}
            <Autocomplete
              options={inventory}
              getOptionLabel={(opt: any) =>
                `${opt.ingredient?.name ?? '?'} (현재: ${Number(opt.currentQty ?? 0).toFixed(1)} ${opt.unit ?? ''})`
              }
              value={selectedIngredient}
              onChange={(_, v) => setSelectedIngredient(v)}
              renderInput={(params) => (
                <TextField {...params} label="식자재 선택 *" placeholder="재고 목록에서 선택..." />
              )}
              noOptionsText="등록된 재고가 없습니다"
            />

            <TextField
              label="발주 수량 *"
              type="number"
              fullWidth
              value={orderQty}
              onChange={(e) => setOrderQty(e.target.value)}
              inputProps={{ min: 1, step: 1 }}
              helperText={selectedIngredient ? `단위: ${selectedIngredient.unit ?? '개'}` : ' '}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenDialog(false)} disabled={submitting} color="inherit">취소</Button>
          <Button
            variant="contained"
            onClick={handleCreateOrder}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <IconifyIcon icon="mingcute:send-fill" />}
          >
            {submitting ? '등록 중...' : '발주 등록'}
          </Button>        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Orders;
