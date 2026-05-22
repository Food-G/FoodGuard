import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Stack, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, CircularProgress, Alert, Divider, ToggleButtonGroup, ToggleButton,
  Tab, Tabs, LinearProgress,
} from '@mui/material';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useNavigate } from 'react-router-dom';

/* ── Types ── */
interface SaleRow {
  id: number;
  saleDate: string;
  createdAt?: string;
  menuName: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
}

interface Group {
  label: string;
  sublabel?: string;
  total: number;
  qty: number;
  items: SaleRow[];
}

/* POS.tsx 가 localStorage 에 저장하는 영수증 구조 */
interface StoredReceipt {
  id: number;
  tableId: string;
  tableName: string;
  date: string;
  time: string;
  items: { menuName: string; qty: number; price: number; total: number }[];
  total: number;
}

interface TableGroup {
  tableName: string;
  receipts: StoredReceipt[];
  grandTotal: number;
}

/* ── Helpers ── */
const isoWeek = (d: Date) => {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diff / (7 * 86400000)) + 1;
};

const weekLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const w = Math.ceil(d.getDate() / 7);
  return `${d.getFullYear()}년 ${m}월 ${w}주차`;
};

const weekKey = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-W${String(isoWeek(d)).padStart(2, '0')}`;
};

const monthKey  = (s: string) => s.slice(0, 7);
const monthLabel = (k: string) => `${k.slice(0, 4)}년 ${parseInt(k.slice(5))}월`;

const quarterKey = (s: string) => {
  const [y, m] = s.split('-').map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
};
const quarterLabel = (k: string) => k.replace('-Q', '년 Q') + '분기';

const hourKey = (row: SaleRow) => {
  if (row.createdAt) {
    const h = new Date(row.createdAt).getHours();
    return String(h).padStart(2, '0');
  }
  return '??';
};

/* ── SalesStats ── */
const SalesStats = ({ user }: { user: any }) => {
  const navigate = useNavigate();
  const [storeId, setStoreId]   = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sales, setSales]       = useState<SaleRow[]>([]);
  const [error, setError]       = useState('');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [period, setPeriod]     = useState<'7'|'30'|'90'|'custom'>('30');

  /* 분석 방식 & 뷰 */
  const [mode, setMode]   = useState<'daily'|'weekly'|'monthly'|'quarterly'|'hourly'>('daily');
  const [view, setView]   = useState<'analysis'|'receipt'>('analysis');
  const [expanded, setExpanded] = useState<string | null>(null);

  /* ── Store init ── */
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  /* ── Fetch ── */
  const fetchSales = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      const data = await salesService.getByDateRange(storeId, startDate, endDate);
      setSales((data ?? []).map((item: any) => {
        const unitPrice = item.menu?.price ?? (item.quantity ? Math.round((item.totalPrice ?? 0) / item.quantity) : 0);
        return {
          id: item.id,
          saleDate: item.saleDate,
          createdAt: item.createdAt ?? null,
          menuName: item.menu?.menuName ?? item.menuName ?? '-',
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
        };
      }));
    } catch {
      setError('판매 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [storeId, startDate, endDate]);

  useEffect(() => { if (storeId) fetchSales(); }, [storeId, fetchSales]);

  /* ── Period buttons ── */
  const applyPeriod = useCallback((p: string) => {
    const end = new Date(); const start = new Date();
    if (p === '7')  start.setDate(end.getDate() - 6);
    else if (p === '30') start.setDate(end.getDate() - 29);
    else if (p === '90') start.setDate(end.getDate() - 89);
    setEndDate(end.toISOString().split('T')[0]);
    setStartDate(start.toISOString().split('T')[0]);
  }, []);

  const handlePeriodChange = (_: any, val: '7'|'30'|'90'|'custom') => {
    if (!val) return;
    setPeriod(val);
    if (val !== 'custom') applyPeriod(val);
  };

  /* ── Group data by mode ── */
  const groups = useMemo((): Group[] => {
    const map: Record<string, Group> = {};

    for (const row of sales) {
      let key: string, label: string, sublabel: string | undefined;

      if (mode === 'daily') {
        key = row.saleDate;
        const d = new Date(key);
        label = `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
        sublabel = ['일','월','화','수','목','금','토'][d.getDay()];
      } else if (mode === 'weekly') {
        key = weekKey(row.saleDate);
        label = weekLabel(row.saleDate);
      } else if (mode === 'monthly') {
        key = monthKey(row.saleDate);
        label = monthLabel(key);
      } else if (mode === 'quarterly') {
        key = quarterKey(row.saleDate);
        label = quarterLabel(key);
      } else {
        // hourly
        key = hourKey(row);
        label = key === '??' ? '시간 미상' : `${key}시`;
      }

      if (!map[key]) map[key] = { label, sublabel, total: 0, qty: 0, items: [] };
      map[key].total += row.totalPrice;
      map[key].qty   += row.quantity;
      map[key].items.push(row);
    }

    return Object.entries(map)
      .sort(([a], [b]) => mode === 'hourly' ? a.localeCompare(b) : b.localeCompare(a))
      .map(([, g]) => g);
  }, [sales, mode]);

  /* ── Totals ── */
  const grandTotal = groups.reduce((s, g) => s + g.total, 0);
  const grandQty   = groups.reduce((s, g) => s + g.qty,   0);
  const maxTotal   = Math.max(...groups.map(g => g.total), 1);

  /* ── Menu popularity (for hourly/analysis) ── */
  const menuRank = useMemo(() => {
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    for (const row of sales) {
      if (!map[row.menuName]) map[row.menuName] = { name: row.menuName, qty: 0, total: 0 };
      map[row.menuName].qty   += row.quantity;
      map[row.menuName].total += row.totalPrice;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [sales]);

  /* ── Table receipts from localStorage ── */
  const tableGroups = useMemo((): TableGroup[] => {
    if (!storeId) return [];
    const raw: StoredReceipt[] = JSON.parse(localStorage.getItem(`pos_receipts_${storeId}`) ?? '[]');

    // filter by selected date range
    const filtered = raw.filter(r => r.date >= startDate && r.date <= endDate);

    // group by tableName
    const map: Record<string, TableGroup> = {};
    for (const r of filtered) {
      if (!map[r.tableName]) map[r.tableName] = { tableName: r.tableName, receipts: [], grandTotal: 0 };
      map[r.tableName].receipts.push(r);
      map[r.tableName].grandTotal += r.total;
    }

    // sort each table's receipts newest first
    return Object.values(map)
      .sort((a, b) => b.grandTotal - a.grandTotal)
      .map(g => ({ ...g, receipts: g.receipts.sort((a, b) => b.id - a.id) }));
  }, [storeId, startDate, endDate, view]); // re-read when view switches to receipt

  /* ─────────────────── Render ─────────────────── */
  return (
    <Box>
      {/* Back */}
      <Button startIcon={<IconifyIcon icon="mingcute:arrow-left-line" />}
        onClick={() => navigate('/pos')} sx={{ borderRadius: 2, mb: 0.5 }}>
        POS로 돌아가기
      </Button>

      {/* Header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>매출 분석</Typography>
          <Typography variant="body2" color="text.secondary">기간 및 분석 방식을 선택해 실적을 확인하세요</Typography>
        </Box>
        <Stack direction="row" gap={1.5} flexWrap="wrap">
          {[
            { label: '총 매출', value: `${grandTotal.toLocaleString()}원`, color: 'primary.main' },
            { label: '총 판매', value: `${grandQty}건` },
            { label: groups.length > 0 ? `${['일','주','월','분기','시간'][['daily','weekly','monthly','quarterly','hourly'].indexOf(mode)]}` : '기간', value: `${groups.length}개` },
          ].map(c => (
            <Paper key={c.label} sx={{ px: 2.5, py: 1.5, borderRadius: 2, textAlign: 'center', minWidth: 100 }}>
              <Typography variant="caption" color="text.secondary" display="block">{c.label}</Typography>
              <Typography variant="h6" fontWeight={800} color={c.color ?? 'text.primary'}>{c.value}</Typography>
            </Paper>
          ))}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Period filter */}
      <Paper sx={{ p: 2.5, borderRadius: 3, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small"
            sx={{ '& .MuiToggleButton-root': { px: 2, borderRadius: '8px !important' } }}>
            <ToggleButton value="7">최근 7일</ToggleButton>
            <ToggleButton value="30">최근 30일</ToggleButton>
            <ToggleButton value="90">최근 90일</ToggleButton>
            <ToggleButton value="custom">직접 설정</ToggleButton>
          </ToggleButtonGroup>
          {period === 'custom' && (
            <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
              <TextField type="date" label="시작일" value={startDate} onChange={e => setStartDate(e.target.value)}
                size="small" InputLabelProps={{ shrink: true }} />
              <Typography>~</Typography>
              <TextField type="date" label="종료일" value={endDate} onChange={e => setEndDate(e.target.value)}
                size="small" InputLabelProps={{ shrink: true }} />
              <Button variant="contained" size="small" onClick={fetchSales} sx={{ borderRadius: 2 }}>조회</Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Mode + View tabs */}
      <Paper sx={{ borderRadius: 3, mb: 3, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          {/* Analysis mode */}
          <Box sx={{ flex: 1, px: 1.5 }}>
            <Tabs value={mode} onChange={(_, v) => { setMode(v); setExpanded(null); }}
              variant="scrollable" scrollButtons="auto"
              sx={{ '& .MuiTab-root': { minWidth: 72, fontSize: 13, fontWeight: 700 } }}>
              <Tab value="daily"     label="일별"   icon={<IconifyIcon icon="mingcute:calendar-day-line" width={16} />} iconPosition="start" />
              <Tab value="weekly"    label="주간"   icon={<IconifyIcon icon="mingcute:calendar-week-line" width={16} />} iconPosition="start" />
              <Tab value="monthly"   label="월간"   icon={<IconifyIcon icon="mingcute:calendar-month-line" width={16} />} iconPosition="start" />
              <Tab value="quarterly" label="분기별" icon={<IconifyIcon icon="mingcute:chart-bar-line" width={16} />} iconPosition="start" />
              <Tab value="hourly"    label="시간별" icon={<IconifyIcon icon="mingcute:time-line" width={16} />} iconPosition="start" />
            </Tabs>
          </Box>
          {/* View mode */}
          <Stack direction="row" alignItems="center" gap={0} px={1.5} sx={{ borderLeft: { sm: '1px solid' }, borderColor: 'divider' }}>
            <Button size="small"
              variant={view === 'analysis' ? 'contained' : 'text'}
              onClick={() => setView('analysis')}
              startIcon={<IconifyIcon icon="mingcute:chart-bar-2-line" width={16} />}
              sx={{ borderRadius: 1.5, mr: 0.5 }}>
              분석
            </Button>
            <Button size="small"
              variant={view === 'receipt' ? 'contained' : 'text'}
              onClick={() => setView('receipt')}
              startIcon={<IconifyIcon icon="mingcute:receipt-line" width={16} />}
              sx={{ borderRadius: 1.5 }}>
              영수증
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : sales.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
          <IconifyIcon icon="mingcute:calendar-line" width={52} color="text.disabled" />
          <Typography color="text.secondary" mt={2}>선택한 기간에 판매 내역이 없습니다.</Typography>
        </Paper>
      ) : view === 'receipt' ? (
        /* ═══════════ 영수증 뷰 — 테이블별 ═══════════ */
        tableGroups.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
            <IconifyIcon icon="mingcute:receipt-line" width={52} color="text.disabled" />
            <Typography color="text.secondary" mt={2}>
              해당 기간에 테이블 결제 내역이 없습니다.
            </Typography>
            <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
              POS에서 결제하면 여기에 테이블별로 기록됩니다.
            </Typography>
          </Paper>
        ) : (
          <Stack gap={4}>
            {tableGroups.map(tg => (
              <Box key={tg.tableName}>
                {/* 테이블 헤더 */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                  <Stack direction="row" alignItems="center" gap={1.5}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 2,
                      bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconifyIcon icon="mingcute:chair-line" sx={{ color: 'white' }} width={22} />
                    </Box>
                    <Box>
                      <Typography variant="h5" fontWeight={900}>{tg.tableName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        총 {tg.receipts.length}건 결제 · 합계 {tg.grandTotal.toLocaleString()}원
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    label={`${tg.grandTotal.toLocaleString()}원`}
                    color="primary" variant="outlined"
                    sx={{ fontWeight: 800, fontSize: 14, px: 1 }}
                  />
                </Stack>

                {/* 해당 테이블의 영수증 카드들 */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
                  {tg.receipts.map((receipt, ri) => (
                    <Paper key={receipt.id} elevation={2} sx={{
                      borderRadius: 3, overflow: 'hidden',
                      border: '1px solid', borderColor: 'divider',
                      fontFamily: '"Courier New", Courier, monospace',
                    }}>
                      {/* 영수증 헤더 */}
                      <Box sx={{ bgcolor: 'grey.900', px: 2.5, py: 1.5, textAlign: 'center' }}>
                        <Typography fontWeight={900} sx={{ color: 'white', letterSpacing: 2, fontSize: 13 }}>
                          ★ FOODGUARD ★
                        </Typography>
                        <Typography sx={{ color: 'grey.400', fontSize: 11 }}>영업 영수증</Typography>
                      </Box>

                      {/* 메타 */}
                      <Box sx={{ px: 2.5, py: 1.25, bgcolor: 'grey.50', borderBottom: '1px dashed', borderColor: 'divider' }}>
                        {[
                          ['테이블',   receipt.tableName],
                          ['결제번호', `#${String(tg.receipts.length - ri).padStart(4, '0')}`],
                          ['날짜',     receipt.date],
                          ['시간',     receipt.time],
                        ].map(([k, v]) => (
                          <Stack key={k} direction="row" justifyContent="space-between">
                            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{k}</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{v}</Typography>
                          </Stack>
                        ))}
                      </Box>

                      {/* 품목 */}
                      <Box sx={{ px: 2.5, py: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" mb={0.75}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled' }}>메뉴명</Typography>
                          <Stack direction="row" gap={2.5}>
                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled' }}>수량</Typography>
                            <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', minWidth: 64, textAlign: 'right' }}>금액</Typography>
                          </Stack>
                        </Stack>
                        <Divider sx={{ mb: 1, borderStyle: 'dashed' }} />

                        {receipt.items.map((item, ii) => (
                          <Stack key={ii} direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                            <Typography sx={{ flex: 1, fontSize: 12, fontWeight: 600 }} noWrap>
                              {item.menuName}
                            </Typography>
                            <Stack direction="row" gap={2.5} flexShrink={0}>
                              <Typography sx={{ fontSize: 12, minWidth: 20, textAlign: 'center' }}>{item.qty}</Typography>
                              <Typography sx={{ fontSize: 12, fontWeight: 700, minWidth: 64, textAlign: 'right' }}>
                                {item.total.toLocaleString()}
                              </Typography>
                            </Stack>
                          </Stack>
                        ))}

                        <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography fontWeight={800} fontSize={13}>합 계</Typography>
                          <Typography fontWeight={900} fontSize={16} color="primary.main">
                            {receipt.total.toLocaleString()}원
                          </Typography>
                        </Stack>
                      </Box>

                      {/* 결제완료 스탬프 */}
                      <Box sx={{ px: 2.5, pb: 2, textAlign: 'center' }}>
                        <Box sx={{
                          display: 'inline-block', px: 1.5, py: 0.4,
                          border: '2px solid', borderColor: 'success.main', borderRadius: 1,
                          transform: 'rotate(-4deg)',
                        }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 900, color: 'success.main', letterSpacing: 3 }}>
                            결제완료
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>

                <Divider sx={{ mt: 3 }} />
              </Box>
            ))}
          </Stack>
        )
      ) : (
        /* ═══════════ 분석 뷰 ═══════════ */
        <Stack gap={2}>
          {/* Top menu ranking */}
          {menuRank.length > 0 && (
            <Paper sx={{ p: 2.5, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" gap={0.75} mb={2}>
                <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: 'warning.main' }} />
                <Typography variant="h6" fontWeight={800}>인기 메뉴 TOP 5</Typography>
              </Stack>
              <Stack gap={1.25}>
                {menuRank.map((m, i) => (
                  <Stack key={m.name} direction="row" alignItems="center" gap={2}>
                    <Box sx={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      bgcolor: i < 3 ? ['warning.main','grey.400','warning.light'][i] : 'grey.200',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'white' }}>{i + 1}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700} sx={{ minWidth: 90 }} noWrap>{m.name}</Typography>
                    <Box flex={1}>
                      <LinearProgress variant="determinate"
                        value={(m.total / (menuRank[0]?.total || 1)) * 100}
                        sx={{ borderRadius: 2, height: 8, bgcolor: 'grey.100',
                          '& .MuiLinearProgress-bar': { bgcolor: i === 0 ? 'primary.main' : 'primary.light', borderRadius: 2 } }} />
                    </Box>
                    <Typography variant="body2" fontWeight={700} color="primary.main" sx={{ minWidth: 80, textAlign: 'right' }}>
                      {m.total.toLocaleString()}원
                    </Typography>
                    <Chip label={`${m.qty}건`} size="small" variant="outlined" sx={{ minWidth: 48 }} />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Period groups */}
          {groups.map((group, gi) => (
            <Paper key={gi} sx={{ borderRadius: 3, overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between"
                px={2.5} py={1.75}
                onClick={() => setExpanded(expanded === group.label ? null : group.label)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                <Stack direction="row" alignItems="center" gap={2} flex={1}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                  <Box>
                    <Typography fontWeight={800} variant="body1">{group.label}</Typography>
                    {group.sublabel && (
                      <Typography variant="caption" color="text.secondary">{group.sublabel}요일</Typography>
                    )}
                  </Box>
                  <Chip label={`${group.items.length}종 · ${group.qty}건`} size="small" variant="outlined" />
                  {/* Bar */}
                  <Box flex={1} sx={{ maxWidth: 160 }}>
                    <LinearProgress variant="determinate"
                      value={(group.total / maxTotal) * 100}
                      sx={{ borderRadius: 2, height: 6, bgcolor: 'grey.100',
                        '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 2 } }} />
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center" gap={2}>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {group.total.toLocaleString()}원
                  </Typography>
                  <IconifyIcon icon={expanded === group.label ? 'mingcute:up-line' : 'mingcute:down-line'}
                    color="text.secondary" width={18} />
                </Stack>
              </Stack>

              {expanded === group.label && (
                <>
                  <Divider />
                  {/* Menu aggregation within group */}
                  <Box px={2.5} py={1.5}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      메뉴별 합산
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>메뉴명</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>수량</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>비율</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, bgcolor: 'grey.50' }}>금액</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.values(
                            group.items.reduce<Record<string, { name: string; qty: number; total: number }>>((acc, item) => {
                              if (!acc[item.menuName]) acc[item.menuName] = { name: item.menuName, qty: 0, total: 0 };
                              acc[item.menuName].qty   += item.quantity;
                              acc[item.menuName].total += item.totalPrice;
                              return acc;
                            }, {})
                          ).sort((a, b) => b.total - a.total).map(m => (
                            <TableRow key={m.name} hover>
                              <TableCell>{m.name}</TableCell>
                              <TableCell align="center">{m.qty}</TableCell>
                              <TableCell align="right">
                                <Chip label={`${Math.round(m.total / group.total * 100)}%`}
                                  size="small" variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }} />
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                {m.total.toLocaleString()}원
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'primary.50' }}>
                            <TableCell colSpan={3} sx={{ fontWeight: 800 }}>합계</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main', fontSize: '1rem' }}>
                              {group.total.toLocaleString()}원
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
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
