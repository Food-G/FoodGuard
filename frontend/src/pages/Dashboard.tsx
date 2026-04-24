import { Typography, Box, Paper, Stack, Grid, useTheme } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

const StatusCard = ({ title, value, icon, color, subtitle, trend }: any) => {
  const theme = useTheme();
  return (
    <Paper 
      elevation={0}
      sx={{ 
        p: 3, 
        height: 1, 
        borderRadius: 4,
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px -4px rgba(46, 125, 50, 0.12)'
        }
      }}
    >
      <Stack gap={2.5}>
        <Box 
          sx={{ 
            p: 1.25, 
            borderRadius: 3, 
            bgcolor: `${color}15`, 
            color: color, 
            width: 'fit-content', 
            display: 'flex' 
          }}
        >
          <IconifyIcon icon={icon} width={28} height={28} />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>
            {title}
          </Typography>
          <Typography variant="h3" color="text.primary" fontWeight={700}>
            {value}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5} mt={1}>
            <Typography variant="caption" color={trend === 'up' ? 'success.main' : 'error.main'} fontWeight={600}>
              {subtitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              전일 대비
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const role = user?.role || 'OWNER';

  return (
    <Box sx={{ pb: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" mb={5}>
        <Box>
          <Typography variant="h3" fontWeight={800} color="primary.dark" gutterBottom>
            FoodGuard {role === 'HQ' ? '본사 관리' : '가맹점 대시보드'}
          </Typography>
          <Typography variant="h6" color="text.secondary" fontWeight={500}>
            {role === 'HQ' 
              ? '전체 네트워크의 데이터 분석 및 지속 가능한 성장을 관리합니다.' 
              : `반갑습니다, 점주님! 오늘 발생할 수 있는 식자재 폐기를 ${'24%'} 줄일 수 있습니다.`}
          </Typography>
        </Box>
      </Stack>
      
      <Grid container spacing={3.5}>
        {role !== 'HQ' ? (
          <>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="오늘의 매출" value="₩1,240,000" icon="mingcute:currency-line" color={theme.palette.primary.main} subtitle="+12.5%" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="내일 예측 판매량" value="450건" icon="mingcute:brain-line" color={theme.palette.info.main} subtitle="AI 예측" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="재고 부족 알림" value="3건" icon="mingcute:alert-line" color={theme.palette.warning.main} subtitle="발주 필요" trend="down" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="미승인 발주" value="1건" icon="mingcute:time-line" color={theme.palette.secondary.main} subtitle="처리 대기" trend="up" />
            </Grid>
            
            <Grid item xs={12} lg={8}>
               <Paper sx={{ p: 4, height: 450, borderRadius: 5, border: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" color="text.primary" fontWeight={700} mb={3}>주간 매출 및 폐기 절감 추이</Typography>
                  <Box sx={{ flexGrow: 1, bgcolor: 'grey.50', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.disabled">환경 보호를 위한 데이터 차트 영역</Typography>
                  </Box>
               </Paper>
            </Grid>
            <Grid item xs={12} lg={4}>
               <Paper sx={{ p: 4, height: 450, borderRadius: 5, border: `1px solid ${theme.palette.divider}`, display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="h6" color="text.primary" fontWeight={700} mb={3}>인기 메뉴 Top 5</Typography>
                  <Stack gap={2}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Stack key={i} direction="row" justifyContent="space-between" alignItems="center" p={1.5} sx={{ bgcolor: 'background.default', borderRadius: 2 }}>
                        <Typography variant="body2" fontWeight={600}>시그니처 메뉴 {i}</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700}>{100 - i * 5}건</Typography>
                      </Stack>
                    ))}
                  </Stack>
               </Paper>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="전체 가맹점 매출" value="₩45M" icon="mingcute:store-2-line" color={theme.palette.primary.main} subtitle="전월 대비 8% 상승" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="네트워크 평균 폐기율" value="8.2%" icon="mingcute:delete-2-line" color={theme.palette.error.main} subtitle="환경 보호 지수 개선됨" trend="down" />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="승인 대기 발주" value="14건" icon="mingcute:clipboard-line" color={theme.palette.warning.main} subtitle="즉시 처리 필요" trend="up" />
            </Grid>

            <Grid item xs={12}>
               <Paper sx={{ p: 4, height: 500, borderRadius: 5, border: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h6" color="text.secondary">본사 통합 데이터 관리 그리드 영역</Typography>
               </Paper>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;
