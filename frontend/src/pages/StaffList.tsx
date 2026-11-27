import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  Paper, Stack, TextField, Typography, alpha,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import AlertMessages from '../components/AlertMessages';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import {
  DAYS, Staff, StaffInput, daysOf, staffColor, staffError, staffService,
} from '../services/staffService';

const ROLE_SUGGEST = ['매니저', '주방', '홀', '파트타임'];
const EMPTY: StaffInput = { name: '', role: '', workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], startTime: '09:00', endTime: '18:00' };

/** 직원 추가·수정 창 */
const StaffDialog = ({ open, isEdit, initial, onClose, onSave }: {
  open: boolean; isEdit: boolean; initial: StaffInput; onClose: () => void; onSave: (v: StaffInput) => Promise<void>;
}) => {
  const [v, setV] = useState<StaffInput>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setV(initial); }, [open, initial]);

  const toggleDay = (code: string) => setV((p) => ({
    ...p, workDays: p.workDays.includes(code) ? p.workDays.filter((d) => d !== code) : [...p.workDays, code],
  }));
  const problem = !v.name.trim() ? '이름을 입력해 주세요.'
    : !v.role.trim() ? '역할을 입력해 주세요.'
      : v.workDays.length === 0 ? '근무 요일을 하루 이상 골라 주세요.'
        : v.endTime <= v.startTime ? '퇴근 시간은 출근 시간보다 늦어야 해요.' : '';

  const save = async () => {
    if (problem) return;
    setSaving(true);
    try { await onSave({ ...v, name: v.name.trim(), role: v.role.trim() }); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? '직원 정보 수정' : '직원 추가'}</DialogTitle>
      <DialogContent>
        {/* 테마의 입력칸 왼쪽 여백(24px)을 이 창에서는 없앤다 */}
        <Stack gap={2.2} mt={1} sx={{ '& .MuiOutlinedInput-input': { ml: 0 } }}>
          <TextField label="이름" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} size="small" fullWidth autoFocus inputProps={{ maxLength: 50 }} />
          <Box>
            <TextField label="역할" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })} size="small" fullWidth inputProps={{ maxLength: 30 }} />
            <Stack direction="row" gap={0.6} mt={0.8} flexWrap="wrap">
              {ROLE_SUGGEST.map((r) => (
                <Box key={r} onClick={() => setV({ ...v, role: r })} sx={{
                  px: 1.1, py: 0.3, borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  bgcolor: v.role === r ? 'primary.main' : '#F4F6FA', color: v.role === r ? 'common.white' : 'text.secondary',
                }}>{r}</Box>
              ))}
            </Stack>
          </Box>
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={0.8}>근무 요일</Typography>
            <Stack direction="row" gap={0.6}>
              {DAYS.map((d) => {
                const on = v.workDays.includes(d.code);
                const weekend = d.code === 'SAT' || d.code === 'SUN';
                return (
                  <Box key={d.code} role="button" aria-pressed={on} onClick={() => toggleDay(d.code)} sx={{
                    flex: 1, height: 38, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, userSelect: 'none', transition: 'all .15s',
                    bgcolor: on ? 'primary.main' : '#F4F6FA',
                    color: on ? 'common.white' : weekend ? '#D0457F' : 'text.secondary',
                  }}>{d.label}</Box>
                );
              })}
            </Stack>
          </Box>
          <Box>
            <Typography fontSize={13} fontWeight={700} color="text.secondary" mb={0.8}>근무 시간</Typography>
            <Stack direction="row" alignItems="center" gap={1}>
              <TextField type="time" label="출근" value={v.startTime} onChange={(e) => setV({ ...v, startTime: e.target.value })} size="small" fullWidth InputLabelProps={{ shrink: true }} />
              <Typography color="text.disabled">–</Typography>
              <TextField type="time" label="퇴근" value={v.endTime} onChange={(e) => setV({ ...v, endTime: e.target.value })} size="small" fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
          </Box>
          {problem && <Typography fontSize={12.5} color="warning.main">{problem}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">취소</Button>
        <Button variant="contained" onClick={save} disabled={!!problem || saving}>{saving ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  );
};

const StaffList = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<{ target: Staff | null; initial: StaffInput } | null>(null);

  const load = useCallback(async (sid: number) => {
    try { setStaff(await staffService.getByStore(sid)); } catch (e) { setError(staffError(e, '직원 목록을 불러오지 못했어요.')); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    load(storeId);
  }, [storeId, storeLoading, load]);

  const handleSave = async (v: StaffInput) => {
    if (!storeId || !editing) return;
    try {
      if (editing.target) await staffService.update(editing.target.id, v);
      else await staffService.create(storeId, v);
      setSuccess(editing.target ? `${v.name}님 정보를 수정했어요.` : `${v.name}님을 직원으로 추가했어요.`);
      setEditing(null);
      await load(storeId);
    } catch (e) { setError(staffError(e, '저장하지 못했어요.')); }
  };

  const handleDelete = async (s: Staff) => {
    if (!storeId || !await confirm(`${s.name}님을 직원 목록에서 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await staffService.remove(s.id);
      setSuccess(`${s.name}님을 삭제했어요.`);
      await load(storeId);
    } catch (e) { setError(staffError(e, '삭제하지 못했어요.')); }
  };

  return (
    <Stack gap={2}>
      <AlertMessages error={error} success={success} onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />
      <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}>
        <Stack direction="row" alignItems="center" gap={1} mb={2}>
          <Typography variant="h6" fontWeight={700} flex={1}>직원 {staff.length}명</Typography>
          <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:user-add-2-line" width={18} />} disabled={!storeId}
            onClick={() => setEditing({ target: null, initial: EMPTY })}>
            직원 추가
          </Button>
        </Stack>

        {loading ? <Box textAlign="center" py={5}><CircularProgress size={28} /></Box>
          : !storeId ? <Typography color="text.secondary" textAlign="center" py={5}>매장을 먼저 등록해 주세요.</Typography>
            : staff.length === 0 ? (
              <Stack alignItems="center" gap={1} py={5}>
                <IconifyIcon icon="mingcute:group-line" width={36} sx={{ color: 'text.disabled' }} />
                <Typography fontWeight={800}>아직 등록된 직원이 없어요</Typography>
                <Typography fontSize={13} color="text.secondary">오른쪽 위 ‘직원 추가’로 근무 요일과 시간을 넣어 보세요.</Typography>
              </Stack>
            ) : staff.map((st, i) => {
              const color = staffColor(st);
              return (
                <Stack key={st.id} direction="row" gap={1.5} alignItems="center" sx={{ py: 1.5, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
                  <Box sx={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(color, 0.14), color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
                  }}>
                    {st.name[0]}
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Stack direction="row" alignItems="center" gap={0.8}>
                      <Typography fontSize={14.5} fontWeight={800}>{st.name}</Typography>
                      <Typography fontSize={12.5} color="text.secondary">{st.role}</Typography>
                    </Stack>
                    <Stack direction="row" gap={0.4} mt={0.6} flexWrap="wrap" alignItems="center">
                      {DAYS.map((d) => {
                        const on = daysOf(st).includes(d.code);
                        return (
                          <Box key={d.code} sx={{
                            width: 22, height: 22, borderRadius: '6px', fontSize: 11.5, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            bgcolor: on ? alpha(color, 0.14) : '#F4F6FA', color: on ? color : '#C3C8D4',
                          }}>{d.label}</Box>
                        );
                      })}
                      <Typography fontSize={12.5} color="text.secondary" ml={0.8}>{st.startTime}–{st.endTime}</Typography>
                    </Stack>
                  </Box>
                  <IconButton aria-label={`${st.name} 수정`} title="수정" size="small"
                    onClick={() => setEditing({ target: st, initial: { name: st.name, role: st.role, workDays: daysOf(st), startTime: st.startTime, endTime: st.endTime } })}>
                    <IconifyIcon icon="mingcute:edit-2-line" width={18} />
                  </IconButton>
                  <IconButton aria-label={`${st.name} 삭제`} title="삭제" size="small" onClick={() => handleDelete(st)} sx={{ color: 'error.main' }}>
                    <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                  </IconButton>
                </Stack>
              );
            })}
      </Paper>

      <StaffDialog open={!!editing} isEdit={!!editing?.target} initial={editing?.initial ?? EMPTY} onClose={() => setEditing(null)} onSave={handleSave} />
    </Stack>
  );
};

export default StaffList;
