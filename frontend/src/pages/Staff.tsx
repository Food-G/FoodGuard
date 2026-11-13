import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Paper, Typography, Tabs, Tab, Button, Stack, Chip, Alert, IconButton, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import { errorText } from '../services/agentService';
import {
  employeeService, attendanceService, Employee, EmployeeSchedule, Attendance, WeeklyPayRow,
} from '../services/employeeService';
import { addDays, hhmm, localDate, minutesBetween, minutesLabel, mondayOf } from '../helpers/date';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
// 2026년 최저시급
const MIN_WAGE = 10_320;
const won = (n: number) => `${n.toLocaleString()}원`;

/* ───────── 직원 명단 ───────── */
type EmployeeForm = { id?: number; name: string; phone: string; hourlyWage: string; pin: string };

const EmployeeTab = ({ storeId, employees, reload, onError }: { storeId: number; employees: Employee[]; reload: () => void; onError: (m: string) => void }) => {
  const confirm = useConfirm();
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const data = { name: form.name, phone: form.phone, hourlyWage: Number(form.hourlyWage), ...(form.pin ? { pin: form.pin } : {}) };
      if (form.id) await employeeService.update(form.id, data);
      else await employeeService.create({ storeId, ...data, pin: form.pin });
      setForm(null);
      reload();
    } catch (e) {
      onError(errorText(e, '직원 정보를 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (emp: Employee) => {
    if (emp.active && !await confirm({ message: `${emp.name} 님을 퇴사 처리할까요? 출퇴근 기록은 남습니다.`, confirmLabel: '퇴사 처리', severity: 'error' })) return;
    try {
      await employeeService.update(emp.id, { active: !emp.active });
      reload();
    } catch (e) {
      onError(errorText(e, '상태를 바꾸지 못했습니다.'));
    }
  };

  return (
    <>
      <Stack direction="row" justifyContent="flex-end" mb={1.5}>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" />}
          onClick={() => setForm({ name: '', phone: '', hourlyWage: String(MIN_WAGE), pin: '' })}>
          직원 추가
        </Button>
      </Stack>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>이름</TableCell>
              <TableCell>연락처</TableCell>
              <TableCell align="right">시급</TableCell>
              <TableCell>상태</TableCell>
              <TableCell align="right">관리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>등록된 직원이 없습니다. '직원 추가'로 등록하세요.</TableCell></TableRow>
            ) : employees.map((emp) => (
              <TableRow key={emp.id} sx={{ opacity: emp.active ? 1 : 0.6 }}>
                <TableCell sx={{ fontWeight: 700 }}>{emp.name}</TableCell>
                <TableCell>{emp.phone || '-'}</TableCell>
                <TableCell align="right">{won(emp.hourlyWage)}</TableCell>
                <TableCell>
                  <Chip size="small" label={emp.active ? '재직' : '퇴사'} color={emp.active ? 'success' : 'default'} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" variant="text" onClick={() => setForm({ id: emp.id, name: emp.name, phone: emp.phone ?? '', hourlyWage: String(emp.hourlyWage), pin: '' })}>수정</Button>
                  <Button size="small" variant="text" color={emp.active ? 'error' : 'primary'} onClick={() => toggleActive(emp)}>
                    {emp.active ? '퇴사 처리' : '복직'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={form != null} onClose={() => setForm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{form?.id ? '직원 정보 수정' : '직원 추가'}</DialogTitle>
        {form && (
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField label="이름" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <TextField label="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <TextField label="시급 (원)" type="number" required value={form.hourlyWage}
                onChange={(e) => setForm({ ...form, hourlyWage: e.target.value })}
                helperText={Number(form.hourlyWage) < MIN_WAGE ? `2026년 최저시급(${won(MIN_WAGE)})보다 낮습니다.` : ' '}
                error={Number(form.hourlyWage) < MIN_WAGE} />
              <TextField label={form.id ? 'PIN (바꿀 때만 입력)' : 'PIN 4자리'} required={!form.id} value={form.pin}
                inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                helperText="출퇴근 화면에서 직원이 입력하는 번호. 매장 안에서 겹치면 안 됩니다." />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button variant="text" onClick={() => setForm(null)}>취소</Button>
          <Button variant="contained" onClick={save}
            disabled={saving || !form?.name.trim() || !Number(form?.hourlyWage) || (!form?.id && form?.pin.length !== 4) || (!!form?.pin && form.pin.length !== 4)}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/* ───────── 근무 스케줄 ───────── */
const ScheduleTab = ({ storeId, employees, onError }: { storeId: number; employees: Employee[]; onError: (m: string) => void }) => {
  const [schedules, setSchedules] = useState<EmployeeSchedule[]>([]);
  const [form, setForm] = useState({ employeeId: '', weekday: '1', startTime: '09:00', endTime: '15:00' });
  const active = employees.filter((e) => e.active);
  const nameOf = (id: number) => employees.find((e) => e.id === id)?.name ?? '?';

  const load = useCallback(() => {
    employeeService.getSchedules(storeId).then(setSchedules).catch(() => onError('스케줄을 불러오지 못했습니다.'));
  }, [storeId, onError]);
  useEffect(load, [load]);

  const add = async () => {
    try {
      await employeeService.createSchedule({ storeId, employeeId: Number(form.employeeId), weekday: Number(form.weekday), startTime: form.startTime, endTime: form.endTime });
      load();
    } catch (e) {
      onError(errorText(e, '스케줄을 추가하지 못했습니다.'));
    }
  };

  const remove = async (id: number) => {
    try {
      await employeeService.deleteSchedule(id);
      load();
    } catch (e) {
      onError(errorText(e, '스케줄을 지우지 못했습니다.'));
    }
  };

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }}>
          <TextField select size="small" label="직원" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} sx={{ minWidth: 140 }}>
            {active.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="요일" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })} sx={{ minWidth: 90 }}>
            {WEEKDAYS.map((d, i) => <MenuItem key={d} value={String(i + 1)}>{d}요일</MenuItem>)}
          </TextField>
          <TextField size="small" type="time" label="시작" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} InputLabelProps={{ shrink: true }} />
          <TextField size="small" type="time" label="종료" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={add} disabled={!form.employeeId || !form.startTime || !form.endTime}>추가</Button>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)', lg: 'repeat(7, 1fr)' }, gap: 1.5 }}>
        {WEEKDAYS.map((d, i) => {
          const day = schedules.filter((s) => s.weekday === i + 1);
          return (
            <Paper key={d} variant="outlined" sx={{ p: 1.5, minHeight: 120 }}>
              <Typography fontWeight={800} mb={1} color={i >= 5 ? 'error.main' : 'text.primary'}>{d}요일</Typography>
              {day.length === 0 ? (
                <Typography fontSize={13} color="text.secondary">근무 없음</Typography>
              ) : (
                <Stack gap={0.8}>
                  {day.map((s) => (
                    <Stack key={s.id} direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1.5, bgcolor: '#EEF4FF' }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontSize={14} fontWeight={700} noWrap>{nameOf(s.employeeId)}</Typography>
                        <Typography fontSize={12} color="text.secondary">{hhmm(s.startTime)}~{hhmm(s.endTime)}</Typography>
                      </Box>
                      <IconButton size="small" aria-label={`${nameOf(s.employeeId)} ${d}요일 스케줄 삭제`} onClick={() => remove(s.id)}>
                        <IconifyIcon icon="mingcute:close-line" width={14} />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Paper>
          );
        })}
      </Box>
    </>
  );
};

/* ───────── 출퇴근 기록 · 주간 급여 ───────── */
const PayTab = ({ storeId, employees, onError }: { storeId: number; employees: Employee[]; onError: (m: string) => void }) => {
  const confirm = useConfirm();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [pay, setPay] = useState<WeeklyPayRow[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ id: number; clockIn: string; clockOut: string } | null>(null);
  const nameOf = (id: number) => employees.find((e) => e.id === id)?.name ?? '?';
  const start = localDate(weekStart);
  const end = localDate(addDays(weekStart, 6));

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([attendanceService.weeklyPay(storeId, start), attendanceService.getByStore(storeId, start, end)])
      .then(([p, r]) => { setPay(p); setRecords(r); })
      .catch(() => onError('출퇴근 기록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId, start, end, onError]);
  useEffect(load, [load]);

  const saveEdit = async () => {
    if (!edit) return;
    try {
      await attendanceService.update(edit.id, { clockIn: edit.clockIn, clockOut: edit.clockOut || null });
      setEdit(null);
      load();
    } catch (e) {
      onError(errorText(e, '기록을 수정하지 못했습니다.'));
    }
  };

  const remove = async (a: Attendance) => {
    if (!await confirm({ message: `${nameOf(a.employeeId)} 님의 ${a.clockIn.slice(5, 10)} 출퇴근 기록을 삭제할까요? 되돌릴 수 없습니다.`, confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await attendanceService.delete(a.id);
      load();
    } catch (e) {
      onError(errorText(e, '기록을 삭제하지 못했습니다.'));
    }
  };

  const total = pay.reduce((s, r) => s + r.totalPay, 0);

  return (
    <>
      <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
        <IconButton aria-label="이전 주" onClick={() => setWeekStart(addDays(weekStart, -7))}><IconifyIcon icon="mingcute:left-line" /></IconButton>
        <Typography fontWeight={800} fontSize={17}>{start.slice(5).replace('-', '/')}(월) ~ {end.slice(5).replace('-', '/')}(일)</Typography>
        <IconButton aria-label="다음 주" onClick={() => setWeekStart(addDays(weekStart, 7))}><IconifyIcon icon="mingcute:right-line" /></IconButton>
        <Button size="small" variant="text" onClick={() => setWeekStart(mondayOf(new Date()))}>이번 주</Button>
        <Typography sx={{ ml: 'auto' }} fontWeight={700}>주간 인건비 합계 {won(total)}</Typography>
      </Stack>

      {loading ? <Box textAlign="center" py={4}><CircularProgress /></Box> : (
        <>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>이름</TableCell>
                  <TableCell align="right">시급</TableCell>
                  <TableCell align="right">근무 시간</TableCell>
                  <TableCell align="right">기본급</TableCell>
                  <TableCell align="right">주휴수당</TableCell>
                  <TableCell align="right">합계</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pay.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>직원을 먼저 등록하세요.</TableCell></TableRow>
                ) : pay.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {r.name}
                      {r.openShifts > 0 && <Chip size="small" color="warning" label={`퇴근 누락 ${r.openShifts}건`} sx={{ ml: 1, height: 20 }} />}
                    </TableCell>
                    <TableCell align="right">{won(r.hourlyWage)}</TableCell>
                    <TableCell align="right">{minutesLabel(r.workedMinutes)}</TableCell>
                    <TableCell align="right">{won(r.basePay)}</TableCell>
                    <TableCell align="right">
                      {r.holidayEligible ? won(r.holidayPay) : <Typography component="span" fontSize={13} color="text.secondary">대상 아님 (15시간 미만)</Typography>}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>{won(r.totalPay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography fontSize={13} color="text.secondary" mb={3}>
            주휴수당 = 주 근무시간이 15시간 이상일 때 min(근무시간, 40) ÷ 40 × 8시간 × 시급. 실제 출퇴근 기록 기준이며 개근 여부는 반영하지 않습니다.
            퇴근 기록이 없는 근무는 계산에서 빠지니 아래에서 퇴근 시각을 입력하세요.
          </Typography>

          <Typography fontWeight={800} mb={1}>출퇴근 기록</Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>날짜</TableCell>
                  <TableCell>이름</TableCell>
                  <TableCell>출근</TableCell>
                  <TableCell>퇴근</TableCell>
                  <TableCell align="right">근무 시간</TableCell>
                  <TableCell align="right">관리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>이 주의 출퇴근 기록이 없습니다.</TableCell></TableRow>
                ) : records.map((a) => {
                  const d = new Date(a.clockIn);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{a.clockIn.slice(5, 10).replace('-', '/')}({WEEKDAYS[(d.getDay() + 6) % 7]})</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{nameOf(a.employeeId)}</TableCell>
                      <TableCell>{hhmm(a.clockIn)}</TableCell>
                      <TableCell>{a.clockOut ? hhmm(a.clockOut) : <Chip size="small" color="warning" label="퇴근 기록 없음" sx={{ height: 20 }} />}</TableCell>
                      <TableCell align="right">{a.clockOut ? minutesLabel(minutesBetween(a.clockIn, a.clockOut)) : '-'}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="text" onClick={() => setEdit({ id: a.id, clockIn: a.clockIn.slice(0, 16), clockOut: a.clockOut?.slice(0, 16) ?? '' })}>수정</Button>
                        <Button size="small" variant="text" color="error" onClick={() => remove(a)}>삭제</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Dialog open={edit != null} onClose={() => setEdit(null)} fullWidth maxWidth="xs">
        <DialogTitle>출퇴근 기록 수정</DialogTitle>
        {edit && (
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField type="datetime-local" label="출근" value={edit.clockIn} onChange={(e) => setEdit({ ...edit, clockIn: e.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField type="datetime-local" label="퇴근 (비우면 근무 중)" value={edit.clockOut} onChange={(e) => setEdit({ ...edit, clockOut: e.target.value })} InputLabelProps={{ shrink: true }} />
            </Stack>
          </DialogContent>
        )}
        <DialogActions>
          <Button variant="text" onClick={() => setEdit(null)}>취소</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!edit?.clockIn}>저장</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/* ───────── 페이지 ───────── */
const TABS = ['직원 명단', '근무 스케줄', '출퇴근 · 주휴수당'];

const Staff = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const [tab, setTab] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!storeId) return;
    employeeService.getByStore(storeId).then(setEmployees).catch(() => setError('직원 목록을 불러오지 못했습니다.'));
  }, [storeId]);
  useEffect(reload, [reload]);

  if (storeLoading) return <Box textAlign="center" py={10}><CircularProgress /></Box>;
  if (!storeId) return <Alert severity="warning">등록된 가게가 없습니다. 가게를 먼저 등록해주세요.</Alert>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1} flexWrap="wrap" gap={1}>
        <Typography variant="h4" fontWeight={800}>직원 관리</Typography>
        <Button variant="outlined" component={RouterLink} to="/clock" startIcon={<IconifyIcon icon="mingcute:time-line" />}>출퇴근 화면 열기</Button>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((t) => <Tab key={t} label={t} sx={{ fontSize: 15, fontWeight: 700 }} />)}
      </Tabs>
      {tab === 0 && <EmployeeTab storeId={storeId} employees={employees} reload={reload} onError={setError} />}
      {tab === 1 && <ScheduleTab storeId={storeId} employees={employees} onError={setError} />}
      {tab === 2 && <PayTab storeId={storeId} employees={employees} onError={setError} />}
    </Box>
  );
};

export default Staff;
