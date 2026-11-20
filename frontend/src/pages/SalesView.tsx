import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, Grid, TextField, MenuItem, CircularProgress, Alert, Stack, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import * as echarts from 'echarts';
import { salesService, SalesInsight, SalesSummary } from '../services/salesService';
import { menuService } from '../services/menuService';
import { storeService } from '../services/storeService';
import { errorText } from '../services/agentService';
import IconifyIcon from '../components/base/IconifyIcon';
import ReactEChart from '../components/base/ReactEChart';
import EventNoteCard from '../components/EventNoteCard';
import SalesImportDialog from '../components/agent/SalesImportDialog';
import SalesCorrectionCard from '../components/agent/SalesCorrectionCard';

const REFRESH_MILLIS = 30_000;

// 브라우저 기준 오늘 (toISOString 은 UTC 라 한국 오전 9시 전에 어제가 된다)
const localDate = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PRESETS: Record<string, number> = { today: 0, week: 6, month: 29 };

const changeLabel = (now: number, before: number) => {
  if (before <= 0) return '직전 기간 기록 없음';
  const pct = Math.round(((now - before) / before) * 1000) / 10;
  return `직전 기간 대비 ${pct > 0 ? '+' : ''}${pct}%`;
};

// 판매량 확인: POS 결제가 자동으로 기록한 판매를 코드가 집계해 보여 준다. 수기 입력 없음
const SalesView = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [preset, setPreset] = useState<string | null>('week');
  const [range, setRange] = useState({ start: localDate(6), end: localDate() });
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [insight, setInsight] = useState<SalesInsight | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [flags, setFlags] = useState<any[]>([]);
  const [flagForm, setFlagForm] = useState({ flagType: 'SOLD_OUT', menuId: '', flagDate: localDate() });

  const loadSummary = (sid: number, showError = true) =>
    salesService.getSummary(sid, range.start, range.end)
      .then(setSummary)
      .catch((e) => { if (showError) setError(errorText(e, '판매량을 불러오지 못했습니다.')); })
      .finally(() => setLoading(false));

  const loadFlags = (sid: number) =>
    salesService.getFlags(sid).then((d: any[]) => setFlags(d ?? [])).catch(() => setError('휴무·품절 기록을 불러오지 못했습니다.'));

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then(async (stores: any[]) => {
        if (!stores?.length) { setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.'); setLoading(false); return; }
        const sid = stores[0].id;
        setStoreId(sid);
        setMenus((await menuService.getByStore(sid)) ?? []);
        loadFlags(sid);
      })
      .catch(() => { setError('가게 정보를 불러오지 못했습니다.'); setLoading(false); });
  }, [user]);

  // POS 결제가 바로 보이도록 주기적으로 다시 읽는다
  useEffect(() => {
    if (!storeId) return;
    setInsight(null);
    loadSummary(storeId);
    const timer = setInterval(() => loadSummary(storeId, false), REFRESH_MILLIS);
    return () => clearInterval(timer);
  }, [storeId, range.start, range.end]);

  const selectPreset = (value: string | null) => {
    if (!value) return;
    setPreset(value);
    setRange({ start: localDate(PRESETS[value]), end: localDate() });
  };

  const askInsight = async () => {
    if (!storeId) return;
    setInsightBusy(true);
    setError('');
    try {
      setInsight(await salesService.getInsight(storeId, range.start, range.end));
    } catch (e) {
      setError(errorText(e, 'AI 요약을 받지 못했습니다.'));
    } finally {
      setInsightBusy(false);
    }
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || (flagForm.flagType === 'SOLD_OUT' && !flagForm.menuId)) return;
    try {
      await salesService.createFlag({
        storeId,
        flagDate: flagForm.flagDate,
        flagType: flagForm.flagType as 'CLOSED' | 'SOLD_OUT',
        ...(flagForm.flagType === 'SOLD_OUT' ? { menuId: Number(flagForm.menuId) } : {}),
      });
      await loadFlags(storeId);
    } catch (err) {
      setError(errorText(err, '휴무·품절 기록에 실패했습니다.'));
    }
  };

  const handleFlagDelete = async (id: number) => {
    if (!storeId) return;
    try {
      await salesService.deleteFlag(id);
      await loadFlags(storeId);
    } catch (err) {
      setError(errorText(err, '기록 삭제에 실패했습니다.'));
    }
  };

  const menuName = (menuId: number) => menus.find((m) => m.id === menuId)?.menuName ?? '메뉴';

  const chartOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: summary?.byDay.map((d) => d.date.slice(5)) ?? [] },
    yAxis: { type: 'value', minInterval: 1 },
    series: [{ name: '판매량', type: 'bar', data: summary?.byDay.map((d) => d.quantity) ?? [], itemStyle: { color: theme.palette.primary.main } }],
  };

  const tile = (label: string, value: string, caption?: string) => (
    <Grid item xs={12} sm={4}>
      <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: '100%' }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h5" fontWeight={800} mt={0.5}>{value}</Typography>
        {caption && <Typography variant="caption" color="text.secondary">{caption}</Typography>}
      </Paper>
    </Grid>
  );

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
          <ToggleButtonGroup size="small" exclusive value={preset} onChange={(_, v) => selectPreset(v)}>
            <ToggleButton value="today">오늘</ToggleButton>
            <ToggleButton value="week">최근 7일</ToggleButton>
            <ToggleButton value="month">최근 30일</ToggleButton>
          </ToggleButtonGroup>
          <TextField size="small" type="date" label="시작" InputLabelProps={{ shrink: true }} value={range.start}
            onChange={(e) => { setPreset(null); setRange((r) => ({ ...r, start: e.target.value })); }} />
          <TextField size="small" type="date" label="종료" InputLabelProps={{ shrink: true }} value={range.end}
            onChange={(e) => { setPreset(null); setRange((r) => ({ ...r, end: e.target.value })); }} />
          <Box sx={{ flexGrow: 1 }} />
          <Button variant="outlined" size="small" disabled={insightBusy || !summary?.totalQuantity} onClick={askInsight}
            startIcon={insightBusy ? <CircularProgress size={14} /> : <IconifyIcon icon="mingcute:sparkles-line" />}>
            {insightBusy ? 'AI 요약 중...' : 'AI 판매 요약'}
          </Button>
          <Button variant="outlined" size="small" disabled={!storeId} onClick={() => setImportOpen(true)}
            startIcon={<IconifyIcon icon="mingcute:file-upload-line" />}>
            외부 POS 파일 등록
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          POS에서 결제하면 판매량이 자동으로 기록되고, 30초마다 새로 읽습니다.
        </Typography>
      </Paper>

      {insight && (
        <Alert severity="info" icon={false} onClose={() => setInsight(null)}>
          {insight.summary}
          {insight.highlights.map((h) => <Typography key={h} variant="body2" mt={0.5}>• {h}</Typography>)}
          {insight.unverifiedNumbers?.length > 0 && (
            <Typography variant="caption" display="block" mt={0.5}>집계에 없는 숫자: {insight.unverifiedNumbers.join(', ')}. 아래 수치를 기준으로 보세요.</Typography>
          )}
        </Alert>
      )}

      {loading ? (
        <Stack alignItems="center" py={6}><CircularProgress /></Stack>
      ) : summary && (
        <>
          <Grid container spacing={2}>
            {tile('판매량', `${summary.totalQuantity.toLocaleString()}개`, changeLabel(summary.totalQuantity, summary.previousQuantity))}
            {tile('매출', `₩${summary.revenue.toLocaleString()}`, changeLabel(summary.revenue, summary.previousRevenue))}
            {tile('할인 판매', `${summary.discountQuantity.toLocaleString()}개`, summary.discountAmount > 0 ? `할인액 ₩${summary.discountAmount.toLocaleString()}` : undefined)}
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} mb={1}>일별 판매량</Typography>
                {summary.totalQuantity === 0
                  ? <Typography variant="body2" color="text.secondary" py={6} textAlign="center">이 기간에 판매 기록이 없습니다.</Typography>
                  : <ReactEChart option={chartOption} echarts={echarts} sx={{ height: 280 }} />}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} mb={1}>메뉴별 판매량</Typography>
                <TableContainer sx={{ maxHeight: 290 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>메뉴</TableCell>
                        <TableCell align="right">수량</TableCell>
                        <TableCell align="right">매출</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summary.byMenu.map((m) => (
                        <TableRow key={m.menuId} hover>
                          <TableCell>
                            {m.menuName}
                            {m.discountQuantity > 0 && <Chip size="small" color="primary" variant="outlined" label={`할인 ${m.discountQuantity}`} sx={{ ml: 1 }} />}
                          </TableCell>
                          <TableCell align="right">{m.quantity.toLocaleString()}</TableCell>
                          <TableCell align="right">₩{m.revenue.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {summary.byMenu.length === 0 && (
                        <TableRow><TableCell colSpan={3} align="center"><Typography variant="body2" color="text.secondary">판매 기록 없음</Typography></TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {storeId && <SalesCorrectionCard storeId={storeId} onApplied={() => loadSummary(storeId)} />}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={700} mb={1}>휴무·품절 기록</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              품절된 날의 판매량은 실제 수요보다 작고, 휴무일에는 판매가 없습니다. 기록하면 AI 예측 학습에서 제외하고, 휴무일은 발주 예측을 0으로 둡니다.
            </Typography>
            <Stack component="form" onSubmit={handleFlagSubmit} gap={2}>
              <TextField select fullWidth size="small" label="구분" value={flagForm.flagType}
                onChange={(e) => setFlagForm({ ...flagForm, flagType: e.target.value })}>
                <MenuItem value="SOLD_OUT">메뉴 품절</MenuItem>
                <MenuItem value="CLOSED">매장 휴무</MenuItem>
              </TextField>
              {flagForm.flagType === 'SOLD_OUT' && (
                <TextField select fullWidth size="small" label="품절 메뉴" required value={flagForm.menuId}
                  onChange={(e) => setFlagForm({ ...flagForm, menuId: e.target.value })}>
                  {menus.map((menu) => <MenuItem key={menu.id} value={menu.id}>{menu.menuName}</MenuItem>)}
                </TextField>
              )}
              <TextField fullWidth size="small" type="date" label="날짜" required InputLabelProps={{ shrink: true }} value={flagForm.flagDate}
                onChange={(e) => setFlagForm({ ...flagForm, flagDate: e.target.value })} />
              <Button type="submit" variant="outlined">기록</Button>
            </Stack>
            {flags.length > 0 && (
              <Stack gap={0.5} sx={{ mt: 2, maxHeight: 200, overflowY: 'auto' }}>
                {flags.map((f) => (
                  <Stack key={f.id} direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2">{f.flagDate} · {f.flagType === 'CLOSED' ? '매장 휴무' : `${menuName(f.menuId)} 품절`}</Typography>
                    <IconButton size="small" color="error" onClick={() => handleFlagDelete(f.id)}>
                      <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          {storeId && <EventNoteCard storeId={storeId} sx={{ mt: 0, height: '100%' }} />}
        </Grid>
      </Grid>

      {storeId && (
        <SalesImportDialog open={importOpen} storeId={storeId} menus={menus} onClose={() => setImportOpen(false)}
          onSaved={() => { loadSummary(storeId); setSuccess('판매 파일을 등록했습니다.'); }} />
      )}
    </Stack>
  );
};

export default SalesView;
