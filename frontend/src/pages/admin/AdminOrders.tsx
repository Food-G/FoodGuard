import { useEffect, useState } from 'react';
import {
  Typography, Paper, Button, CircularProgress, Chip, Stack, useTheme, Box, Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../../services/orderService';

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

const AdminOrders = () => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrders = async () => {
    try {
      const orders = await orderService.getAll();
      const list = Array.isArray(orders) ? orders : [];
      setRows(list.map((item: any) => ({
        id: item.id,
        storeName: item.store?.storeName ?? '-',
        name: item.ingredient?.name ?? '-',
        quantity: item.orderedQty ?? item.quantity ?? '-',
        unit: item.ingredient?.unit ?? '',
        status: item.status,
        orderedAt: item.orderedAt ? new Date(item.orderedAt).toLocaleString() : '-',
      })));
    } catch {
      setError('발주 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await orderService.updateStatus(id, status);
      setSuccess(status === 'APPROVED' ? '발주가 승인되었습니다.' : '발주가 완료 처리되었습니다. 재고가 자동 반영됩니다.');
      await loadOrders();
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  };

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 180 },
    { field: 'storeName', headerName: '가맹점', width: 160 },
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 160 },
    {
      field: 'quantity', headerName: '발주 수량', width: 130, align: 'right', headerAlign: 'right',
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
      field: 'actions', headerName: '관리', width: 130,
      renderCell: (params) => {
        if (params.row.status === 'REQUESTED') {
          return (
            <Button
              variant="contained" color="info" size="small"
              onClick={() => handleUpdateStatus(params.id as number, 'APPROVED')}
              sx={{ borderRadius: 2 }}
            >
              승인
            </Button>
          );
        }
        if (params.row.status === 'APPROVED') {
          return (
            <Button
              variant="contained" color="success" size="small"
              onClick={() => handleUpdateStatus(params.id as number, 'DONE')}
              sx={{ borderRadius: 2 }}
            >
              완료 처리
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>전체 가맹점 발주 관리</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>발주 내역</Typography>
          <Typography variant="caption" color="text.secondary">30초마다 자동 갱신</Typography>
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
    </Stack>
  );
};

export default AdminOrders;
