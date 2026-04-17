import React, { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, CircularProgress, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const Orders = ({ user }: any) => {
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

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 200 },
    { field: 'name', headerName: '식자재명', flex: 1 },
    { field: 'quantity', headerName: '발주 수량', width: 120 },
    { 
      field: 'status', 
      headerName: '상태', 
      width: 120,
      renderCell: (params: any) => {
        let color: any = 'default';
        if (params.value === 'PENDING') color = 'warning';
        if (params.value === 'APPROVED') color = 'info';
        if (params.value === 'DONE') color = 'success';
        return <Chip label={params.value} color={color} size="small" />;
      }
    },
    {
      field: 'actions',
      headerName: '관리',
      width: 100,
      renderCell: (params: any) => (
        params.row.status === 'PENDING' && (
          <Button color="error" size="small" onClick={() => handleCancel(params.id as number)}>
            취소
          </Button>
        )
      )
    }
  ];

  const handleCancel = async (id: number) => {
    try {
      await orderService.cancel(id);
      setRows(rows.filter((row: any) => row.id !== id));
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="text.primary">식자재 발주 내역</Typography>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:shopping-cart-line" />}>
          신규 발주 등록
        </Button>
      </Box>
      
      <Paper sx={{ height: 600, width: '100%', bgcolor: 'background.paper' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 20]}
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': { color: 'text.primary' },
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default' },
            }}
          />
        )}
      </Paper>
    </Box>
  );
};

export default Orders;
