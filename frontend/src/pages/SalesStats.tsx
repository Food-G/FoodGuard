import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Paper, Stack, Chip, CircularProgress, Alert, useTheme } from '@mui/material';
import * as echarts from 'echarts';
import ReactEChart from '../components/base/ReactEChart';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import { localDate } from '../helpers/date';

interface SaleRow {
  id: number;
  saleDate: string;
  menuName: string;
  quantity: number;
  totalPrice: number;
}

interface DaySummary {
  date: string;
  total: number;
  count: number;
  items: SaleRow[];
}

type Period = 'today' | 'week' | 'month' | 'quarter';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today',   label: '오늘' },
  { value: 'week',    label: '7일' },
  { value: 'month',   label: '1개월' },
  { value: 'quarter', label: '3개월' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 로컬 날짜 기준 (UTC 로 자르면 한국 오전 9시 전에는 전날이 된다)
const getDateRange = (period: Period): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  if (period === 'week')         start.setDate(end.getDate() - 6);
  else if (period === 'month')   start.setMonth(end.getMonth() - 1);
  else if (period === 'quarter') start.setMonth(end.getMonth() - 3);
  return { start: localDate(start), end: localDate(end) };
};

const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};

const SalesStats = ({ user }: { user: any }) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [period, setPeriod] = useState<Period>('today');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores: any[]) => { if (stores?.length) setStoreId(stores[0].id); else setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const fetchSales = useCallback(async (p: Period) => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    const { start, end } = getDateRange(p);
    try {
      const data = await salesService.getByDateRange(storeId, start, end);
      // 판매 응답의 menu 는 직렬화되지 않고 menuName·menuPrice·unitPrice(할인 판매가)로 온다
      setSales((data ?? []).map((item: any) => ({
        id: item.id,
        saleDate: item.saleDate,
        menuName: item.menuName ?? '-',
        quantity: item.quantity,
        totalPrice: (item.unitPrice ?? item.menuPrice ?? 0) * item.quantity,
      })));
    } catch {
      setError('판매 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { if (storeId) fetchSales(period); }, [storeId]);

  const handlePeriod = (p: Period) => {
    setPeriod(p);
    setExpanded(null);
    fetchSales(p);
  };

  const daySummaries: DaySummary[] = Object.values(
    sales.reduce<Record<string, DaySummary>>((acc, row) => {
      if (!acc[row.saleDate]) acc[row.saleDate] = { date: row.saleDate, total: 0, count: 0, items: [] };
      acc[row.saleDate].total += row.totalPrice;
      acc[row.saleDate].count += row.quantity;
      acc[row.saleDate].items.push(row);
      return acc;
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date));

  const grandTotal = daySummaries.reduce((s, d) => s + d.total, 0);
  const grandCount = daySummaries.reduce((s, d) => s + d.count, 0);
  const { start, end } = getDateRange(period);

  // 메뉴별 매출 순위
  const byMenu = Object.values(sales.reduce<Record<string, { name: string; qty: number; total: number }>>((acc, r) => {
    acc[r.menuName] = acc[r.menuName] ?? { name: r.menuName, qty: 0, total: 0 };
    acc[r.menuName].qty += r.quantity;
    acc[r.menuName].total += r.totalPrice;
    return acc;
  }, {})).sort((a, b) => b.total - a.total);

  // 요일별 평균 매출 (Square 'DAY OF WEEK')
  const weekdayTotals = WEEKDAYS.map((_, w) => {
    const days = daySummaries.filter((d) => new Date(`${d.date}T00:00:00`).getDay() === w);
    return days.length ? Math.round(days.reduce((s, d) => s + d.total, 0) / days.length) : 0;
  });

  const ascDays = [...daySummaries].reverse();
  const trendOption = {
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `₩${v.toLocaleString()}` },
    xAxis: {
      type: 'category', data: ascDays.map((d) => `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8))}`), boundaryGap: false,
      axisTick: { show: false }, axisLine: { lineStyle: { color: theme.palette.divider } }, axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: {
      type: 'value', axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => (v >= 10000 ? `${v / 10000}만` : v) },
      splitLine: { lineStyle: { color: theme.palette.divider } },
    },
    series: [{
      type: 'line', data: ascDays.map((d) => d.total), smooth: true, symbol: 'circle', symbolSize: 6,
      lineStyle: { width: 2.5, color: theme.palette.primary.main },
      itemStyle: { color: theme.palette.primary.main },
      areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(31,77,58,0.18)' }, { offset: 1, color: 'rgba(31,77,58,0)' },
      ]) },
    }],
  };
  const best = Math.max(...weekdayTotals);
  const weekdayOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `₩${v.toLocaleString()}` },
    xAxis: { type: 'category', data: WEEKDAYS, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: theme.palette.text.secondary } },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', barWidth: '50%',
      data: weekdayTotals.map((v) => ({ value: v, itemStyle: { color: v === best && v > 0 ? theme.palette.primary.main : theme.palette.divider, borderRadius: 6 } })),
    }],
  };

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  return (
    <Stack gap={5}>
      {/* 기간 선택 + 큰 숫자 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>매출 · {start === end ? start : `${start} ~ ${end}`}</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `₩${grandTotal.toLocaleString()}`}
          </Typography>
          {!loading && (
            <Typography fontSize={15} color="text.secondary" mt={1}>
              판매 {grandCount.toLocaleString()}개 · 영업 {daySummaries.length}일
              {daySummaries.length > 1 && ` · 하루 평균 ₩${Math.round(grandTotal / daySummaries.length).toLocaleString()}`}
            </Typography>
          )}
        </Box>
        <Stack direction="row" gap={1} sx={{ bgcolor: 'background.paper', p: 1, borderRadius: 999 }}>
          {PERIODS.map((p) => (
            <Chip
              key={p.value} label={p.label} onClick={() => handlePeriod(p.value)}
              sx={{
                height: 34, borderRadius: 999, border: 'none', px: 1, fontWeight: period === p.value ? 700 : 500,
                bgcolor: period === p.value ? 'text.primary' : 'transparent',
                color: period === p.value ? 'common.white' : 'text.secondary',
                '&:hover': { bgcolor: period === p.value ? 'text.primary' : 'background.default' },
                '& .MuiChip-label': { fontSize: 14 },
              }}
            />
          ))}
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Stack alignItems="center" py={10}><CircularProgress /></Stack>
      ) : daySummaries.length === 0 ? (
        <Paper sx={{ p: 8, alignItems: 'center' }}>
          <IconifyIcon icon="mingcute:chart-bar-line" width={48} color={theme.palette.text.disabled} />
          <Typography color="text.secondary" mt={2} fontWeight={600}>선택한 기간에 판매 내역이 없습니다.</Typography>
        </Paper>
      ) : (
        <>
          {daySummaries.length > 1 && (
            <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 2fr) minmax(0, 1fr)' } }}>
              <Paper sx={{ p: 5 }}>
                <Typography fontSize={18} fontWeight={700} mb={2}>일별 매출 추이</Typography>
                <ReactEChart echarts={echarts} option={trendOption} sx={{ height: 260 }} />
              </Paper>
              <Paper sx={{ p: 5 }}>
                <Typography fontSize={18} fontWeight={700} mb={2}>요일별 평균 매출</Typography>
                <ReactEChart echarts={echarts} option={weekdayOption} sx={{ height: 260 }} />
              </Paper>
            </Box>
          )}

          <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
            {/* 메뉴별 매출 순위 */}
            <Paper sx={{ p: 5 }}>
              <Typography fontSize={18} fontWeight={700} mb={2}>메뉴별 매출</Typography>
              {byMenu.map((m, i) => (
                <Box key={m.name} sx={{ py: 2.5, ...rowSx }}>
                  <Stack direction="row" alignItems="center" gap={2}>
                    <Typography fontWeight={700} fontSize={15} color="text.secondary" sx={{ width: 20 }}>{i + 1}</Typography>
                    <Typography fontWeight={600} fontSize={15} sx={{ flex: 1, minWidth: 0 }} noWrap>{m.name}</Typography>
                    <Typography fontSize={14} color="text.secondary">{m.qty.toLocaleString()}개</Typography>
                    <Typography fontWeight={700} fontSize={15} sx={{ minWidth: 100, textAlign: 'right' }}>₩{m.total.toLocaleString()}</Typography>
                  </Stack>
                  <Box sx={{ ml: 5.5, mt: 1, height: 4, borderRadius: 2, bgcolor: 'background.default' }}>
                    <Box sx={{ height: '100%', borderRadius: 2, bgcolor: i === 0 ? 'primary.main' : 'text.disabled', width: `${grandTotal ? (m.total / grandTotal) * 100 : 0}%` }} />
                  </Box>
                </Box>
              ))}
            </Paper>

            {/* 날짜별 상세 (누르면 펼침) */}
            <Paper sx={{ p: 5 }}>
              <Typography fontSize={18} fontWeight={700} mb={2}>날짜별 상세</Typography>
              {daySummaries.map((day) => (
                <Box key={day.date} sx={rowSx}>
                  <Stack
                    direction="row" alignItems="center" gap={2} sx={{ py: 2.5, cursor: 'pointer' }}
                    onClick={() => setExpanded(expanded === day.date ? null : day.date)}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600} fontSize={15}>{dateLabel(day.date)}</Typography>
                      <Typography variant="body2" color="text.secondary">{day.items.length}종 · {day.count.toLocaleString()}개</Typography>
                    </Box>
                    <Typography fontWeight={700} fontSize={15}>₩{day.total.toLocaleString()}</Typography>
                    <IconifyIcon icon={expanded === day.date ? 'mingcute:up-line' : 'mingcute:down-line'} color={theme.palette.text.disabled} width={18} />
                  </Stack>
                  {expanded === day.date && (
                    <Box sx={{ bgcolor: 'background.default', borderRadius: 3, px: 3, py: 1.5, mb: 2.5 }}>
                      {day.items.map((item) => (
                        <Stack key={item.id} direction="row" gap={2} sx={{ py: 1 }}>
                          <Typography fontSize={14} sx={{ flex: 1, minWidth: 0 }} noWrap>{item.menuName}</Typography>
                          <Typography fontSize={14} color="text.secondary">{item.quantity}개</Typography>
                          <Typography fontSize={14} fontWeight={600} sx={{ minWidth: 90, textAlign: 'right' }}>₩{item.totalPrice.toLocaleString()}</Typography>
                        </Stack>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        </>
      )}
    </Stack>
  );
};

export default SalesStats;
