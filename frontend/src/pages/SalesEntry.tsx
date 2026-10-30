import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, Grid, TextField, MenuItem,
  CircularProgress, Alert, Stack, useTheme,  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  IconButton,
} from '@mui/material';
import { salesService } from '../services/salesService';
import { menuService } from '../services/menuService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import EventNoteCard from '../components/EventNoteCard';

const SalesEntry = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ menuId: '', quantity: 1, saleDate: new Date().toISOString().split('T')[0] });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [flags, setFlags] = useState<any[]>([]);
  const [flagForm, setFlagForm] = useState({ flagType: 'SOLD_OUT', menuId: '', flagDate: new Date().toISOString().split('T')[0] });

  const loadFlags = async (sid: number) => {
    try {
      setFlags((await salesService.getFlags(sid)) ?? []);
    } catch {
      setError('휴무·품절 기록을 불러오지 못했습니다.');
    }
  };

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
        await loadFlags(firstStoreId);
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

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || (flagForm.flagType === 'SOLD_OUT' && !flagForm.menuId)) return;
    try {
      await salesService.createFlag({
        storeId,
        flagDate: flagForm.flagDate,
        flagType: flagForm.flagType as 'CLOSED' | 'SOLD_OUT',
        ...(flagForm.flagType === 'SOLD_OUT' ? { menuId: Number(flagForm.menuId) } : {}),
      });
      await loadFlags(storeId);
    } catch {
      setError('휴무·품절 기록에 실패했습니다.');
    }
  };

  const handleFlagDelete = async (id: number) => {
    if (!storeId) return;
    try {
      await salesService.deleteFlag(id);
      await loadFlags(storeId);
    } catch {
      setError('기록 삭제에 실패했습니다.');
    }
  };

  const menuName = (menuId: number) => (menus as any[]).find((m) => m.id === menuId)?.menuName ?? '메뉴';


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

          <Paper sx={{ p: 4, mt: 3.5, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Typography variant="h6" color="text.primary" fontWeight={700} sx={{ mb: 1 }}>
              휴무·품절 기록
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              품절된 날의 판매량은 실제 수요보다 작고, 휴무일에는 판매가 없습니다. 기록하면 AI 예측 학습에서 제외하고, 휴무일은 발주 예측을 0으로 둡니다.
            </Typography>
            <Stack component="form" onSubmit={handleFlagSubmit} gap={2}>
              <TextField
                select
                fullWidth
                variant="filled"
                label="구분"
                value={flagForm.flagType}
                onChange={(e) => setFlagForm({ ...flagForm, flagType: e.target.value })}
              >
                <MenuItem value="SOLD_OUT">메뉴 품절</MenuItem>
                <MenuItem value="CLOSED">매장 휴무</MenuItem>
              </TextField>
              {flagForm.flagType === 'SOLD_OUT' && (
                <TextField
                  select
                  fullWidth
                  variant="filled"
                  label="품절 메뉴"
                  required
                  value={flagForm.menuId}
                  onChange={(e) => setFlagForm({ ...flagForm, menuId: e.target.value })}
                >
                  {menus.map((menu: any) => (
                    <MenuItem key={menu.id} value={menu.id}>{menu.menuName}</MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                fullWidth
                variant="filled"
                type="date"
                label="날짜"
                required
                InputLabelProps={{ shrink: true }}
                value={flagForm.flagDate}
                onChange={(e) => setFlagForm({ ...flagForm, flagDate: e.target.value })}
              />
              <Button type="submit" fullWidth variant="outlined" size="large" sx={{ borderRadius: 3 }}>
                기록
              </Button>
            </Stack>
            {flags.length > 0 && (
              <Stack gap={0.5} sx={{ mt: 3, maxHeight: 240, overflowY: 'auto' }}>
                {flags.map((f) => (
                  <Stack key={f.id} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" color="text.primary">
                      {f.flagDate} · {f.flagType === 'CLOSED' ? '매장 휴무' : `${menuName(f.menuId)} 품절`}
                    </Typography>
                    <IconButton size="small" color="error" onClick={() => handleFlagDelete(f.id)}>
                      <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          {storeId && <EventNoteCard storeId={storeId} />}
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
