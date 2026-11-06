import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, Divider,
} from '@mui/material';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

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

const PERIODS: { value: Period; label: string; icon: string }[] = [
  { value: 'today',   label: '금일',   icon: 'mingcute:sun-line' },
  { value: 'week',    label: '일주일', icon: 'mingcute:calendar-week-line' },
  { value: 'month',   label: '한달',   icon: 'mingcute:calendar-month-line' },
  { value: 'quarter', label: '분기',   icon: 'mingcute:calendar-2-line' },
];

const getDateRange = (period: Period): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  if (period === 'today')   { /* start = end = today */ }
  else if (period === 'week')    start.setDate(end.getDate() - 6);
  else if (period === 'month')   start.setMonth(end.getMonth() - 1);
  else if (period === 'quarter') start.setMonth(end.getMonth() - 3);
  return {
    start: start.toISOString().split('T')[0],
    end:   end.toISOString().split('T')[0],
  };
};

const SalesStats = ({ user }: { user: any }) => {
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
      setSales((data ?? []).map((item: any) => ({
        id: item.id,
        saleDate: item.saleDate,
        menuName: item.menu?.menuName ?? '-',
        quantity: item.quantity,
        totalPrice: item.menu ? item.menu.price * item.quantity : item.totalPrice ?? 0,
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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconifyIcon icon="mingcute:chart-bar-fill" width={22} height={22} color="#FF9800" />
        </Box>
        <Box>
          <Typography fontWeight={800} fontSize={20} color="#1A1C1E">매출 통계</Typography>
          <Typography fontSize={12} color="#44474E">기간별 판매 실적을 확인하세요</Typography>
        </Box>
      </Box>

      {/* 기간 선택 탭 */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        {PERIODS.map((p) => {
          const active = period === p.value;
          return (
            <Button
              key={p.value}
              onClick={() => handlePeriod(p.value)}
              startIcon={<IconifyIcon icon={p.icon} width={16} height={16} color={active ? '#fff' : '#44474E'} />}
              sx={{
                borderRadius: 99,
                px: 2.5,
                py: 0.8,
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'none',
                bgcolor: active ? '#FF9800' : '#F4F6F8',
                color: active ? '#fff' : '#44474E',
                border: '1px solid',
                borderColor: active ? '#FF9800' : '#E8EAF0',
                boxShadow: active ? '0 4px 12px rgba(255,152,0,0.35)' : 'none',
                '&:hover': { bgcolor: active ? '#FB8C00' : '#EAECEF' },
              }}
            >
              {p.label}
            </Button>
          );
        })}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* 요약 카드 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: '총 매출', value: `${grandTotal.toLocaleString()}원`, icon: 'mingcute:currency-won-line', color: '#FF9800' },
          { label: '총 판매 건수', value: `${grandCount}건`, icon: 'mingcute:shopping-bag-line', color: '#1976D2' },
          { label: '영업일', value: `${daySummaries.length}일`, icon: 'mingcute:calendar-2-line', color: '#1D9E75' },
        ].map(({ label, value, icon, color }) => (
          <Box key={label} sx={{ flex: 1, minWidth: 140, borderRadius: 3, bgcolor: '#fff', border: '1px solid #E8EAF0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconifyIcon icon={icon} width={22} height={22} color={color} />
            </Box>
            <Box>
              <Typography fontSize={20} fontWeight={800} color="#1A1C1E" lineHeight={1}>{loading ? '-' : value}</Typography>
              <Typography fontSize={12} color="#44474E" fontWeight={500} sx={{ mt: 0.3 }}>{label}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* 조회 기간 표시 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconifyIcon icon="mingcute:calendar-line" width={14} height={14} color="#8E9199" />
        <Typography fontSize={12} color="#8E9199">{start} ~ {end}</Typography>
      </Box>

      {/* 결과 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#FF9800' }} /></Box>
      ) : daySummaries.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px solid #E8EAF0' }}>
          <IconifyIcon icon="mingcute:chart-bar-line" width={48} color="#C4C7CF" />
          <Typography color="#8E9199" mt={2} fontWeight={600}>선택한 기간에 판매 내역이 없습니다.</Typography>
        </Paper>
      ) : (
        <Stack gap={1.5}>
          {daySummaries.map((day) => (
            <Paper key={day.date} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #E8EAF0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Stack
                direction="row" alignItems="center" justifyContent="space-between"
                px={2.5} py={1.75}
                onClick={() => setExpanded(expanded === day.date ? null : day.date)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#FAFBFC' } }}
              >
                <Stack direction="row" alignItems="center" gap={2}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FF9800', flexShrink: 0 }} />
                  <Typography fontWeight={700} fontSize={14} color="#1A1C1E">{day.date}</Typography>
                  <Chip label={`${day.items.length}종 · ${day.count}건`} size="small" variant="outlined" sx={{ fontSize: 11, height: 22 }} />
                </Stack>
                <Stack direction="row" alignItems="center" gap={2}>
                  <Typography fontWeight={800} fontSize={16} color="#FF9800">
                    {day.total.toLocaleString()}원
                  </Typography>
                  <IconifyIcon
                    icon={expanded === day.date ? 'mingcute:up-line' : 'mingcute:down-line'}
                    color="#8E9199" width={16}
                  />
                </Stack>
              </Stack>

              {expanded === day.date && (
                <>
                  <Divider />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#F8F9FA' }}>
                          <TableCell sx={{ fontWeight: 700, fontSize: 12, color: '#44474E' }}>메뉴명</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, fontSize: 12, color: '#44474E' }}>수량</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#44474E' }}>금액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {day.items.map((item) => (
                          <TableRow key={item.id} hover>
                            <TableCell sx={{ fontSize: 13 }}>{item.menuName}</TableCell>
                            <TableCell align="center" sx={{ fontSize: 13 }}>{item.quantity}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: 13, color: '#FF9800' }}>
                              {item.totalPrice.toLocaleString()}원
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: '#FFF8F0' }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800, fontSize: 13 }}>일 합계</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#FF9800', fontSize: 14 }}>
                            {day.total.toLocaleString()}원
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default SalesStats;
