import React, { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, CircularProgress } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const Inventory = ({ user }: any) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.id) {
          const stores = await storeService.getMyStores(user.id);
          if (stores && stores.length > 0) {
            const firstStoreId = stores[0].id;
            setStoreId(firstStoreId);
            const inventory = await inventoryService.getByStore(firstStoreId);
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
    { field: 'name', headerName: '식자재명', flex: 1 },
    { field: 'category', headerName: '분류', width: 120 },
    { field: 'quantity', headerName: '현재고', width: 120, type: 'number' },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 200 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" color="text.primary">재고 현황</Typography>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" />}>
          재고 등록
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
            checkboxSelection
            disableRowSelectionOnClick
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

export default Inventory;
