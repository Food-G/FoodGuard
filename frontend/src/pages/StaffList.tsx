import { Box, Paper, Stack, Typography, Chip, alpha } from '@mui/material';

// ── 직원 (예시 데이터: 근태 기능이 생기면 API 로 교체) ──
export const STAFF = [
  { name: '정태현', role: '매니저', start: '09:00', end: '18:00', clockIn: '08:52', color: '#1D9E75' },
  { name: '김지환', role: '주방', start: '10:00', end: '19:00', clockIn: '10:07', color: '#2F7DD1' },
  { name: '지현윤', role: '홀', start: '11:00', end: '20:00', clockIn: '10:55', color: '#D0457F' },
  { name: '서준호', role: '파트타임', start: '17:00', end: '22:00', clockIn: '16:58', color: '#6A4BD1' },
];

const StaffList = () => (
  <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '10px' }}>
    <Stack direction="row" alignItems="center" gap={1} mb={2}>
      <Typography variant="h6" fontWeight={700}>직원 {STAFF.length}명</Typography>
      <Chip label="예시 데이터" size="small" />
    </Stack>
    {STAFF.map((st, i) => (
      <Stack key={st.name} direction="row" gap={1.5} alignItems="center" sx={{ py: 1.5, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(st.color, 0.14), color: st.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15,
        }}>
          {st.name[0]}
        </Box>
        <Box flex={1} minWidth={0}>
          <Typography fontSize={14.5} fontWeight={800}>{st.name}</Typography>
          <Typography fontSize={12.5} color="text.secondary">{st.role}</Typography>
        </Box>
        <Typography fontSize={13} color="text.secondary" sx={{ flexShrink: 0 }}>근무 {st.start}–{st.end}</Typography>
      </Stack>
    ))}
  </Paper>
);

export default StaffList;
