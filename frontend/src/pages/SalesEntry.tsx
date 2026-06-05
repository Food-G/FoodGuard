import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, Grid, TextField, MenuItem,
  CircularProgress, Alert, Stack, useTheme,  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
} from '@mui/material';
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
  const [error, setError] = useState('');

  const loadSales = async (sid: number) => {
    try {
      const sales = await salesService.getByStore(sid);
      setRows(sales.map((item: any) => ({
        id: item.id,
        menuName: item.menu?.menuName ?? '-',
        quantity: item.quantity,
        totalPrice: item.menu ? item.menu.price * item.quantity : 0,
        saleDate: item.saleDate,
      })));
    } catch (err) {
      console.error('Failed to load sales:', err);
      setError('판매 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) return;
        const stores = await storeService.getMyStores(user.id);
        if (!stores || stores.length === 0) {
          setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.');
          return;
        }
        const firstStoreId = stores[0].id;
        setStoreId(firstStoreId);
        const storeMenus = await menuService.getByStore(firstStoreId);
        setMenus(storeMenus);
        await loadSales(firstStoreId);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('데이터를 불러오지 못했습니다.');
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
      const selectedMenu: any = menus.find((m: any) => m.id === Number(formData.menuId));
      const totalPrice = selectedMenu ? selectedMenu.price * formData.quantity : 0;

      await salesService.create({
        storeId,
        menuId: formData.menuId,
        quantity: formData.quantity,
        totalPrice,
        saleDate: formData.saleDate,
      });

      await loadSales(storeId);
      setSuccess('매출 기록이 성공적으로 등록되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to create sale:', error);
    }
  };


  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Grid container spacing={3.5}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Typography variant="h6" color="text.primary" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconifyIcon icon="mingcute:save-fill" color={theme.palette.primary.main} />
              매출 등록
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}
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
          <Paper sx={{ width: '100%', p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" fontWeight={700} color="text.primary">판매 내역</Typography>
              <Chip label={`총 ${rows.length}건`} size="small" color="primary" variant="outlined" />
            </Stack>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress color="primary" />
              </Box>
            ) : rows.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography color="text.secondary">등록된 판매 내역이 없습니다.</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', color: 'text.primary' }}>판매 일자</TableCell>
                      <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.100', color: 'text.primary' }}>메뉴명</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'grey.100', color: 'text.primary' }}>수량</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.100', color: 'text.primary' }}>총 금액</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ color: 'text.primary' }}>{row.saleDate}</TableCell>
                        <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>{row.menuName}</TableCell>
                        <TableCell align="center" sx={{ color: 'text.primary' }}>{row.quantity}</TableCell>
                        <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 700 }}>
                          ₩{row.totalPrice?.toLocaleString() ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default SalesEntry;
