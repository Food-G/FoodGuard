import { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, CircularProgress, Stack, useTheme, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const Inventory = ({ user }: any) => {
  const theme = useTheme();
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
    { 
      field: 'category', 
      headerName: '분류', 
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" color="primary" />
      )
    },
    { field: 'quantity', headerName: '현재고', width: 150, align: 'right', headerAlign: 'right' },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 250 },
  ];

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>실시간 자원 및 재고 현황</Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<IconifyIcon icon="mingcute:add-line" />}
          sx={{ px: 4, py: 1.5, borderRadius: 3 }}
        >
          재고 등록
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
                bgcolor: 'primary.light',
                color: 'primary.dark',
                fontWeight: 700
              },
              '& .MuiDataGrid-cell:focus': {
                outline: 'none'
              }
            }}
          />
        )}
      </Paper>
    </Stack>
  );
};

export default Inventory;
