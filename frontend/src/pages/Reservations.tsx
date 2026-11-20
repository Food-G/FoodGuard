import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, useTheme,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import AlertMessages from '../components/AlertMessages';
import { useMyStore } from '../hooks/useMyStore';
import { errorText } from '../services/agentService';
import { reservationService, Reservation, ReservationStatus, STATUS_LABEL } from '../services/reservationService';
import { hhmm, localDate } from '../helpers/date';

interface Form { customerName: string; phone: string; reservationDate: string; reservationTime: string; guests: string; note: string }

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const dateLabel = (iso: string, today: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
  return iso === today ? `${base} · 오늘` : base;
};

const Reservations = ({ user }: any) => {
  const theme = useTheme();
  const { storeId, storeLoading } = useMyStore(user);
  const [list, setList] = useState<Reservation[] | null>(null);
  const [filter, setFilter] = useState<ReservationStatus | 'ALL'>('ALL');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!storeId) return;
    reservationService.getByStore(storeId)
      .then(setList)
      .catch(() => { setList((l) => l ?? []); setError('예약 목록을 불러오지 못했습니다.'); });
  }, [storeId]);
  useEffect(reload, [reload]);

  if (storeLoading) return <Stack alignItems="center" py={10}><CircularProgress /></Stack>;
  if (!storeId) return <AlertMessages error="등록된 가게가 없습니다. 가게를 먼저 등록해주세요." />;

  const rows = list ?? [];
  const today = localDate(new Date());
  const todayCount = rows.filter((r) => r.reservationDate === today && r.status === 'RESERVED').length;
  const waiting = rows.filter((r) => r.status === 'RESERVED').length;
  const visited = rows.filter((r) => r.status === 'VISITED').length;
  const cancelled = rows.filter((r) => r.status === 'CANCELLED').length;
  const filtered = filter === 'ALL' ? rows : rows.filter((r) => r.status === filter);

  // 날짜별 묶음 (API 가 날짜·시간 순으로 준다)
  const groups: { date: string; items: Reservation[] }[] = [];
  for (const r of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.date === r.reservationDate) last.items.push(r);
    else groups.push({ date: r.reservationDate, items: [r] });
  }

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await reservationService.create({ storeId, ...form, guests: Number(form.guests) });
      setForm(null);
      reload();
    } catch (e) {
      setError(errorText(e, '예약을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (r: Reservation, status: ReservationStatus) => {
    try {
      await reservationService.updateStatus(r.id, status);
      reload();
    } catch (e) {
      setError(errorText(e, '예약 상태를 바꾸지 못했습니다.'));
    }
  };

  const statusColor = (s: ReservationStatus) =>
    s === 'RESERVED' ? theme.palette.primary.main : s === 'VISITED' ? theme.palette.success.main : theme.palette.text.disabled;
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const pill = (key: ReservationStatus | 'ALL', label: string) => (
    <Chip
      key={key} label={label} onClick={() => setFilter(key)}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: filter === key ? 700 : 500,
        bgcolor: filter === key ? 'text.primary' : 'background.default',
        color: filter === key ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: filter === key ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>오늘 예약</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {list === null ? '-' : `${todayCount}건`}
          </Typography>
          {list !== null && (
            <Typography fontSize={15} color="text.secondary" mt={1}>
              앞으로 방문할 예약 <Box component="span" color="primary.main" fontWeight={700}>{waiting}건</Box> · 방문 완료 {visited}건
            </Typography>
          )}
        </Box>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" width={16} />}
          onClick={() => setForm({ customerName: '', phone: '', reservationDate: today, reservationTime: '18:00', guests: '2', note: '' })}>
          예약 추가
        </Button>
      </Stack>

      <AlertMessages error={error} onClearError={() => setError('')} />

      <Paper sx={{ p: { xs: 3, md: 5 } }}>
        <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
          {pill('ALL', `전체 ${rows.length}`)}
          {pill('RESERVED', `${STATUS_LABEL.RESERVED} ${waiting}`)}
          {pill('VISITED', `${STATUS_LABEL.VISITED} ${visited}`)}
          {pill('CANCELLED', `${STATUS_LABEL.CANCELLED} ${cancelled}`)}
        </Stack>

        {list === null ? (
          <Stack alignItems="center" py={8}><CircularProgress /></Stack>
        ) : groups.length === 0 ? (
          <Stack alignItems="center" py={8} gap={1}>
            <IconifyIcon icon="mingcute:calendar-2-line" color={theme.palette.text.disabled} width={44} />
            <Typography color="text.secondary" fontWeight={600}>
              {rows.length === 0 ? '예약이 없습니다.' : '해당 상태의 예약이 없습니다.'}
            </Typography>
            {rows.length === 0 && <Typography variant="body2" color="text.secondary">'예약 추가'로 전화·방문 예약을 등록하세요.</Typography>}
          </Stack>
        ) : groups.map((g) => (
          <Box key={g.date} sx={{ '& + &': { mt: 4 } }}>
            <Typography fontSize={14} fontWeight={700} color={g.date === today ? 'primary.main' : 'text.secondary'} mb={0.5}>
              {dateLabel(g.date, today)}
            </Typography>
            {g.items.map((r) => (
              <Stack key={r.id} direction="row" alignItems="center" gap={3}
                sx={{ py: 2.5, ...rowSx, opacity: r.status === 'CANCELLED' ? 0.5 : 1 }}>
                <Typography fontWeight={700} fontSize={17} sx={{ width: 56, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {hhmm(r.reservationTime)}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap>
                    {r.customerName} <Box component="span" fontWeight={700}>{r.guests}명</Box>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {[r.phone, r.note].filter(Boolean).join(' · ') || '연락처·메모 없음'}
                  </Typography>
                </Box>
                <Typography fontWeight={700} fontSize={14} sx={{ color: statusColor(r.status), whiteSpace: 'nowrap' }}>
                  {STATUS_LABEL[r.status]}
                </Typography>
                {r.status === 'RESERVED' && (
                  <Stack direction="row" gap={1}>
                    <Button size="small" variant="text" color="error" onClick={() => setStatus(r, 'CANCELLED')}>취소</Button>
                    <Button size="small" onClick={() => setStatus(r, 'VISITED')}>방문완료</Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Box>
        ))}
      </Paper>

      <Dialog open={form != null} onClose={() => setForm(null)} fullWidth maxWidth="xs">
        <DialogTitle>예약 추가</DialogTitle>
        {form && (
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="예약자" required value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              <TextField label="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Stack direction="row" gap={2}>
                <TextField label="날짜" type="date" required fullWidth value={form.reservationDate} InputLabelProps={{ shrink: true }}
                  onChange={(e) => setForm({ ...form, reservationDate: e.target.value })} />
                <TextField label="시간" type="time" required fullWidth value={form.reservationTime} InputLabelProps={{ shrink: true }}
                  onChange={(e) => setForm({ ...form, reservationTime: e.target.value })} />
              </Stack>
              <TextField label="인원" type="number" required value={form.guests} inputProps={{ min: 1 }}
                onChange={(e) => setForm({ ...form, guests: e.target.value })} />
              <TextField label="메모" value={form.note} inputProps={{ maxLength: 200 }} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button variant="text" onClick={() => setForm(null)}>닫기</Button>
          <Button variant="contained" onClick={save}
            disabled={saving || !form?.customerName.trim() || !form?.reservationDate || !form?.reservationTime || Number(form?.guests) < 1}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Reservations;
