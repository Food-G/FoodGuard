import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, useTheme, Alert,
} from '@mui/material';import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  DONE: '완료',
  REJECTED: '거절됨',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  DONE: 'success',
  REJECTED: 'error',
};

const Orders = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrders = async (sid: number) => {
    try {
      const orders = await orderService.getByStore(sid);
      setRows((orders ?? []).map((item: any) => ({
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
    }  };

  const handleAutoOrder = async () => {
    if (!storeId) return;
    setOrdering(true);
    setError('');
    setSuccess('');
    try {
      const result = await orderService.autoOrder(storeId);
      const count = Array.isArray(result) ? result.length : 0;
      if (count === 0) {
        setError('발주가 필요한 식자재가 없거나 AI 예측 데이터가 없습니다. 예측 페이지에서 먼저 예측을 실행해주세요.');
      } else {
        setSuccess(`${count}건 발주가 등록되었습니다.`);
      }
      await loadOrders(storeId);
    } catch {
      setError('자동 발주 등록에 실패했습니다.');
    } finally {
      setOrdering(false);
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

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 식자재 발주 시스템</Typography>
        </Box>
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

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>발주 내역</Typography>
        <Box sx={{ height: 520 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress color="primary" />
            </Box>
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[10, 20]}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': { bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 700 },
              }}
            />
          )}
        </Box>
      </Paper>    </Stack>
  );
};

export default Orders;
