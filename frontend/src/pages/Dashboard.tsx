import { Typography, Box, Paper, Stack } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

const StatusCard = ({ title, value, icon, color, subtitle }: any) => (
  <Paper sx={{ p: 4, height: 1, bgcolor: 'background.paper' }}>
    <Stack gap={6}>
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: `${color}20`, color: color, width: 'fit-content', display: 'flex' }}>
        <IconifyIcon icon={icon} width={24} height={24} />
      </Box>
      <Box>
        <Typography variant="h4" color="common.white" mb={1}>
          {value}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color={color} sx={{ mt: 1 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  </Paper>
);

const Dashboard = ({ user }: any) => {
  const role = user?.role || 'OWNER';

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 4, color: 'common.white' }}>
        {role === 'HQ' ? '본사 관리자 대시보드' : '가맹점 대시보드'}
      </Typography>
      
      <Box display="grid" gridTemplateColumns="repeat(12, 1fr)" gap={3.5}>
        {role !== 'HQ' ? (
          <>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 3' }}>
              <StatusCard title="오늘의 매출" value="₩1,240,000" icon="mingcute:currency-line" color="#2ecc71" subtitle="+12.5% vs 어제" />
            </Box>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 3' }}>
              <StatusCard title="내일 예측 판매량" value="450건" icon="mingcute:brain-line" color="#aa3bff" subtitle="AI 수요 예측 결과" />
            </Box>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 3' }}>
              <StatusCard title="재고 부족 알림" value="3건" icon="mingcute:alert-line" color="#e67e22" subtitle="발주 필요 품목" />
            </Box>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 3' }}>
              <StatusCard title="미승인 발주" value="1건" icon="mingcute:time-line" color="#3498db" subtitle="본사 승인 대기중" />
            </Box>
            
            <Box gridColumn={{ xs: 'span 12', lg: 'span 8' }}>
               <Paper sx={{ p: 4, height: 400, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h6" color="text.secondary">주간 매출 추이 차트 영역</Typography>
               </Paper>
            </Box>
            <Box gridColumn={{ xs: 'span 12', lg: 'span 4' }}>
               <Paper sx={{ p: 4, height: 400, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h6" color="text.secondary">인기 메뉴 Top 5</Typography>
               </Paper>
            </Box>
          </>
        ) : (
          <>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 4' }}>
              <StatusCard title="전체 가맹점 매출" value="₩45,000,000" icon="mingcute:store-2-line" color="#2ecc71" subtitle="당월 누적 기준" />
            </Box>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 4' }}>
              <StatusCard title="평균 폐기율" value="12.5%" icon="mingcute:delete-2-line" color="#e74c3c" subtitle="-2.1% vs 전월" />
            </Box>
            <Box gridColumn={{ xs: 'span 12', sm: 'span 6', lg: 'span 4' }}>
              <StatusCard title="대기 중인 발주" value="14건" icon="mingcute:clipboard-line" color="#f1c40f" subtitle="승인 처리 필요" />
            </Box>

            <Box gridColumn={{ xs: 'span 12' }}>
               <Paper sx={{ p: 4, height: 500, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h6" color="text.secondary">가맹점별 성과 분석 차트 영역</Typography>
               </Paper>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
