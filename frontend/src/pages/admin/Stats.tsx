import { useEffect, useState } from 'react';
import { Button, Typography, Paper, Grid, Stack, useTheme, CircularProgress } from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';
import { statsService, HqStats } from '../../services/statsService';
import WeeklyReportDialog from '../../components/agent/WeeklyReportDialog';

const PIE_COLORS = ['#1D9E75', '#3B6D11', '#43A047', '#81C784', '#C8E6C9'];
// 계획서 정량 목표: 점주 80% 이상이 AI 추천을 그대로 활용
const ADOPTION_TARGET = 80;

const Stats = () => {
  const theme = useTheme();
  const [stats, setStats] = useState<HqStats | null>(null);
  const [error, setError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    statsService.hq().then(setStats).catch(() => setError(true));
  }, []);

  if (error) {
    return <Typography color="error">통계를 불러오지 못했습니다.</Typography>;
  }
  if (!stats) {
    return <Stack alignItems="center" py={10}><CircularProgress /></Stack>;
  }

  const wasteTrendOption = {
    color: [theme.palette.primary.main, theme.palette.error.main],
    tooltip: { trigger: 'axis' },
    legend: { data: ['전체 매출', '폐기 기록 건수'], bottom: 0 },
    xAxis: { type: 'category', data: stats.monthly.map((m) => m.month) },
    yAxis: [
      { type: 'value', axisLabel: { formatter: (v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)) } },
      { type: 'value', minInterval: 1 },
    ],
    series: [
      {
        name: '전체 매출',
        type: 'bar',
        data: stats.monthly.map((m) => m.revenue),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.palette.primary.main },
            { offset: 1, color: theme.palette.primary.light }
          ])
        }
      },
      {
        name: '폐기 기록 건수',
        type: 'line',
        yAxisIndex: 1,
        data: stats.monthly.map((m) => m.wasteCount),
        smooth: true,
        lineStyle: { width: 4 }
      }
    ]
  };

  const wasteStores = stats.stores.filter((s) => s.wasteCount > 0);

  const storeWasteOption = {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const s = wasteStores[p.dataIndex];
        return `${s.storeName}<br/>폐기 기록 ${s.wasteCount}건` + (s.wasteRate != null ? `<br/>입고 대비 폐기율 ${s.wasteRate}%` : '')
          + (s.donationCount > 0 ? `<br/>기부 완료 ${s.donationCount}건` : '');
      },
    },
    series: [
      {
        name: '가맹점별 폐기 비중',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: wasteStores.map((s, i) => ({
          value: s.wasteCount,
          name: s.storeName,
          itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
        })),
      }
    ]  };

  const rec = stats.recommendation;

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={() => setReportOpen(true)}>AI 주간 리포트</Button>
      </Stack>
      <WeeklyReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />
      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={700} mb={3}>네트워크 통합 매출 vs 폐기 기록 추이</Typography>
            <ReactEChart option={wasteTrendOption} echarts={echarts} sx={{ height: 350 }} />
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={700} mb={3}>가맹점별 폐기 기록 비중</Typography>
            {wasteStores.length > 0
              ? <ReactEChart option={storeWasteOption} echarts={echarts} sx={{ height: 350 }} />
              : <Typography color="text.secondary">아직 폐기 기록이 없습니다. 재고 화면의 "폐기" 버튼으로 기록됩니다.</Typography>}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 4, border: `1px solid ${theme.palette.primary.main}30`, bgcolor: 'primary.light', borderRadius: 4 }}>
             <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                <Typography variant="h5" color="primary.dark" fontWeight={800}>🤖 AI 추천 적용률:</Typography>
                <Typography variant="body1" color="primary.dark" fontWeight={500}>
                  {rec.adoptionRate == null ? (
                    '아직 추천 기록이 있는 발주가 없습니다.'
                  ) : (
                    <>
                      기록된 발주 {rec.totalOrders}건 중 <b>{rec.autoOrders}건({rec.adoptionRate}%)</b>이 AI 추천 그대로 자동 발주됐습니다
                      (목표 {ADOPTION_TARGET}%).
                      {rec.manualAvgChangePct != null && (
                        <> 점주 직접 발주 {rec.manualWithRecommendation}건은 추천량보다 평균 <b>{rec.manualAvgChangePct > 0 ? '+' : ''}{rec.manualAvgChangePct}%</b> 수정됐습니다.</>
                      )}
                      {rec.manualWithoutRecommendation > 0 && <> 추천에 없던 식자재 발주 {rec.manualWithoutRecommendation}건.</>}
                    </>
                  )}
                </Typography>
             </Stack>
             <Typography variant="body2" color="primary.dark" mt={1}>
               {stats.forecastAccuracy?.wmape == null
                 ? '📈 운영 예측 정확도: 예측한 날의 판매가 입력되면 실제 오차를 보여 줍니다.'
                 : <>📈 운영 예측 정확도: 메뉴×일 {stats.forecastAccuracy.evaluatedDays}건 오차율 <b>{stats.forecastAccuracy.wmape}%</b>
                     {stats.forecastAccuracy.weeklyWithin10Pct != null && <>, 메뉴 주간 판매량 ±10% 이내 <b>{stats.forecastAccuracy.weeklyWithin10Pct}%</b> ({stats.forecastAccuracy.menuWeeks}개)</>}</>}
             </Typography>
             <Typography variant="body2" color="primary.dark" mt={1}>
               {stats.donationCount > 0
                 ? <>💚 기부 완료 {stats.donationCount}건 — 폐기될 뻔한 식자재를 이웃에게 전달했습니다.</>
                 : '💚 아직 기부 완료 기록이 없습니다. 폐기 예측 화면에서 기부를 등록할 수 있습니다.'}
             </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Stats;
