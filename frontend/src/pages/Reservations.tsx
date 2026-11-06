import { useState } from 'react';
import { Box, Typography, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

type ReservationStatus = '예약중' | '방문완료' | '취소';

interface Reservation {
  id: number;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  note: string;
}

const MOCK_RESERVATIONS: Reservation[] = [
  { id: 1, name: '정태현', phone: '010-1234-5678', date: '2026-06-05', time: '12:00', guests: 4, status: '예약중',   note: '창가 자리 요청' },
  { id: 2, name: '서준호', phone: '010-2345-6789', date: '2026-06-05', time: '13:30', guests: 2, status: '예약중',   note: '' },
  { id: 3, name: '김지환', phone: '010-3456-7890', date: '2026-06-05', time: '18:00', guests: 6, status: '방문완료', note: '단체 예약' },
  { id: 4, name: '지현윤', phone: '010-4567-8901', date: '2026-06-05', time: '19:30', guests: 3, status: '취소',     note: '' },
  { id: 5, name: '몽흐데르겔', phone: '010-5678-9012', date: '2026-06-06', time: '12:00', guests: 5, status: '예약중',   note: '알레르기: 견과류' },
  { id: 6, name: '정태현', phone: '010-1234-5678', date: '2026-06-06', time: '18:30', guests: 2, status: '예약중',   note: '' },
  { id: 7, name: '서준호', phone: '010-2345-6789', date: '2026-06-07', time: '13:00', guests: 4, status: '예약중',   note: '생일 파티' },
];

const STATUS_STYLE: Record<ReservationStatus, { bgcolor: string; color: string; border: string }> = {
  '예약중':   { bgcolor: '#EEF4FF', color: '#1976D2', border: '#BBCFFF' },
  '방문완료': { bgcolor: '#F1F8F5', color: '#1D9E75', border: '#A5D6BC' },
  '취소':     { bgcolor: '#FFF5F5', color: '#E53935', border: '#FFCDD2' },
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

const Reservations = () => {
  const [filter, setFilter] = useState<ReservationStatus | '전체'>('전체');

  const today = new Date().toISOString().split('T')[0];
  const todayCount = MOCK_RESERVATIONS.filter((r) => r.date === today && r.status === '예약중').length;
  const totalCount = MOCK_RESERVATIONS.filter((r) => r.status === '예약중').length;
  const doneCount  = MOCK_RESERVATIONS.filter((r) => r.status === '방문완료').length;

  const filtered = filter === '전체'
    ? MOCK_RESERVATIONS
    : MOCK_RESERVATIONS.filter((r) => r.status === filter);

  const FILTERS: Array<ReservationStatus | '전체'> = ['전체', '예약중', '방문완료', '취소'];

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: '#EEF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconifyIcon icon="mingcute:calendar-2-line" width={22} height={22} color="#1976D2" />
        </Box>
        <Box>
          <Typography fontWeight={800} fontSize={20} color="#1A1C1E">예약 현황</Typography>
          <Typography fontSize={12} color="#44474E">전체 예약 내역을 확인하고 관리하세요</Typography>
        </Box>
      </Box>

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
            {f}
          </Button>
        ))}
      </Box>

      {/* 테이블 */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #E8EAF0' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: '#F8F9FA' }}>
              {['예약자', '연락처', '날짜', '시간', '인원', '상태', '메모'].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: '#44474E', borderBottom: '1px solid #E8EAF0', py: 1.5 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => {
              const s = STATUS_STYLE[r.status];
              return (
                <TableRow key={r.id} sx={{ '&:hover': { bgcolor: '#F8FAFF' }, '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13, color: '#1A1C1E', py: 1.5 }}>{r.name}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#44474E', py: 1.5 }}>{r.phone}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#44474E', py: 1.5 }}>{r.date}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#1A1C1E', py: 1.5 }}>{r.time}</TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 600, color: '#1A1C1E', py: 1.5 }}>{r.guests}명</TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={r.status}
                      size="small"
                      sx={{ bgcolor: s.bgcolor, color: s.color, border: `1px solid ${s.border}`, fontWeight: 700, fontSize: 11, height: 22 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: '#8E9199', py: 1.5 }}>{r.note || '-'}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: '#8E9199', fontSize: 13 }}>
                  해당 상태의 예약이 없습니다
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Reservations;
