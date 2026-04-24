import { useEffect, useState } from 'react';
import { Typography, Box, Paper, CircularProgress, Stack, useTheme } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { storeService } from '../../services/storeService';

const StoreManagement = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const stores = await storeService.getAll();
        setRows(stores.map((s: any) => ({
          id: s.id,
          storeName: s.storeName,
          address: s.address,
          phone: s.phone,
          ownerEmail: s.user.email,
          createdAt: new Date(s.createdAt).toLocaleDateString(),
        })));
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, []);

  const columns: GridColDef[] = [
    { field: 'storeName', headerName: '가맹점명', flex: 1 },
    { field: 'ownerEmail', headerName: '점주 이메일', width: 200 },
    { field: 'phone', headerName: '전화번호', width: 150 },
    { field: 'address', headerName: '주소', width: 250 },
    { field: 'createdAt', headerName: '등록일', width: 120 },
  ];

  return (
    <Stack gap={4}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 가맹점 네트워크 관리</Typography>
      </Box>
      <Paper sx={{ height: 600, width: '100%', bgcolor: 'background.paper', p: 2, border: `1px solid ${theme.palette.divider}` }}>
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
    </Stack>
  );
};

export default StoreManagement;
