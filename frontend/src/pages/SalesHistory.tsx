import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import { TOSS, TossPage, BigStat, Segmented, ListRow, EmptyState, StickyHeader, TwoColumn, SidePanel, PanelTitle, BarRow, MiniBars } from '../components/TossUI';

// 로컬 날짜 (toISOString 은 UTC 라 한국 오전 9시 전에는 어제 날짜가 된다)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const monthStart = () => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth(), 1)); };
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (s: string) => {
  if (s === daysAgo(0)) return '오늘';
  if (s === daysAgo(1)) return '어제';
  const d = new Date(`${s}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAY[d.getDay()]}요일`;
};
const won = (n: number) => `${n.toLocaleString()}원`;

type PresetKey = 'today' | 'yesterday' | '7d' | '30d' | 'month';
const PRESETS: { value: PresetKey; label: string; range: () => [string, string] }[] = [
  { value: 'today', label: '오늘', range: () => [daysAgo(0), daysAgo(0)] },
  { value: 'yesterday', label: '어제', range: () => [daysAgo(1), daysAgo(1)] },
  { value: '7d', label: '7일', range: () => [daysAgo(6), daysAgo(0)] },
  { value: '30d', label: '30일', range: () => [daysAgo(29), daysAgo(0)] },
  { value: 'month', label: '이번 달', range: () => [monthStart(), daysAgo(0)] },
];

interface Row { id: number; saleDate: string; menuName: string; quantity: number; totalPrice: number }

const SalesHistory = ({ user }: any) => {
  const [storeId, setStoreId] = useState<number | null>(null);
  const [preset, setPreset] = useState<PresetKey | ''>('7d');
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(daysAgo(0));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores) => {
        if (!stores?.length) { setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.'); setLoading(false); return; }
        setStoreId(stores[0].id);
      })
      .catch(() => { setError('가게 정보를 불러오지 못했습니다.'); setLoading(false); });
  }, [user]);

  const invalid = start > end;

  useEffect(() => {
    if (!storeId || invalid) return;
    setLoading(true);
    setError('');
    salesService.getByDateRange(storeId, start, end)
      .then((sales: any[]) => setRows(sales.map((s) => ({
        id: s.id,
        saleDate: s.saleDate,
        menuName: s.menu?.menuName ?? '-',
        quantity: s.quantity,
        totalPrice: s.totalPrice ?? (s.menu ? s.menu.price * s.quantity : 0),
      }))))
      .catch((e) => setError(e?.message || '판매 내역을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId, start, end, invalid]);

  // 날짜별로 묶고 최신 날짜부터 (토스 거래내역처럼)
  const days = useMemo(() => {
    const byDay = new Map<string, Row[]>();
    for (const r of rows) byDay.set(r.saleDate, [...(byDay.get(r.saleDate) ?? []), r]);
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => b.totalPrice - a.totalPrice),
        total: items.reduce((s, r) => s + r.totalPrice, 0),
      }));
  }, [rows]);

  const total = rows.reduce((s, r) => s + r.totalPrice, 0);
  const quantity = rows.reduce((s, r) => s + r.quantity, 0);

  const choosePreset = (key: PresetKey) => {
    const [s, e] = PRESETS.find((p) => p.value === key)!.range();
    setPreset(key);
    setStart(s);
    setEnd(e);
  };

  const changeDate = (which: 'start' | 'end', value: string) => {
    if (!value) return;
    setPreset('');
    if (which === 'start') setStart(value); else setEnd(value);
  };

  // 추이: 기간의 모든 날짜(판매 없는 날 0). 62일이 넘으면 주 단위로 묶는다
  const trend = useMemo(() => {
    if (invalid) return { values: [] as number[], labels: [] as string[], weekly: false };
    const byDate = new Map(days.map((d) => [d.date, d.total]));
    const out: { label: string; value: number }[] = [];
    for (let d = new Date(`${start}T00:00:00`); ymd(d) <= end; d.setDate(d.getDate() + 1)) {
      out.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: byDate.get(ymd(d)) ?? 0 });
    }
    if (out.length <= 62) return { values: out.map((o) => o.value), labels: out.map((o) => o.label), weekly: false };
    const weeks: { label: string; value: number }[] = [];
    for (let i = 0; i < out.length; i += 7) {
      const chunk = out.slice(i, i + 7);
      weeks.push({ label: chunk[0].label, value: chunk.reduce((sum, c) => sum + c.value, 0) });
    }
    return { values: weeks.map((w) => w.value), labels: weeks.map((w) => w.label), weekly: true };
  }, [days, start, end, invalid]);

  // 메뉴별 매출 비중
  const byMenu = useMemo(() => {
    const m = new Map<string, { revenue: number; quantity: number }>();
    for (const r of rows) {
      const cur = m.get(r.menuName) ?? { revenue: 0, quantity: 0 };
      m.set(r.menuName, { revenue: cur.revenue + r.totalPrice, quantity: cur.quantity + r.quantity });
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  }, [rows]);

  const dateFieldSx = { flex: 1, '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: '#FFFFFF' }, '& fieldset': { border: 'none' } };

  const side = (
    <SidePanel>
      <Segmented options={PRESETS} value={preset} onChange={choosePreset} />
      <Stack direction="row" gap={1} alignItems="center" mt={1.5}>
        <TextField size="small" type="date" value={start} sx={dateFieldSx} inputProps={{ max: end, 'aria-label': '시작일' }}
          onChange={(e) => changeDate('start', e.target.value)} />
        <Typography sx={{ color: TOSS.sub }}>~</Typography>
        <TextField size="small" type="date" value={end} sx={dateFieldSx} inputProps={{ min: start, max: daysAgo(0), 'aria-label': '종료일' }}
          onChange={(e) => changeDate('end', e.target.value)} />
      </Stack>
      {invalid && <Alert severity="warning" sx={{ mt: 1.5, borderRadius: '12px' }}>시작일이 종료일보다 늦습니다.</Alert>}

      <Box mt={3}>
        <BigStat label={start === end ? `${dayLabel(start)} 매출` : '기간 매출'} value={loading ? '…' : won(total)} />
        {!loading && (
          <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
            판매 {rows.length}건 · {quantity}개{days.length > 1 ? ` · 하루 평균 ${won(Math.round(total / days.length))}` : ''}
          </Typography>
        )}
      </Box>

      {!loading && trend.values.length > 1 && (
        <>
          <PanelTitle right={trend.weekly ? '주 단위' : '일 단위'}>매출 추이</PanelTitle>
          <MiniBars values={trend.values} labels={trend.labels} />
        </>
      )}

      {!loading && byMenu.length > 0 && (
        <>
          <PanelTitle right={`${byMenu.length}개 메뉴`}>메뉴별 매출</PanelTitle>
          {byMenu.slice(0, 5).map((m) => (
            <BarRow key={m.name} label={`${m.name} · ${m.quantity}개`} value={won(m.revenue)} ratio={total ? m.revenue / total : 0} />
          ))}
        </>
      )}
    </SidePanel>
  );

  const main = (
    <Box>
      {error && <Alert severity="error" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, mb: 1, letterSpacing: '-0.02em' }}>판매 내역</Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : days.length === 0 ? (
        <EmptyState icon="mingcute:bill-line" title="이 기간에는 판매가 없어요"
          desc="기간을 넓혀 보거나 POS·판매 입력에서 판매를 기록해 주세요." />
      ) : days.map((day, i) => (
        <Box key={day.date} sx={{ mt: i === 0 ? 0 : 2 }}>
          <StickyHeader left={dayLabel(day.date)} right={won(day.total)} />
          {day.items.map((r) => (
            <ListRow key={r.id} icon="mingcute:fork-spoon-line" iconColor="#1D9E75"
              title={r.menuName} desc={`${r.quantity}개`} right={won(r.totalPrice)} />
          ))}
        </Box>
      ))}
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />
    </TossPage>
  );
};

export default SalesHistory;
