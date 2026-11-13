import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Button, Alert, CircularProgress, Chip, Stack } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { errorText } from '../services/agentService';
import { attendanceService, employeeService, Attendance, Employee } from '../services/employeeService';
import { hhmm, localDate } from '../helpers/date';

// 매장 태블릿용 출퇴근 화면: 직원이 PIN 4자리를 누르면 출근, 근무 중이면 퇴근
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '←'];

const Clock = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [today, setToday] = useState<Attendance[]>([]);
  // 직전 결과 메시지의 지우기 타이머 (새 메시지가 나오면 취소해야 새 메시지가 바로 지워지지 않는다)
  const resultTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadToday = useCallback(() => {
    if (!storeId) return;
    const d = localDate(new Date());
    employeeService.getByStore(storeId).then(setEmployees).catch(() => {});
    attendanceService.getByStore(storeId, d, d).then(setToday).catch(() => {});
  }, [storeId]);
  useEffect(loadToday, [loadToday]);

  const submit = useCallback(async (value: string) => {
    if (!storeId || value.length !== 4) return;
    setBusy(true);
    try {
      const r = await attendanceService.clock(storeId, value);
      setResult({ ok: true, text: `${r.employeeName} 님 ${r.action === 'IN' ? '출근' : '퇴근'} ${hhmm(r.time)}` });
      loadToday();
    } catch (e) {
      setResult({ ok: false, text: errorText(e, '출퇴근을 기록하지 못했습니다.') });
    } finally {
      setPin('');
      setBusy(false);
      clearTimeout(resultTimer.current);
      resultTimer.current = setTimeout(() => setResult(null), 4000);
    }
  }, [storeId, loadToday]);

  const press = useCallback((key: string) => {
    if (busy) return;
    if (key === 'C') return setPin('');
    if (key === '←') return setPin((p) => p.slice(0, -1));
    // 업데이트 함수 안에서 submit 하면 StrictMode 에서 두 번 불려 출근 직후 퇴근된다
    if (pin.length >= 4) return;  // 전송 중 추가 입력 무시
    const next = pin + key;
    setPin(next);
    if (next.length === 4) submit(next);
  }, [busy, pin, submit]);

  // 실물 키보드 숫자·백스페이스
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('←');
      else if (e.key === 'Escape') press('C');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (storeLoading) return <Box textAlign="center" py={10}><CircularProgress /></Box>;
  if (!storeId) return <Alert severity="warning">등록된 가게가 없습니다. 가게를 먼저 등록해주세요.</Alert>;

  const working = today.filter((a) => !a.clockOut);
  const nameOf = (id: number) => employees.find((e) => e.id === id)?.name ?? '?';

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', textAlign: 'center' }}>
      <Typography fontSize={44} fontWeight={800} lineHeight={1.1}>
        {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
      </Typography>
      <Typography color="text.secondary" mb={2}>PIN 4자리를 누르면 출근, 근무 중이면 퇴근으로 기록됩니다</Typography>

      <Stack direction="row" justifyContent="center" gap={1.5} mb={2} aria-label={`입력한 자리수 ${pin.length}`}>
        {[0, 1, 2, 3].map((i) => (
          <Box key={i} sx={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #1565C0', bgcolor: i < pin.length ? '#1565C0' : 'transparent' }} />
        ))}
      </Stack>

      <Box sx={{ height: 56, mb: 1 }} role="status" aria-live="polite">
        {result && (
          <Alert severity={result.ok ? 'success' : 'error'} sx={{ height: '100%', flexDirection: 'row', alignItems: 'center', fontSize: 17, fontWeight: 700, py: 0 }}>
            {result.text}
          </Alert>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
        {KEYS.map((k) => (
          <Button key={k} variant={/\d/.test(k) ? 'outlined' : 'text'} onClick={() => press(k)} disabled={busy}
            aria-label={k === 'C' ? '지우기' : k === '←' ? '한 자리 지우기' : k}
            sx={{ height: 72, fontSize: 28, fontWeight: 800, borderRadius: 3 }}>
            {k === '←' ? <IconifyIcon icon="mingcute:delete-back-line" width={28} /> : k}
          </Button>
        ))}
      </Box>

      <Paper variant="outlined" sx={{ p: 2, textAlign: 'left' }}>
        <Typography fontWeight={800} mb={1}>지금 근무 중 {working.length}명</Typography>
        {working.length === 0 ? (
          <Typography fontSize={14} color="text.secondary">근무 중인 직원이 없습니다.</Typography>
        ) : (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {working.map((a) => <Chip key={a.id} label={`${nameOf(a.employeeId)} · ${hhmm(a.clockIn)} 출근`} color="success" variant="outlined" />)}
          </Stack>
        )}
      </Paper>
    </Box>
  );
};

export default Clock;
