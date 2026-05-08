import { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, CircularProgress, Chip, Stack, useTheme } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const Orders = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.id) {
          const stores = await storeService.getMyStores(user.id);
          if (stores && stores.length > 0) {
            const orders = await orderService.getByStore(stores[0].id);
            setRows(orders.map((item: any) => ({
              id: item.id,
              name: item.ingredient.name,
              quantity: item.quantity,
              status: item.status,
              orderedAt: new Date(item.orderedAt).toLocaleString(),
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleCancel = async (id: number) => {
    try {
      await orderService.cancel(id);
      setRows(rows.filter((row: any) => row.id !== id));
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 200 },
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: '발주 수량', width: 150, align: 'right', headerAlign: 'right' },
    { 
      field: 'status', 
      headerName: '상태', 
      width: 150,
      renderCell: (params: any) => {
        let color: any = 'default';
        if (params.value === 'PENDING') color = 'warning';
        if (params.value === 'APPROVED') color = 'info';
        if (params.value === 'DONE') color = 'success';
        return <Chip label={params.value} color={color} size="small" variant="filled" sx={{ fontWeight: 700 }} />;
      }
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 100,
      renderCell: (params: any) => (
        params.row.status === 'PENDING' && (
          <Button 
            color="error" 
            size="small" 
            variant="outlined"
            onClick={() => handleCancel(params.id as number)}
            sx={{ borderRadius: 2 }}
          >
            취소
          </Button>
        )
      )
    }
  ];

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 식자재 발주 시스템</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<IconifyIcon icon="mingcute:refresh-2-line" />}
          sx={{ px: 4, py: 1.5, borderRadius: 3 }}
        >
          신규 발주 등록
        </Button>
      </Stack>
      
      <Paper sx={{ height: 650, width: '100%', p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 20]}
            sx={{ 
              border: 'none',
              '& .MuiDataGrid-columnHeaders': {
                bgcolor: 'secondary.light',
                color: 'secondary.dark',
                fontWeight: 700
              }
            }}
          />
        )}
      </Paper>
    </Stack>
  );
};

export default Orders;
