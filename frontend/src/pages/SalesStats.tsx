import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Stack, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, Divider, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useNavigate } from 'react-router-dom';

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

const SalesStats = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<'7' | '30' | '90' | 'custom'>('7');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const applyPeriod = useCallback((p: string) => {
    const end = new Date();
    const start = new Date();
    if (p === '7') start.setDate(end.getDate() - 6);
    else if (p === '30') start.setDate(end.getDate() - 29);
    else if (p === '90') start.setDate(end.getDate() - 89);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const fetchSales = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await salesService.getByDateRange(storeId, startDate, endDate);
      setSales(
        (data ?? []).map((item: any) => ({
          id: item.id,
          saleDate: item.saleDate,
          menuName: item.menu?.menuName ?? '-',
          quantity: item.quantity,
          totalPrice: item.menu ? item.menu.price * item.quantity : item.totalPrice ?? 0,
        }))
      );
    } catch {
      setError('판매 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [storeId, startDate, endDate]);

  useEffect(() => {
    if (storeId) fetchSales();
  }, [storeId, fetchSales]);

  // Group by date
  const daySummaries: DaySummary[] = Object.values(
    sales.reduce<Record<string, DaySummary>>((acc, row) => {
      if (!acc[row.saleDate]) {
        acc[row.saleDate] = { date: row.saleDate, total: 0, count: 0, items: [] };
      }
      acc[row.saleDate].total += row.totalPrice;
      acc[row.saleDate].count += row.quantity;
      acc[row.saleDate].items.push(row);
      return acc;
    }, {})
  ).sort((a, b) => b.date.localeCompare(a.date));

  const grandTotal = daySummaries.reduce((s, d) => s + d.total, 0);
  const grandCount = daySummaries.reduce((s, d) => s + d.count, 0);

  const handlePeriodChange = (_: any, val: '7' | '30' | '90' | 'custom') => {
    if (!val) return;
    setPeriod(val);
    if (val !== 'custom') applyPeriod(val);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
        <Button
          startIcon={<IconifyIcon icon="mingcute:arrow-left-line" />}
          onClick={() => navigate('/pos')}
          sx={{ borderRadius: 2 }}
        >
          POS로 돌아가기
        </Button>
      </Stack>

      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>날짜별 매출</Typography>
          <Typography variant="body2" color="text.secondary">기간별 판매 실적을 확인하세요</Typography>
        </Box>
        {/* Summary chips */}
        <Stack direction="row" gap={1.5} flexWrap="wrap">
          <Paper sx={{ px: 2, py: 1.5, borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">총 매출</Typography>
            <Typography variant="h6" fontWeight={800} color="primary.main">{grandTotal.toLocaleString()}원</Typography>
          </Paper>
          <Paper sx={{ px: 2, py: 1.5, borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">총 판매</Typography>
            <Typography variant="h6" fontWeight={800}>{grandCount}건</Typography>
          </Paper>
          <Paper sx={{ px: 2, py: 1.5, borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">조회 일수</Typography>
            <Typography variant="h6" fontWeight={800}>{daySummaries.length}일</Typography>
          </Paper>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Filter */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={handlePeriodChange}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 2, borderRadius: '8px !important' } }}
          >
            <ToggleButton value="7">최근 7일</ToggleButton>
            <ToggleButton value="30">최근 30일</ToggleButton>
            <ToggleButton value="90">최근 90일</ToggleButton>
            <ToggleButton value="custom">직접 설정</ToggleButton>
          </ToggleButtonGroup>

          {period === 'custom' && (
            <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
              <TextField
                type="date"
                label="시작일"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <Typography>~</Typography>
              <TextField
                type="date"
                label="종료일"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                size="small"
                InputLabelProps={{ shrink: true }}
              />
              <Button variant="contained" size="small" onClick={fetchSales} sx={{ borderRadius: 2 }}>
                조회
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : daySummaries.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <IconifyIcon icon="mingcute:calendar-line" width={48} color="text.disabled" />
          <Typography color="text.secondary" mt={2}>선택한 기간에 판매 내역이 없습니다.</Typography>
        </Paper>
      ) : (
        <Stack gap={2}>
          {daySummaries.map(day => (
            <Paper key={day.date} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {/* Day Header */}
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                px={2.5}
                py={1.75}
                onClick={() => setExpanded(expanded === day.date ? null : day.date)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Stack direction="row" alignItems="center" gap={2}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      flexShrink: 0,
                    }}
                  />
                  <Typography fontWeight={700} variant="body1">{day.date}</Typography>
                  <Chip label={`${day.items.length}종 · ${day.count}건`} size="small" variant="outlined" />
                </Stack>
                <Stack direction="row" alignItems="center" gap={2}>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {day.total.toLocaleString()}원
                  </Typography>
                  <IconifyIcon
                    icon={expanded === day.date ? 'mingcute:up-line' : 'mingcute:down-line'}
                    color="text.secondary"
                    width={18}
                  />
                </Stack>
              </Stack>

              {/* Detail */}
              {expanded === day.date && (
                <>
                  <Divider />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>메뉴명</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>수량</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>금액</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {day.items.map(item => (
                          <TableRow key={item.id} hover>
                            <TableCell>{item.menuName}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main' }}>
                              {item.totalPrice.toLocaleString()}원
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: 'primary.50' }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 800 }}>일 합계</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '1rem' }}>
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
