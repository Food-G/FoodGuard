import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, Stack, useTheme,
  TextField, InputAdornment, CircularProgress, Chip, Alert, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab,
} from '@mui/material';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { orderService } from '../../services/orderService';
import IconifyIcon from '../../components/base/IconifyIcon';

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  IN_DELIVERY: '배송중',
  DELIVERED: '배송완료',
  INSPECTED: '검수완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
  DONE: '완료',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  IN_DELIVERY: 'primary',
  DELIVERED: 'success',
  INSPECTED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
  DONE: 'success',
};

const ORDER_TABS = [
  { label: '대기중', value: 'REQUESTED' },
  { label: '승인됨', value: 'APPROVED' },
  { label: '배송중', value: 'IN_DELIVERY' },
  { label: '배송완료', value: 'DELIVERED' },
  { label: '검수완료', value: 'INSPECTED' },
  { label: '취소·거절', value: 'CANCELLED' },
];

const ACTIVE_STATUSES = ['APPROVED', 'IN_DELIVERY', 'DELIVERED'];

const AdminOrders = () => {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [tab, setTab] = useState('REQUESTED');

  const stompClients = useRef<Record<string, Client>>({});
  const loadOrdersFn = useRef<() => Promise<void>>();

  const subscribeGroupDelivery = (groupToken: string) => {
    if (stompClients.current[groupToken]) return;
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/delivery/group/${groupToken}`, (msg) => {
          const data = JSON.parse(msg.body);
          if (data.type === 'INSPECTED') {
            setSuccess('검수가 완료되었습니다. 재고에 자동 반영됩니다.');
            setTimeout(() => setSuccess(''), 4000);
            client.deactivate();
            delete stompClients.current[groupToken];
          }
          loadOrdersFn.current?.();
        });
      },
    });
    client.activate();
    stompClients.current[groupToken] = client;
  };

  const loadOrders = async () => {
    try {
      const orders = await orderService.getAll();
      const list = Array.isArray(orders) ? orders : [];
      setAllOrders(list);
      // 진행중인 그룹에 WebSocket 구독
      const seen = new Set<string>();
      list
        .filter((o: any) => ACTIVE_STATUSES.includes(o.status) && o.deliveryGroupToken)
        .forEach((o: any) => {
          if (!seen.has(o.deliveryGroupToken)) {
            seen.add(o.deliveryGroupToken);
            subscribeGroupDelivery(o.deliveryGroupToken);
          }
        });
    } catch {
      setError('발주 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersFn.current = loadOrders;
  });

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => {
      clearInterval(interval);
      Object.values(stompClients.current).forEach((c) => c.deactivate());
    };
  }, []);

  useEffect(() => {
    const storeIdParam = searchParams.get('storeId');
    if (storeIdParam) {
      setSelectedStoreId(Number(storeIdParam));
      setTab('REQUESTED');
    }
  }, [searchParams]);

  // 가맹점별 그룹핑
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

  const tabFilteredOrders =
    tab === 'CANCELLED'
      ? selectedOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED')
      : selectedOrders.filter((o) => o.status === tab);

  const countByStatus = (orders: any[], status: string) =>
    orders.filter((o) => o.status === status).length;

  const handleApproveAll = async () => {
    if (!selectedStoreId) return;
    try {
      const result = await orderService.approveAll(selectedStoreId);
      const groupToken = result.groupToken;
      const url = `${window.location.origin}/driver/group/${groupToken}`;
      navigator.clipboard.writeText(url);
      setSuccess(`일괄 승인 완료. 배달 링크가 클립보드에 복사되었습니다.`);
      setTimeout(() => setSuccess(''), 4000);
      await loadOrders();
      setTab('APPROVED');
    } catch {
      setError('승인 처리에 실패했습니다.');
    }
  };

  const copyGroupLink = (groupToken: string) => {
    const url = `${window.location.origin}/driver/group/${groupToken}`;
    navigator.clipboard.writeText(url);
    setSuccess('배달 링크가 복사되었습니다. 배달기사에게 전달하세요.');
    setTimeout(() => setSuccess(''), 3000);
  };

  // APPROVED 탭에서 그룹 토큰 추출 (같은 가맹점이면 동일)
  const approvedGroupToken = tabFilteredOrders.find((o) => o.deliveryGroupToken)?.deliveryGroupToken ?? null;

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
                      onClick={() => { setRegionFilter(r); setSelectedStoreId(null); }}
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
                  const activeGroups = new Set(
                    orders
                      .filter((o: any) => ACTIVE_STATUSES.includes(o.status) && o.deliveryGroupToken)
                      .map((o: any) => o.deliveryGroupToken)
                  ).size;
                  return (
                    <Box
                      key={store.id}
                      onClick={() => { setSelectedStoreId(store.id); setTab('REQUESTED'); }}
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
                          noWrap sx={{ maxWidth: 140 }}
                        >
                          {store.storeName}
                        </Typography>
                        <Stack direction="row" gap={0.5}>
                          {pending > 0 && (
                            <Chip
                              label={`대기 ${pending}`}
                              color="warning" size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                          {activeGroups > 0 && (
                            <Chip
                              label={`🚚 ${activeGroups}`}
                              color="info" size="small"
                              sx={{ height: 20, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        총 {orders.length}건
                        {countByStatus(orders, 'INSPECTED') > 0 && ` · 검수완료 ${countByStatus(orders, 'INSPECTED')}건`}
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
                  <Typography variant="h6" fontWeight={700}>{selectedEntry.store.storeName}</Typography>
                  <Stack direction="row" gap={0.75}>
                    {(['REQUESTED', 'APPROVED', 'IN_DELIVERY', 'DELIVERED', 'INSPECTED'] as const).map((s) => {
                      const cnt = countByStatus(selectedOrders, s);
                      return cnt > 0 ? (
                        <Chip key={s} label={`${STATUS_LABEL[s]} ${cnt}`} color={STATUS_COLOR[s]} size="small" sx={{ fontWeight: 700 }} />
                      ) : null;
                    })}
                  </Stack>
                </Stack>
              </Box>

              {/* 탭 + 버튼 */}
              <Stack direction="row" alignItems="center" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Tabs
                  value={tab}
                  onChange={(_, v) => setTab(v)}
                  sx={{ px: 1, minHeight: 44, flex: 1 }}
                  textColor="primary" indicatorColor="primary"
                  variant="scrollable" scrollButtons="auto"
                >
                  {ORDER_TABS.map((t) => {
                    const cnt =
                      t.value === 'CANCELLED'
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
                                color={STATUS_COLOR[t.value] ?? 'default'}
                                sx={{ height: 18, fontSize: 11, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                              />
                            )}
                          </Stack>
                        }
                      />
                    );
                  })}
                </Tabs>
                {tab === 'REQUESTED' && countByStatus(selectedOrders, 'REQUESTED') > 0 && (
                  <Box sx={{ pr: 1.5 }}>
                    <Button
                      variant="contained" color="info" size="small"
                      onClick={handleApproveAll}
                      sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      일괄 승인 ({countByStatus(selectedOrders, 'REQUESTED')}건)
                    </Button>
                  </Box>
                )}
              </Stack>

              {/* APPROVED 탭: 그룹 배달 링크 배너 */}
              {tab === 'APPROVED' && approvedGroupToken && (
                <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'info.lighter', borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600} color="info.dark">
                      배달기사에게 묶음 배달 링크를 전달하세요
                    </Typography>
                    <Button
                      variant="contained" color="info" size="small"
                      onClick={() => copyGroupLink(approvedGroupToken)}
                      sx={{ borderRadius: 2, fontWeight: 700 }}
                    >
                      🔗 배달 링크 복사
                    </Button>
                  </Stack>
                </Box>
              )}

              {/* 발주 목록 */}
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {tabFilteredOrders.length === 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 260, gap: 1.5 }}>
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
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tabFilteredOrders.map((order) => (
                          <TableRow key={order.id} hover>
                            <TableCell sx={{ fontWeight: 600 }}>{order.ingredient?.name ?? '-'}</TableCell>
                            <TableCell align="right">
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
