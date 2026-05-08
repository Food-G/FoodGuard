import { useEffect, useState } from 'react';
import { Typography, Paper, Button, CircularProgress, Chip, Stack, useTheme, Box } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../../services/orderService';

const AdminOrders = () => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllOrders = async () => {
      try {
        const orders = await orderService.getAll();
        setRows(orders.map((item: any) => ({
          id: item.id,
          storeName: item.store.storeName,
          name: item.ingredient.name,
          quantity: item.quantity,
          status: item.status,
          orderedAt: new Date(item.orderedAt).toLocaleString(),
        })));
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllOrders();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await orderService.approve(id);
      setRows(rows.map((row: any) => row.id === id ? { ...row, status: 'APPROVED' } : row));
    } catch (error) {
      console.error('Failed to approve order:', error);
    }
  };

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 180 },
    { field: 'storeName', headerName: '가맹점', width: 150 },
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: '수량', width: 100, align: 'right', headerAlign: 'right' },
    { 
      field: 'status', 
      headerName: '상태', 
      width: 120,
      renderCell: (params: any) => {
        let color: any = 'default';
        if (params.value === 'PENDING') color = 'warning';
        if (params.value === 'APPROVED') color = 'info';
        if (params.value === 'DONE') color = 'success';
        return <Chip label={params.value} color={color} size="small" variant="outlined" />;
      }
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 120,
      renderCell: (params: any) => (
        params.row.status === 'PENDING' && (
          <Button variant="contained" size="small" onClick={() => handleApprove(params.id as number)}>
            승인
          </Button>
        )
      )
    }
  ];

  return (
    <Stack gap={4}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>전체 가맹점 발주 승인 및 자원 관리</Typography>
      </Box>
      
      <Paper sx={{ height: 650, width: '100%', p: 2, border: `1px solid ${theme.palette.divider}` }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" height="100%"><CircularProgress /></Stack>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 20]}
            sx={{ border: 'none' }}
          />
        )}
      </Paper>
    </Stack>
  );
};

export default AdminOrders;
