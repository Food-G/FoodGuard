import { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, CircularProgress, Stack } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const Inventory = ({ user }: any) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.id) {
          const stores = await storeService.getMyStores(user.id);
          if (stores && stores.length > 0) {
            const inventory = await inventoryService.getByStore(stores[0].id);
            setRows(inventory.map((item: any) => ({
              id: item.id,
              name: item.ingredient.name,
              category: item.ingredient.category,
              quantity: item.quantity,
              unit: item.ingredient.unit,
              updatedAt: new Date(item.updatedAt).toLocaleString(),
            })));
          }
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const columns: GridColDef[] = [
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    { field: 'category', headerName: '분류', width: 150 },
    { field: 'quantity', headerName: '현재고', width: 150, align: 'right', headerAlign: 'right' },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 250 },
  ];

  return (
    <Stack gap={4}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" color="common.white">재고 현황</Typography>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" />}>
          재고 등록
        </Button>
      </Stack>
      
      <Paper sx={{ height: 650, width: '100%', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
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
            sx={{ border: 'none' }}
          />
        )}
      </Paper>
    </Stack>
  );
};

export default Inventory;
