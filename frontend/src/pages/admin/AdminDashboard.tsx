import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, Stack, useTheme, CircularProgress, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button,
} from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../../services/storeService';
import { salesService } from '../../services/salesService';
import { orderService } from '../../services/orderService';
import IconifyIcon from '../../components/base/IconifyIcon';

const AdminDashboard = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<Record<string, number>>({});
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [storeList, revMap, allOrders] = await Promise.all([
          storeService.getAll(),
          salesService.getAllStoreWeeklySummary(),
          orderService.getAll(),
        ]);
        setStores(storeList ?? []);
        setWeeklyRevenue(revMap ?? {});
        setPendingOrders((allOrders ?? []).filter((o: any) => o.status === 'REQUESTED'));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const totalRevenue = Object.values(weeklyRevenue).reduce((s, v) => s + (v as number), 0);

  const topStores = stores
    .map((s) => ({ name: s.storeName, value: weeklyRevenue[s.id] ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const barOption = {
    color: [theme.palette.primary.main],
    grid: { top: '8%', left: '3%', right: '4%', bottom: '5%', containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>₩${p[0].value.toLocaleString()}` },
    xAxis: {
      type: 'category',
      data: topStores.map((s) => s.name.length > 6 ? s.name.slice(0, 6) + '..' : s.name),
      axisLabel: { color: theme.palette.text.secondary, fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.palette.text.secondary,
        formatter: (v: number) => v >= 10000 ? `${Math.round(v / 10000)}만` : String(v),
      },
    },
    series: [{
      type: 'bar',
      data: topStores.map((s) => s.value),
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: theme.palette.primary.main },
          { offset: 1, color: theme.palette.primary.light },
        ]),
      },
      barMaxWidth: 56,
    }],
  };

  const quickMenus = [
    {
      title: '가맹점 관리',
      desc: '가맹점 목록 · 지역별 현황 · 주간 매출',
      icon: 'mingcute:grid-fill',
      path: '/admin/stores',
      color: theme.palette.primary.main,
    },
    {
      title: '통계 분석',
      desc: '네트워크 매출 추세 · 전주 비교 · 비중',
      icon: 'mingcute:chart-bar-fill',
      path: '/admin/stats',
      color: theme.palette.secondary.main,
    },
    {
      title: '발주 관리',
      desc: '전체 발주 내역 · 승인 · 완료 처리',
      icon: 'mingcute:list-check-fill',
      path: '/admin/orders',
      color: theme.palette.warning.main,
    },
  ];

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>본사 통합 관리 센터</Typography>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={3}>
        {[
          {
            label: '전체 가맹점',
            value: loading ? null : `${stores.length}개`,
            icon: 'mingcute:store-2-line',
            color: theme.palette.primary.main,
            sub: '활성 가맹점 기준',
          },
          {
            label: '이번 주 네트워크 매출',
            value: loading ? null : `₩${totalRevenue.toLocaleString()}`,
            icon: 'mingcute:bank-card-line',
            color: theme.palette.secondary.main,
            sub: '최근 7일 전체 합산',
          },
          {
            label: '승인 대기 발주',
            value: loading ? null : `${pendingOrders.length}건`,
            icon: 'mingcute:clipboard-line',
            color: theme.palette.warning.main,
            sub: pendingOrders.length > 0 ? '처리가 필요합니다' : '모두 처리됨',
            badge: pendingOrders.length > 0,
          },
          {
            label: '이번 주 매출 1위',
            value: loading ? null : (topStores[0]?.name ?? '-'),
            icon: 'mingcute:trophy-line',
            color: theme.palette.success.main,
            sub: topStores[0] ? `₩${topStores[0].value.toLocaleString()}` : '데이터 없음',
          },
        ].map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.label}>
            <Paper
              sx={{
                p: 3, borderRadius: 4, border: `1px solid ${theme.palette.divider}`, height: 1,
                transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 20px -4px ${card.color}25` },
              }}
            >
              <Stack gap={1.5}>
                <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: `${card.color}15`, color: card.color, width: 'fit-content', display: 'flex' }}>
                  <IconifyIcon icon={card.icon} width={26} />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>{card.label}</Typography>
                  {loading
                    ? <CircularProgress size={22} sx={{ color: card.color }} />
                    : (
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="h4" fontWeight={800} color="text.primary">{card.value}</Typography>
                        {card.badge && <Chip label="확인 필요" color="warning" size="small" sx={{ fontWeight: 700 }} />}
                      </Stack>
                    )
                  }
                  <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Chart + Pending Orders */}
      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={7}>
          <Paper sx={{ p: 4, borderRadius: 4, border: `1px solid ${theme.palette.divider}`, height: 380 }}>
            <Typography variant="h6" fontWeight={700} mb={2.5}>이번 주 매출 Top 가맹점</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 290 }}>
                <CircularProgress />
              </Box>
            ) : topStores.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 290 }}>
                <Typography color="text.secondary">매출 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <ReactEChart option={barOption} echarts={echarts} sx={{ height: 295 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Paper sx={{ p: 4, borderRadius: 4, border: `1px solid ${theme.palette.divider}`, height: 380 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
              <Typography variant="h6" fontWeight={700}>승인 대기 발주</Typography>
              <Button
                size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 2 }}
                onClick={() => navigate('/admin/orders')}
              >
                전체 보기
              </Button>
            </Stack>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 280 }}>
                <CircularProgress />
              </Box>
            ) : pendingOrders.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 280, gap: 1.5 }}>
                <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={44} />
                <Typography color="text.secondary" fontWeight={500}>대기 중인 발주가 없습니다.</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 285 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>가맹점</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>식자재</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: 12 }}>수량</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingOrders.slice(0, 6).map((o: any) => (
                      <TableRow key={o.id} hover>
                        <TableCell sx={{ color: 'text.primary', fontSize: 13 }}>{o.store?.storeName ?? '-'}</TableCell>
                        <TableCell sx={{ color: 'text.primary', fontWeight: 600, fontSize: 13 }}>{o.ingredient?.name ?? '-'}</TableCell>
                        <TableCell align="right" sx={{ color: 'text.secondary', fontSize: 13 }}>
                          {o.orderedQty ?? o.quantity} {o.ingredient?.unit ?? ''}
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

      {/* Quick Nav */}
      <Grid container spacing={3}>
        {quickMenus.map((m) => (
          <Grid item xs={12} md={4} key={m.title}>
            <Paper
              onClick={() => navigate(m.path)}
              sx={{
                p: 3.5, borderRadius: 4, border: `1px solid ${theme.palette.divider}`,
                cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 10px 24px -4px ${m.color}30`, borderColor: m.color },
              }}
            >
              <Stack direction="row" alignItems="center" gap={2.5}>
                <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: `${m.color}15`, color: m.color, display: 'flex', flexShrink: 0 }}>
                  <IconifyIcon icon={m.icon} width={28} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" fontWeight={700} color="text.primary">{m.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.desc}</Typography>
                </Box>
                <IconifyIcon icon="mingcute:arrow-right-line" color={theme.palette.text.disabled} width={20} />
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
};

export default AdminDashboard;
