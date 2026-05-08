import React, { useEffect, useState } from 'react';
import { Typography, Box, Paper, Button, Grid, TextField, MenuItem, CircularProgress, Alert, Stack, useTheme } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { salesService } from '../services/salesService';
import { menuService } from '../services/menuService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const SalesEntry = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ menuId: '', quantity: 1, saleDate: new Date().toISOString().split('T')[0] });
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (user?.id) {
          const stores = await storeService.getMyStores(user.id);
          if (stores && stores.length > 0) {
            const firstStoreId = stores[0].id;
            setStoreId(firstStoreId);
            const sales = await salesService.getByStore(firstStoreId);
            setRows(sales.map((item: any) => ({
              id: item.id,
              menuName: item.menu.menuName,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              saleDate: item.saleDate,
            })));
            const storeMenus = await menuService.getByStore(firstStoreId);
            setMenus(storeMenus);
          }
        }
      } catch (error) {
        console.error('Failed to fetch sales data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !formData.menuId) return;

    try {
      const selectedMenu: any = menus.find((m: any) => m.id === formData.menuId);
      const totalPrice = selectedMenu.price * formData.quantity;
      
      const newSale = await salesService.create({
        storeId,
        menuId: formData.menuId,
        quantity: formData.quantity,
        totalPrice,
        saleDate: formData.saleDate,
      });

      setRows([
        {
          id: newSale.id,
          menuName: selectedMenu.menuName,
          quantity: newSale.quantity,
          totalPrice: newSale.totalPrice,
          saleDate: newSale.saleDate,
        },
        ...rows,
      ]);
      setSuccess('매출 기록이 성공적으로 등록되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to create sale:', error);
    }
  };

  const columns: GridColDef[] = [
    { field: 'saleDate', headerName: '판매 일자', width: 150 },
    { field: 'menuName', headerName: '메뉴명', flex: 1, minWidth: 200 },
    { field: 'quantity', headerName: '수량', width: 100, type: 'number', align: 'right', headerAlign: 'right' },
    { field: 'totalPrice', headerName: '총 금액', width: 150, type: 'number', align: 'right', headerAlign: 'right', valueFormatter: (params: any) => `₩${params.toLocaleString()}` },
  ];

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>판매 실적 및 자원 순환 기록</Typography>
      </Box>
      
      <Grid container spacing={3.5}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Typography variant="h6" color="text.primary" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconifyIcon icon="mingcute:save-fill" color={theme.palette.primary.main} />
              매출 등록
            </Typography>
            {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}
            <Stack component="form" onSubmit={handleSubmit} gap={3}>
              <TextField
                select
                fullWidth
                variant="filled"
                label="메뉴 선택"
                required
                value={formData.menuId}
                onChange={(e) => setFormData({ ...formData, menuId: e.target.value })}
              >
                {menus.map((menu: any) => (
                  <MenuItem key={menu.id} value={menu.id}>{menu.menuName} (₩{menu.price})</MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                variant="filled"
                type="number"
                label="수량"
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
              />
              <TextField
                fullWidth
                variant="filled"
                type="date"
                label="판매 일자"
                required
                InputLabelProps={{ shrink: true }}
                value={formData.saleDate}
                onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
              />
              <Button type="submit" fullWidth variant="contained" size="large" startIcon={<IconifyIcon icon="mingcute:save-line" />} sx={{ borderRadius: 3 }}>
                매출 기록 저장
              </Button>
            </Stack>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: 650, width: '100%', p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress color="primary" />
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
                  '& .MuiDataGrid-columnHeaders': {
                    bgcolor: 'primary.light',
                    color: 'primary.dark',
                    fontWeight: 700
                  }
                }}
              />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default SalesEntry;
