import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Grid, Stack, useTheme,
  TextField, InputAdornment, CircularProgress, Chip, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
} from '@mui/material';
import { orderService } from '../../services/orderService';
import IconifyIcon from '../../components/base/IconifyIcon';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  DONE: '완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  DONE: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const ORDER_TABS = [
  { label: '전체', value: 'ALL' },
  { label: '대기중', value: 'REQUESTED' },
  { label: '승인됨', value: 'APPROVED' },
  { label: '완료', value: 'DONE' },
  { label: '취소·거절', value: 'CANCELLED' },
];

const AdminOrders = () => {
  const theme = useTheme();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [tab, setTab] = useState('ALL');

  const loadOrders = async () => {
    try {
      const orders = await orderService.getAll();
      setAllOrders(Array.isArray(orders) ? orders : []);
    } catch {
      setError('발주 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // 발주 목록에서 가맹점별로 그룹핑
  const storeMap = new Map<number, { store: any; orders: any[] }>();
  allOrders.forEach((order) => {
    const sid = order.store?.id;
    if (sid == null) return;
    if (!storeMap.has(sid)) storeMap.set(sid, { store: order.store, orders: [] });
    storeMap.get(sid)!.orders.push(order);
  });

  const storeList = Array.from(storeMap.values());

  const regions = ['ALL', ...Array.from(
    new Set(storeList.map((s) => s.store?.region).filter(Boolean))
  ) as string[]];

  const filteredStores = storeList.filter((s) => {
    const matchSearch = s.store?.storeName?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = regionFilter === 'ALL' || s.store?.region === regionFilter;
    return matchSearch && matchRegion;
  });

  const selectedEntry = selectedStoreId != null ? storeMap.get(selectedStoreId) : null;
  const selectedOrders = selectedEntry?.orders ?? [];

  const tabFilteredOrders = tab === 'ALL'
    ? selectedOrders
    : tab === 'CANCELLED'
    ? selectedOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED')
    : selectedOrders.filter((o) => o.status === tab);

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await orderService.updateStatus(id, status);
      setSuccess(status === 'APPROVED' ? '발주가 승인되었습니다.' : '완료 처리되었습니다. 재고가 자동 반영됩니다.');
      setTimeout(() => setSuccess(''), 3000);
      await loadOrders();
    } catch {
      setError('상태 변경에 실패했습니다.');
    }
  };

  const countByStatus = (orders: any[], status: string) =>
    orders.filter((o) => o.status === status).length;

  return (
    <Stack gap={3.5} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>전체 가맹점 발주 관리</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Grid container spacing={2.5}>
        {/* 왼쪽: 가맹점 검색 + 목록 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{
            border: `1px solid ${theme.palette.divider}`, borderRadius: 3,
            height: 620, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <Box sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <TextField
                size="small" fullWidth
                placeholder="가맹점명 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <IconifyIcon icon="mingcute:search-2-line" width={17} color={theme.palette.text.secondary} />
                    </InputAdornment>
                  ),
                }}
              />
              {regions.length > 1 && (
                <Stack
                  direction="row" gap={0.75} mt={1.5}
                  sx={{ overflowX: 'auto', pb: 0.5, '::-webkit-scrollbar': { display: 'none' } }}
                >
                  {regions.map((r) => (
                    <Chip
                      key={r}
                      label={r === 'ALL' ? '전체' : r}
                      size="small"
                      onClick={() => {
                        setRegionFilter(r);
                        setSelectedStoreId(null);
                      }}
                      color={regionFilter === r ? 'primary' : 'default'}
                      variant={regionFilter === r ? 'filled' : 'outlined'}
                      sx={{ fontWeight: 600, flexShrink: 0, cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : filteredStores.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <IconifyIcon icon="mingcute:inbox-line" width={32} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" fontSize={14}>
                  {search ? '검색 결과가 없습니다.' : '발주 내역이 없습니다.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {filteredStores.map(({ store, orders }, idx) => {
                  const isSelected = selectedStoreId === store.id;
                  const pending = countByStatus(orders, 'REQUESTED');
                  return (
                    <Box
                      key={store.id}
                      onClick={() => { setSelectedStoreId(store.id); setTab('ALL'); }}
                      sx={{
                        px: 2.5, py: 1.75,
                        cursor: 'pointer',
                        borderLeft: `3px solid ${isSelected ? theme.palette.primary.main : 'transparent'}`,
                        bgcolor: isSelected ? `${theme.palette.primary.main}0A` : 'transparent',
                        transition: 'background 0.12s',
                        borderTop: idx > 0 ? `1px solid ${theme.palette.divider}` : 'none',
                        '&:hover': { bgcolor: isSelected ? `${theme.palette.primary.main}12` : 'action.hover' },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight={700} fontSize={14}
                          color={isSelected ? 'primary.main' : 'text.primary'}
                          noWrap sx={{ maxWidth: 165 }}
                        >
                          {store.storeName}
                        </Typography>
                        {pending > 0 && (
                          <Chip
                            label={`대기 ${pending}`}
                            color="warning" size="small"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        총 {orders.length}건
                        {countByStatus(orders, 'DONE') > 0 && ` · 완료 ${countByStatus(orders, 'DONE')}건`}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 오른쪽: 선택한 가맹점의 발주 상세 */}
        <Grid item xs={12} md={8}>
          {!selectedEntry ? (
            <Paper sx={{
              border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: 620,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2,
            }}>
              <Box sx={{ p: 3, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex' }}>
                <IconifyIcon icon="mingcute:list-check-fill" width={44} color={theme.palette.text.disabled} />
              </Box>
              <Typography color="text.secondary" fontWeight={600}>가맹점을 선택하면 발주 내역이 표시됩니다.</Typography>
              <Typography variant="caption" color="text.disabled">왼쪽 목록에서 가맹점을 클릭하세요</Typography>
            </Paper>
          ) : (
            <Paper sx={{
              border: `1px solid ${theme.palette.divider}`, borderRadius: 3,
              height: 620, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {/* 헤더 */}
              <Box sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={700} color="text.primary">
                    {selectedEntry.store.storeName}
                  </Typography>
                  <Stack direction="row" gap={0.75}>
                    {(['REQUESTED', 'APPROVED', 'DONE'] as const).map((s) => {
                      const cnt = countByStatus(selectedOrders, s);
                      return cnt > 0 ? (
                        <Chip
                          key={s}
                          label={`${STATUS_LABEL[s]} ${cnt}`}
                          color={STATUS_COLOR[s]}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      ) : null;
                    })}
                  </Stack>
                </Stack>
              </Box>

              {/* 상태 필터 탭 */}
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ px: 1, borderBottom: `1px solid ${theme.palette.divider}`, minHeight: 44 }}
                textColor="primary" indicatorColor="primary"
              >
                {ORDER_TABS.map((t) => {
                  const cnt = t.value === 'ALL'
                    ? selectedOrders.length
                    : t.value === 'CANCELLED'
                    ? countByStatus(selectedOrders, 'CANCELLED') + countByStatus(selectedOrders, 'REJECTED')
                    : countByStatus(selectedOrders, t.value);
                  return (
                    <Tab
                      key={t.value}
                      value={t.value}
                      sx={{ fontWeight: 600, minHeight: 44, fontSize: 13 }}
                      label={
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          {t.label}
                          {cnt > 0 && (
                            <Chip
                              label={cnt}
                              size="small"
                              color={t.value === 'REQUESTED' ? 'warning' : t.value === 'APPROVED' ? 'info' : t.value === 'DONE' ? 'success' : 'default'}
                              sx={{ height: 18, fontSize: 11, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                        </Stack>
                      }
                    />
                  );
                })}
              </Tabs>

              {/* 발주 목록 */}
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {tabFilteredOrders.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
                    <Typography color="text.secondary">해당 상태의 발주가 없습니다.</Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: 'background.default' }}>
                          <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>식자재</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>수량</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>상태</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>발주 일시</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>관리</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tabFilteredOrders.map((order) => (
                          <TableRow key={order.id} hover>
                            <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>
                              {order.ingredient?.name ?? '-'}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'text.primary' }}>
                              {order.orderedQty ?? order.quantity}
                              <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                                {order.ingredient?.unit ?? ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={STATUS_LABEL[order.status] ?? order.status}
                                color={STATUS_COLOR[order.status] ?? 'default'}
                                size="small" sx={{ fontWeight: 700 }}
                              />
                            </TableCell>
                            <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                              {order.orderedAt ? new Date(order.orderedAt).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell align="center">
                              {order.status === 'REQUESTED' && (
                                <Button
                                  variant="contained" color="info" size="small" sx={{ borderRadius: 2, minWidth: 52 }}
                                  onClick={() => handleUpdateStatus(order.id, 'APPROVED')}
                                >
                                  승인
                                </Button>
                              )}
                              {order.status === 'APPROVED' && (
                                <Button
                                  variant="contained" color="success" size="small" sx={{ borderRadius: 2, minWidth: 52 }}
                                  onClick={() => handleUpdateStatus(order.id, 'DONE')}
                                >
                                  완료
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
};

export default AdminOrders;
