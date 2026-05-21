import { useEffect, useState } from 'react';
import { Typography, Paper, Grid, Stack, useTheme, Box, CircularProgress, Chip } from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../../services/storeService';
import { salesService } from '../../services/salesService';

const Stats = () => {
  const theme = useTheme();
  const [stores, setStores] = useState<any[]>([]);
  const [storeWeeklySales, setStoreWeeklySales] = useState<Array<{ name: string; thisWeek: number; prevWeek: number }>>([]);
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
      axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => v >= 10000 ? `${Math.round(v/10000)}만` : String(v) },
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
    series: [
      {
        name: '가맹점별 매출',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: pieData.length > 0 ? pieData : [{ value: 1, name: '데이터 없음' }],
      },
    ],
  };

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>전체 네트워크 폐기율 및 환경 통계</Typography>
      </Box>

      {/* 요약 카드 */}
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
              <Typography variant="h3" fontWeight={800} color="secondary.main">
                ₩{totalThisWeek.toLocaleString()}
              </Typography>
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
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={700} mb={3}>가맹점별 이번주 vs 지난주 매출 비교</Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                <CircularProgress />
              </Box>
            ) : storeWeeklySales.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320 }}>
                <Typography color="text.secondary">매출 데이터가 없습니다.</Typography>
              </Box>
            ) : (
              <ReactEChart option={trendChartOption} echarts={echarts} sx={{ height: 350 }} />
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
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
                AI 수요 예측을 통해 각 가맹점의 식자재 발주가 최적화되어
                폐기율 감소 및 수익성 향상에 기여하고 있습니다.
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Stats;
