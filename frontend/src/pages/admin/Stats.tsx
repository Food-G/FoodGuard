import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Typography, Paper, Grid, Stack, useTheme, Box, CircularProgress, Chip, Button,
} from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../../services/storeService';
import { salesService } from '../../services/salesService';
import IconifyIcon from '../../components/base/IconifyIcon';

// ─────────────────────────────────────────────
// 단일 가맹점 뷰
// ─────────────────────────────────────────────
const SingleStoreStats = ({ storeId, storeName }: { storeId: number; storeName: string }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [weekly, setWeekly] = useState<any>(null);
  const [dailySales, setDailySales] = useState<{ date: string; revenue: number }[]>([]);
  const [menuShare, setMenuShare] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 13);
    const startStr = start.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    Promise.allSettled([
      salesService.getWeeklySummary(storeId),
      salesService.getByDateRange(storeId, startStr, endStr),
    ]).then(([weeklyRes, salesRes]) => {
      if (weeklyRes.status === 'fulfilled') setWeekly(weeklyRes.value);

      if (salesRes.status === 'fulfilled') {
        const records: any[] = Array.isArray(salesRes.value) ? salesRes.value : [];

        // 날짜별 매출 집계
        const byDate: Record<string, number> = {};
        const byMenu: Record<string, number> = {};
        records.forEach((r) => {
          const rev = (r.menu?.price ?? 0) * (r.quantity ?? 0);
          byDate[r.saleDate] = (byDate[r.saleDate] ?? 0) + rev;
          const menuName = r.menu?.menuName ?? '기타';
          byMenu[menuName] = (byMenu[menuName] ?? 0) + rev;
        });

        // 14일치 전부 채우기 (매출 없는 날은 0)
        const daily: { date: string; revenue: number }[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          daily.push({ date: dateStr, revenue: byDate[dateStr] ?? 0 });
        }
        setDailySales(daily);
        setMenuShare(Object.entries(byMenu).map(([name, value]) => ({ name, value })));
      }
    }).finally(() => setLoading(false));
  }, [storeId]);

  const weekChange = weekly?.prevWeekRevenue > 0
    ? Math.round((weekly.thisWeekRevenue - weekly.prevWeekRevenue) / weekly.prevWeekRevenue * 1000) / 10
    : null;

  const dailyChartOption = {
    color: [theme.palette.primary.main],
    tooltip: {
      trigger: 'axis',
      formatter: (p: any) => `${p[0].name}<br/>₩${p[0].value.toLocaleString()}`,
    },
    grid: { top: '8%', left: '3%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dailySales.map((d) => d.date.slice(5)), // MM-DD
      axisLabel: { color: theme.palette.text.secondary, fontSize: 11 },
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
      data: dailySales.map((d) => d.revenue),
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: theme.palette.primary.main },
          { offset: 1, color: theme.palette.primary.light },
        ]),
      },
      barMaxWidth: 40,
    }],
  };

  const menuPieOption = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>₩${p.value.toLocaleString()} (${p.percent}%)` },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: theme.palette.text.secondary, fontSize: 11 } },
    series: [{
      name: '메뉴별 매출',
      type: 'pie',
      radius: ['38%', '65%'],
      center: ['50%', '42%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: menuShare.length > 0 ? menuShare : [{ value: 1, name: '데이터 없음' }],
    }],
  };

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" gap={2}>
        <Button
          variant="outlined" size="small"
          startIcon={<IconifyIcon icon="mingcute:arrow-left-line" width={16} />}
          onClick={() => navigate('/admin/stores')}
          sx={{ borderRadius: 2, fontWeight: 600 }}
        >
          가맹점 목록
        </Button>
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>{storeName} — 매출 통계</Typography>
        </Box>
      </Stack>

      {/* 요약 카드 */}
      <Grid container spacing={3}>
        {[
          {
            label: '이번 주 매출',
            value: weekly ? `₩${(weekly.thisWeekRevenue ?? 0).toLocaleString()}` : '-',
            color: theme.palette.primary.main,
            icon: 'mingcute:bank-card-line',
          },
          {
            label: '지난 주 매출',
            value: weekly ? `₩${(weekly.prevWeekRevenue ?? 0).toLocaleString()}` : '-',
            color: theme.palette.secondary.main,
            icon: 'mingcute:history-line',
          },
          {
            label: '전주 대비',
            value: loading ? '-' : weekChange !== null ? `${weekChange >= 0 ? '+' : ''}${weekChange}%` : '비교 불가',
            color: weekChange !== null ? (weekChange >= 0 ? theme.palette.success.main : theme.palette.error.main) : theme.palette.text.secondary,
            icon: 'mingcute:chart-line-fill',
            badge: weekChange !== null ? (weekChange >= 0 ? '성장' : '감소') : null,
            badgeColor: weekChange !== null ? (weekChange >= 0 ? 'success' : 'error') : 'default',
          },
        ].map((card) => (
          <Grid item xs={12} sm={4} key={card.label}>
            <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
              <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
                <IconifyIcon icon={card.icon} width={17} color={card.color} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>{card.label}</Typography>
              </Stack>
              {loading ? <CircularProgress size={22} sx={{ color: card.color }} /> : (
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="h4" fontWeight={800} sx={{ color: card.color }}>{card.value}</Typography>
                  {card.badge && (
                    <Chip label={card.badge} color={card.badgeColor as any} size="small" sx={{ fontWeight: 700 }} />
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* 차트 */}
      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 4, height: 400, border: `1px solid ${theme.palette.divider}`, borderRadius: 4 }}>
            <Typography variant="h6" fontWeight={700} mb={2.5}>최근 14일 일별 매출</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 290 }}>
                <CircularProgress />
              </Box>
            ) : dailySales.every((d) => d.revenue === 0) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 290 }}>
                <Typography color="text.secondary">최근 14일 매출 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <ReactEChart option={dailyChartOption} echarts={echarts} sx={{ height: 310 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 4, height: 400, border: `1px solid ${theme.palette.divider}`, borderRadius: 4 }}>
            <Typography variant="h6" fontWeight={700} mb={2.5}>메뉴별 매출 비중</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 290 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ReactEChart option={menuPieOption} echarts={echarts} sx={{ height: 310 }} />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

// ─────────────────────────────────────────────
// 전체 네트워크 뷰
// ─────────────────────────────────────────────
const NetworkStats = () => {
  const theme = useTheme();
  const [stores, setStores] = useState<any[]>([]);
  const [storeWeeklySales, setStoreWeeklySales] = useState<{ name: string; thisWeek: number; prevWeek: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const storeList = await storeService.getAll();
        setStores(storeList ?? []);
        const results = await Promise.allSettled(
          (storeList ?? []).map(async (s: any) => {
            const r = await salesService.getWeeklySummary(s.id).catch(() => ({ thisWeekRevenue: 0, prevWeekRevenue: 0 }));
            return { name: s.storeName, thisWeek: r.thisWeekRevenue ?? 0, prevWeek: r.prevWeekRevenue ?? 0 };
          })
        );
        const data = results
          .filter((r) => r.status === 'fulfilled')
          .map((r: any) => r.value)
          .filter((d) => d.thisWeek > 0 || d.prevWeek > 0);
        setStoreWeeklySales(data);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalThisWeek = storeWeeklySales.reduce((s, v) => s + v.thisWeek, 0);
  const totalPrevWeek = storeWeeklySales.reduce((s, v) => s + v.prevWeek, 0);
  const weekChange = totalPrevWeek > 0 ? Math.round((totalThisWeek - totalPrevWeek) / totalPrevWeek * 1000) / 10 : 0;

  const trendChartOption = {
    color: [theme.palette.primary.main, theme.palette.secondary.main],
    tooltip: { trigger: 'axis', formatter: (p: any) => p.map((s: any) => `${s.seriesName}: ₩${s.value.toLocaleString()}`).join('<br/>') },
    legend: { data: ['이번 주 매출', '지난 주 매출'], bottom: 0 },
    grid: { top: '8%', left: '3%', right: '4%', bottom: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      data: storeWeeklySales.map((s) => s.name.length > 5 ? s.name.slice(0, 5) + '..' : s.name),
      axisLabel: { color: theme.palette.text.secondary, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => v >= 10000 ? `${Math.round(v / 10000)}만` : String(v) },
    },
    series: [
      {
        name: '이번 주 매출', type: 'bar', data: storeWeeklySales.map((s) => s.thisWeek),
        itemStyle: { color: theme.palette.primary.main, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40,
      },
      {
        name: '지난 주 매출', type: 'bar', data: storeWeeklySales.map((s) => s.prevWeek),
        itemStyle: { color: theme.palette.secondary.main, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40,
      },
    ],
  };

  const pieData = storeWeeklySales.filter((s) => s.thisWeek > 0).map((s) => ({ value: s.thisWeek, name: s.name }));
  const storeShareOption = {
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>₩${p.value.toLocaleString()} (${p.percent}%)` },
    series: [{
      name: '가맹점별 매출', type: 'pie', radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: pieData.length > 0 ? pieData : [{ value: 1, name: '데이터 없음' }],
    }],
  };

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>전체 네트워크 매출 통계</Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>전체 가맹점</Typography>
            <Typography variant="h3" fontWeight={800} color="primary.main">{stores.length}개</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>이번 주 네트워크 매출</Typography>
            {loading ? <CircularProgress size={28} /> : (
              <Typography variant="h3" fontWeight={800} color="secondary.main">₩{totalThisWeek.toLocaleString()}</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>전주 대비 매출 변화</Typography>
            {loading ? <CircularProgress size={28} /> : (
              <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
                <Typography variant="h3" fontWeight={800} color={weekChange >= 0 ? 'success.main' : 'error.main'}>
                  {weekChange >= 0 ? '+' : ''}{weekChange}%
                </Typography>
                <Chip label={weekChange >= 0 ? '성장' : '감소'} color={weekChange >= 0 ? 'success' : 'error'} size="small" />
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Typography variant="h6" fontWeight={700} mb={3}>가맹점별 이번주 vs 지난주 매출 비교</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                <CircularProgress />
              </Box>
            ) : storeWeeklySales.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                <Typography color="text.secondary">최근 2주 매출 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <ReactEChart option={trendChartOption} echarts={echarts} sx={{ height: 350 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
            <Typography variant="h6" fontWeight={700} mb={3}>가맹점별 매출 비중</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                <CircularProgress />
              </Box>
            ) : (
              <ReactEChart option={storeShareOption} echarts={echarts} sx={{ height: 350 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 4, border: `1px solid ${theme.palette.primary.main}30`, bgcolor: 'primary.light', borderRadius: 4 }}>
            <Stack direction="row" alignItems="center" gap={2}>
              <Typography variant="h5" color="primary.dark" fontWeight={800}>AI 기반 운영 효과:</Typography>
              <Typography variant="body1" color="primary.dark" fontWeight={500}>
                AI 수요 예측을 통해 각 가맹점의 식자재 발주가 최적화되어 폐기율 감소 및 수익성 향상에 기여하고 있습니다.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

// ─────────────────────────────────────────────
// 라우트 진입점 — URL 파라미터로 모드 분기
// ─────────────────────────────────────────────
const Stats = () => {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('storeId');
  const storeName = searchParams.get('storeName') ?? '가맹점';

  if (storeId) {
    return <SingleStoreStats storeId={Number(storeId)} storeName={storeName} />;
  }
  return <NetworkStats />;
};

export default Stats;
