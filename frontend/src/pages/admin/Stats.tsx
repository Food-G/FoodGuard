import { useEffect, useState } from 'react';
import { Box, Button, Typography, Paper, Stack, useTheme, CircularProgress } from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';
import IconifyIcon from '../../components/base/IconifyIcon';
import { statsService, HqStats } from '../../services/statsService';
import WeeklyReportDialog from '../../components/agent/WeeklyReportDialog';

// 계획서 정량 목표: 점주 80% 이상이 AI 추천을 그대로 활용
const ADOPTION_TARGET = 80;

// 작은 회색 라벨 + 큰 숫자 + 설명 (Square 카드)
const StatCard = ({ label, value, unit, sub, children }: { label: string; value: string; unit?: string; sub?: React.ReactNode; children?: React.ReactNode }) => (
  <Paper sx={{ p: 5 }}>
    <Typography variant="body2" color="text.secondary" mb={1.5}>{label}</Typography>
    <Typography fontSize={26} fontWeight={700} lineHeight={1.2}>
      {value}{unit && <Box component="span" fontSize={16} fontWeight={600} color="text.secondary" ml={0.5}>{unit}</Box>}
    </Typography>
    {children}
    {sub && <Typography variant="body2" color="text.secondary" mt={1.5} lineHeight={1.6}>{sub}</Typography>}
  </Paper>
);

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

  const months = stats.monthly;
  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const change = last && prev && prev.revenue > 0 ? Math.round(((last.revenue - prev.revenue) / prev.revenue) * 100) : null;

  const trendOption = {
    grid: { left: 8, right: 8, top: 32, bottom: 32, containLabel: true },
    tooltip: { trigger: 'axis' },
    legend: { data: ['매출', '폐기 기록'], bottom: 0, icon: 'circle', textStyle: { color: theme.palette.text.secondary } },
    xAxis: {
      type: 'category', data: months.map((m) => m.month),
      axisTick: { show: false }, axisLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: [
      { type: 'value', axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => (v >= 10000 ? `${Math.round(v / 10000)}만` : String(v)) }, splitLine: { lineStyle: { color: theme.palette.divider } } },
      { type: 'value', minInterval: 1, axisLabel: { color: theme.palette.text.secondary }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '매출', type: 'bar', barWidth: '42%', color: theme.palette.primary.main,
        data: months.map((m, i) => ({ value: m.revenue, itemStyle: { color: i === months.length - 1 ? theme.palette.primary.main : theme.palette.divider, borderRadius: [6, 6, 0, 0] } })),
      },
      {
        name: '폐기 기록', type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 6,
        data: months.map((m) => m.wasteCount),
        lineStyle: { width: 2.5, color: theme.palette.warning.main }, itemStyle: { color: theme.palette.warning.main },
      },
    ],
  };

  const wasteStores = [...stats.stores].filter((s) => s.wasteCount > 0).sort((a, b) => b.wasteCount - a.wasteCount);
  const maxWaste = Math.max(1, ...wasteStores.map((s) => s.wasteCount));
  const rec = stats.recommendation;
  const acc = stats.forecastAccuracy;
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  return (
    <Stack gap={5}>
      {/* 이번 달 매출 + 주간 리포트 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>{last ? `${last.month} 전체 가맹점 매출` : '전체 가맹점 매출'}</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            ₩{(last?.revenue ?? 0).toLocaleString()}
          </Typography>
          {change != null && (
            <Typography fontSize={15} mt={1} sx={{ color: change >= 0 ? theme.palette.success.main : theme.palette.error.main }}>
              지난달보다 {Math.abs(change)}% {change >= 0 ? '늘었어요' : '줄었어요'}
            </Typography>
          )}
        </Box>
        <Button startIcon={<IconifyIcon icon="mingcute:sparkles-line" />} onClick={() => setReportOpen(true)}>AI 주간 리포트</Button>
      </Stack>
      <WeeklyReportDialog open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* 핵심 지표 */}
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' } }}>
        <StatCard
          label="AI 추천 적용률" value={rec.adoptionRate == null ? '-' : String(rec.adoptionRate)} unit={rec.adoptionRate == null ? undefined : '%'}
          sub={rec.adoptionRate == null ? '아직 추천 기록이 있는 발주가 없습니다.'
            : <>발주 {rec.totalOrders}건 중 {rec.autoOrders}건이 추천 그대로 (목표 {ADOPTION_TARGET}%)
              {rec.manualAvgChangePct != null && <><br />직접 발주 {rec.manualWithRecommendation}건은 추천량보다 평균 {rec.manualAvgChangePct > 0 ? '+' : ''}{rec.manualAvgChangePct}%</>}
              {rec.manualWithoutRecommendation > 0 && <><br />추천에 없던 식자재 발주 {rec.manualWithoutRecommendation}건</>}</>}
        >
          {rec.adoptionRate != null && (
            <Box sx={{ position: 'relative', mt: 2, height: 6, borderRadius: 3, bgcolor: 'background.default' }}>
              <Box sx={{ height: '100%', borderRadius: 3, width: `${Math.min(100, rec.adoptionRate)}%`, bgcolor: rec.adoptionRate >= ADOPTION_TARGET ? 'success.main' : 'primary.main' }} />
              <Box sx={{ position: 'absolute', top: -3, left: `${ADOPTION_TARGET}%`, width: 2, height: 12, bgcolor: 'text.secondary' }} />
            </Box>
          )}
        </StatCard>
        <StatCard
          label="운영 예측 오차율" value={acc?.wmape == null ? '-' : String(acc.wmape)} unit={acc?.wmape == null ? undefined : '%'}
          sub={acc?.wmape == null ? '예측한 날의 판매가 입력되면 실제 오차를 보여 줍니다.'
            : <>메뉴×일 {acc.evaluatedDays}건 기준{acc.weeklyWithin10Pct != null && <><br />주간 판매량 ±10% 이내 {acc.weeklyWithin10Pct}% ({acc.menuWeeks}개)</>}</>}
        />
        <StatCard
          label="임박 식자재 할인 판매" value={(stats.discountSales?.quantity ?? 0).toLocaleString()} unit="개"
          sub={stats.discountSales?.quantity > 0
            ? <>매출 ₩{stats.discountSales.revenue.toLocaleString()} · 할인액 ₩{stats.discountSales.discountAmount.toLocaleString()}</>
            : '아직 할인 판매 기록이 없습니다.'}
        />
        <StatCard
          label="기부 완료" value={String(stats.donationCount)} unit="건"
          sub={stats.donationCount > 0 ? '폐기될 뻔한 식자재를 이웃에게 전달했어요.' : '폐기 예측 화면에서 기부를 등록할 수 있어요.'}
        />
      </Box>

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 2fr)' }, alignItems: 'start' }}>
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>월별 매출과 폐기 기록</Typography>
          <ReactEChart option={trendOption} echarts={echarts} sx={{ height: 320 }} />
        </Paper>

        {/* 가맹점별 폐기 (순위 목록) */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>가맹점별 폐기 기록</Typography>
          {wasteStores.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4 }}>아직 폐기 기록이 없습니다. 재고 화면의 "폐기" 버튼으로 기록됩니다.</Typography>
          ) : wasteStores.map((s, i) => (
            <Box key={s.storeId} sx={{ py: 2.5, ...rowSx }}>
              <Stack direction="row" alignItems="center" gap={2}>
                <Typography fontWeight={700} fontSize={15} color="text.secondary" sx={{ width: 20 }}>{i + 1}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap>{s.storeName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {s.wasteRate != null ? `입고 대비 폐기율 ${s.wasteRate}%` : '폐기율 계산 전'}{s.donationCount > 0 && ` · 기부 ${s.donationCount}건`}
                  </Typography>
                </Box>
                <Typography fontWeight={700} fontSize={15}>{s.wasteCount}건</Typography>
              </Stack>
              <Box sx={{ ml: 5.5, mt: 1, height: 4, borderRadius: 2, bgcolor: 'background.default' }}>
                <Box sx={{ height: '100%', borderRadius: 2, bgcolor: i === 0 ? 'warning.main' : 'text.disabled', width: `${(s.wasteCount / maxWaste) * 100}%` }} />
              </Box>
            </Box>
          ))}
        </Paper>
      </Box>
    </Stack>
  );
};

export default Stats;
