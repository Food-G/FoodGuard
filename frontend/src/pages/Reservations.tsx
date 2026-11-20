import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button,
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { errorText } from '../services/agentService';
import { reservationService, Reservation, ReservationStatus, STATUS_LABEL } from '../services/reservationService';
import { hhmm, localDate } from '../helpers/date';

const STATUS_STYLE: Record<ReservationStatus, { bgcolor: string; color: string; border: string }> = {
  RESERVED:  { bgcolor: '#EEF4FF', color: '#1976D2', border: '#BBCFFF' },
  VISITED:   { bgcolor: '#F1F8F5', color: '#1D9E75', border: '#A5D6BC' },
  CANCELLED: { bgcolor: '#FFF5F5', color: '#E53935', border: '#FFCDD2' },
};

const StatCard = ({ icon, iconColor, label, value }: { icon: string; iconColor: string; label: string; value: number }) => (
  <Box sx={{ flex: 1, borderRadius: 3, bgcolor: '#fff', border: '1px solid #E8EAF0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconifyIcon icon={icon} width={22} height={22} color={iconColor} />
    </Box>
    <Box>
      <Typography fontSize={22} fontWeight={800} color="#1A1C1E" lineHeight={1}>{value}</Typography>
      <Typography fontSize={12} color="#44474E" fontWeight={500} sx={{ mt: 0.3 }}>{label}</Typography>
    </Box>
  </Box>
);

interface Form { customerName: string; phone: string; reservationDate: string; reservationTime: string; guests: string; note: string }

const Reservations = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const [list, setList] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<ReservationStatus | 'ALL'>('ALL');
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!storeId) return;
    reservationService.getByStore(storeId).then(setList).catch(() => setError('예약 목록을 불러오지 못했습니다.'));
  }, [storeId]);
  useEffect(reload, [reload]);

  if (storeLoading) return <Box textAlign="center" py={10}><CircularProgress /></Box>;
  if (!storeId) return <Alert severity="warning">등록된 가게가 없습니다. 가게를 먼저 등록해주세요.</Alert>;

  const today = localDate(new Date());
  const todayCount = list.filter((r) => r.reservationDate === today && r.status === 'RESERVED').length;
  const totalCount = list.filter((r) => r.status === 'RESERVED').length;
  const doneCount  = list.filter((r) => r.status === 'VISITED').length;
  const filtered = filter === 'ALL' ? list : list.filter((r) => r.status === filter);
  const FILTERS: Array<ReservationStatus | 'ALL'> = ['ALL', 'RESERVED', 'VISITED', 'CANCELLED'];

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

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconifyIcon icon="mingcute:calendar-2-line" width={22} height={22} color="#1976D2" />
        </Box>
        <Box>
          <Typography fontWeight={800} fontSize={20} color="#1A1C1E">예약 현황</Typography>
          <Typography fontSize={12} color="#44474E">최근 30일부터의 예약을 확인하고 관리하세요</Typography>
        </Box>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" />} sx={{ ml: 'auto' }}
          onClick={() => setForm({ customerName: '', phone: '', reservationDate: today, reservationTime: '18:00', guests: '2', note: '' })}>
          예약 추가
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      {/* 통계 카드 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard icon="mingcute:calendar-2-line"  iconColor="#1976D2" label="오늘 예약"    value={todayCount} />
        <StatCard icon="mingcute:time-line"         iconColor="#FF9800" label="전체 대기 중" value={totalCount} />
        <StatCard icon="mingcute:check-circle-fill" iconColor="#1D9E75" label="방문 완료"   value={doneCount} />
      </Box>

      {/* 필터 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="small"
            onClick={() => setFilter(f)}
            sx={{
              borderRadius: 99,
              px: 2,
              py: 0.6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'none',
              bgcolor: filter === f ? '#1976D2' : '#F4F6F8',
              color: filter === f ? '#fff' : '#44474E',
              border: '1px solid',
              borderColor: filter === f ? '#1976D2' : '#E8EAF0',
              '&:hover': { bgcolor: filter === f ? '#1565C0' : '#EAECEF' },
            }}
          >
            {f === 'ALL' ? '전체' : STATUS_LABEL[f]}
          </Button>
        ))}
      </Box>

      {/* 테이블 */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #E8EAF0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F8F9FA' }}>
              {['예약자', '연락처', '날짜', '시간', '인원', '상태', '메모', ''].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: '#44474E', borderBottom: '1px solid #E8EAF0', py: 1.5 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: '#F8FAFF' }, '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13, color: '#1A1C1E', py: 1.5 }}>{r.customerName}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#44474E', py: 1.5 }}>{r.phone || '-'}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#44474E', py: 1.5 }}>{r.reservationDate}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#1A1C1E', py: 1.5 }}>{hhmm(r.reservationTime)}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#1A1C1E', py: 1.5 }}>{r.guests}명</TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={STATUS_LABEL[r.status]}
                      size="small"
                      sx={{ bgcolor: s.bgcolor, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700, fontSize: 11, height: 22 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#8E9199', py: 1.5 }}>{r.note || '-'}</TableCell>
                  <TableCell sx={{ py: 1, whiteSpace: 'nowrap' }} align="right">
                    {r.status === 'RESERVED' && (
                      <>
                        <Button size="small" variant="text" onClick={() => setStatus(r, 'VISITED')}>방문완료</Button>
                        <Button size="small" variant="text" color="error" onClick={() => setStatus(r, 'CANCELLED')}>취소</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 5, color: '#8E9199', fontSize: 13 }}>
                  {list.length === 0 ? "예약이 없습니다. '예약 추가'로 등록하세요." : '해당 상태의 예약이 없습니다'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
    </Box>
  );
};

export default Reservations;
