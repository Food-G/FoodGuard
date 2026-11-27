import { useEffect, useState } from 'react';
import { Box, Paper, Stack, Typography, Chip, alpha } from '@mui/material';
import { STAFF } from './StaffList';

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const ATTEND = {
  before: { label: '출근 전', color: '#7A8194', bg: '#EEF0F4' },
  working: { label: '근무 중', color: '#1D9E75', bg: '#E3F5EE' },
  off: { label: '퇴근', color: '#5468C4', bg: '#ECEEFA' },
};

const StaffAttendance = () => {
  // 출퇴근 상태는 현재 시각 기준이라 1분마다 다시 계산
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(t); }, []);

  const todayLabel = clock.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  const staff = STAFF.map((st) => {
    const start = toMin(st.start); const end = toMin(st.end);
    const state: keyof typeof ATTEND = nowMin < start ? 'before' : nowMin < end ? 'working' : 'off';
    const late = state !== 'before' && toMin(st.clockIn) > start ? toMin(st.clockIn) - start : 0;
    const progress = state === 'working' ? Math.round(((nowMin - start) / (end - start)) * 100) : state === 'off' ? 100 : 0;
    const detail = state === 'before' ? `${st.start} 출근 예정` : state === 'working' ? `${st.clockIn} 출근` : `${st.clockIn} 출근 · ${st.end} 퇴근`;
    return { ...st, state, late, progress, detail };
  });
  const staffCount = (k: keyof typeof ATTEND) => staff.filter((x) => x.state === k).length;

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <Typography variant="h6" fontWeight={700}>
          {todayLabel} {String(clock.getHours()).padStart(2, '0')}:{String(clock.getMinutes()).padStart(2, '0')} 기준
        </Typography>
        <Chip label="예시 데이터" size="small" />
      </Stack>
      <Stack direction="row" gap={1} mb={1.5}>
        {(['working', 'before', 'off'] as const).map((k) => (
          <Stack key={k} direction="row" alignItems="center" gap={0.8} sx={{ flex: 1, justifyContent: 'center', py: 1, borderRadius: '8px', bgcolor: ATTEND[k].bg }}>
            <Typography fontSize={13} color={ATTEND[k].color} fontWeight={600}>{ATTEND[k].label}</Typography>
            <Typography fontSize={16} color={ATTEND[k].color} fontWeight={900}>{staffCount(k)}</Typography>
          </Stack>
        ))}
      </Stack>
      {staff.map((st, i) => {
        const a = ATTEND[st.state];
        return (
          <Stack key={st.name} direction="row" gap={1.5} alignItems="center" sx={{ py: 1.5, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(st.color, 0.14), color: st.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, position: 'relative',
            }}>
              {st.name[0]}
              <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', bgcolor: a.color, border: '2px solid #fff' }} />
            </Box>
            <Box flex={1} minWidth={0}>
              <Stack direction="row" alignItems="center" gap={0.7}>
                <Typography fontSize={14.5} fontWeight={800}>{st.name}</Typography>
                <Typography fontSize={12} color="text.secondary">{st.role}</Typography>
                {st.late > 0 && <Box sx={{ px: 0.7, borderRadius: 9, bgcolor: '#FDF0E4', color: '#C26A1F', fontSize: 11, fontWeight: 700 }}>{st.late}분 지각</Box>}
              </Stack>
              <Typography fontSize={12.5} color="text.secondary" noWrap>근무 {st.start}–{st.end} · {st.detail}</Typography>
              {st.state === 'working' && (
                <Box sx={{ mt: 0.6, height: 4, borderRadius: 2, bgcolor: '#EEF0F4', overflow: 'hidden' }}>
                  <Box sx={{ width: `${st.progress}%`, height: 1, bgcolor: a.color, borderRadius: 2, transition: 'width .5s ease' }} />
                </Box>
              )}
            </Box>
            <Box sx={{ px: 1.2, py: 0.4, borderRadius: 9, bgcolor: a.bg, color: a.color, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{a.label}</Box>
          </Stack>
        );
      })}
    </Paper>
  );
};

export default StaffAttendance;
