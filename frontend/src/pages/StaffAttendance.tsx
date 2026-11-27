import { useEffect, useState } from 'react';
import { Box, CircularProgress, Paper, Stack, Typography, Chip, alpha } from '@mui/material';
import AlertMessages from '../components/AlertMessages';
import { useMyStore } from '../hooks/useMyStore';
import { Staff, daysLabel, daysOf, staffColor, staffError, staffService, todayCode } from '../services/staffService';

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const ATTEND = {
  before: { label: '출근 전', color: '#7A8194', bg: '#EEF0F4' },
  working: { label: '근무 중', color: '#1D9E75', bg: '#E3F5EE' },
  off: { label: '퇴근', color: '#5468C4', bg: '#ECEEFA' },
};

// 실제 출퇴근 기록은 아직 없어서, 등록된 근무 요일·시간과 현재 시각으로 상태를 보여준다
const StaffAttendance = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const [list, setList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    staffService.getByStore(storeId).then(setList)
      .catch((e) => setError(staffError(e, '직원 목록을 불러오지 못했어요.')))
      .finally(() => setLoading(false));
  }, [storeId, storeLoading]);

  // 상태는 현재 시각 기준이라 1분마다 다시 계산
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(t); }, []);

  const todayLabel = clock.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  const today = todayCode(clock);
  const staff = list.filter((s) => daysOf(s).includes(today)).map((st) => {
    const start = toMin(st.startTime); const end = toMin(st.endTime);
    const state: keyof typeof ATTEND = nowMin < start ? 'before' : nowMin < end ? 'working' : 'off';
    const progress = state === 'working' ? Math.round(((nowMin - start) / (end - start)) * 100) : state === 'off' ? 100 : 0;
    const detail = state === 'before' ? `${st.startTime} 출근 예정` : state === 'working' ? `${st.endTime} 퇴근 예정` : `${st.endTime} 퇴근`;
    return { ...st, state, progress, detail };
  });
  const offToday = list.filter((s) => !daysOf(s).includes(today));
  const staffCount = (k: keyof typeof ATTEND) => staff.filter((x) => x.state === k).length;

  return (
    <Stack gap={2}>
      <AlertMessages error={error} success="" onClearError={() => setError('')} onClearSuccess={() => {}} />
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}>
        <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
          <Typography variant="h6" fontWeight={700}>
            {todayLabel} {String(clock.getHours()).padStart(2, '0')}:{String(clock.getMinutes()).padStart(2, '0')} 기준
          </Typography>
          <Chip label="근무표 기준" size="small" title="실제 출퇴근 기록이 아니라 등록된 근무 요일·시간으로 계산해요" />
        </Stack>

        {loading ? <Box textAlign="center" py={5}><CircularProgress size={28} /></Box> : (
          <>
            <Stack direction="row" gap={1} mb={1.5}>
              {(['working', 'before', 'off'] as const).map((k) => (
                <Stack key={k} direction="row" alignItems="center" gap={0.8} sx={{ flex: 1, justifyContent: 'center', py: 1, borderRadius: '8px', bgcolor: ATTEND[k].bg }}>
                  <Typography fontSize={13} color={ATTEND[k].color} fontWeight={600}>{ATTEND[k].label}</Typography>
                  <Typography fontSize={16} color={ATTEND[k].color} fontWeight={900}>{staffCount(k)}</Typography>
                </Stack>
              ))}
            </Stack>

            {staff.length === 0 && (
              <Typography color="text.secondary" textAlign="center" py={4}>
                {list.length === 0 ? '등록된 직원이 없어요. 직원 목록에서 먼저 추가해 주세요.' : '오늘 근무하는 직원이 없어요.'}
              </Typography>
            )}
            {staff.map((st, i) => {
              const a = ATTEND[st.state];
              const color = staffColor(st);
              return (
                <Stack key={st.id} direction="row" gap={1.5} alignItems="center" sx={{ py: 1.5, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(color, 0.14), color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, position: 'relative',
                  }}>
                    {st.name[0]}
                    <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', bgcolor: a.color, border: '2px solid #fff' }} />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" gap={0.7}>
                      <Typography fontSize={14.5} fontWeight={800}>{st.name}</Typography>
                      <Typography fontSize={12} color="text.secondary">{st.role}</Typography>
                    </Stack>
                    <Typography fontSize={12.5} color="text.secondary" noWrap>근무 {st.startTime}–{st.endTime} · {st.detail}</Typography>
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

            {offToday.length > 0 && (
              <Box mt={2} pt={2} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={1}>오늘 쉬는 직원 {offToday.length}명</Typography>
                <Stack direction="row" gap={0.8} flexWrap="wrap">
                  {offToday.map((s) => (
                    <Box key={s.id} sx={{ px: 1.2, py: 0.4, borderRadius: 9, bgcolor: '#F4F6FA', fontSize: 12.5, color: 'text.secondary' }}>
                      {s.name} · {daysLabel(s)} 근무
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Stack>
  );
};

export default StaffAttendance;
