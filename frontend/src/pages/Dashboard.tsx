import { Typography, Box, Paper, Stack, Grid, useTheme, Button, alpha, Divider } from '@mui/material';
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
          boxShadow: `0 12px 24px -4px ${color}20`        }
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
          <Typography variant="h3" color="text.primary" fontWeight={800}>
            {value}
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5} mt={1}>
            <Typography variant="caption" color={trend === 'up' ? 'success.main' : 'error.main'} fontWeight={700}>
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

const ImpactItem = ({ icon, title, desc }: any) => {
  return (
    <Stack alignItems="center" textAlign="center" gap={2} p={3}>
      <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', display: 'flex' }}>
        <IconifyIcon icon={icon} width={40} height={40} />
      </Box>
      <Typography variant="h5" fontWeight={700} color="primary.dark">{title}</Typography>
      <Typography variant="body1" color="text.secondary">{desc}</Typography>
    </Stack>
  );
};

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const role = user?.role || 'OWNER';

  return (
    <Box sx={{ pb: 10, bgcolor: 'background.default' }}>
      {/* Hero Section */}
      <Paper 
        sx={{ 
          p: { xs: 4, md: 8 }, 
          mb: 6, 
          borderRadius: 6, 
          bgcolor: 'primary.dark', 
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'linear-gradient(135deg, #147A5A 0%, #3B6D11 100%)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" gap={4}>
          <Box sx={{ maxWidth: 600, zIndex: 1 }}>
            <Typography variant="h2" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
              식자재 낭비,<br />AI로 지킵니다
            </Typography>
            <Typography variant="h5" sx={{ mb: 4, opacity: 0.9, fontWeight: 400 }}>
              친환경 수요 예측 플랫폼, FoodGuard
            </Typography>
            <Button 
              variant="contained" 
              size="large" 
              sx={{ 
                bgcolor: 'white', 
                color: 'primary.dark', 
                fontWeight: 700, 
                px: 6, 
                '&:hover': { bgcolor: alpha('#fff', 0.9) } 
              }}
            >
              데모 체험하기
            </Button>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, opacity: 0.2 }}>
            <IconifyIcon icon="mingcute:leaf-fill" width={300} height={300} />
          </Box>
        </Stack>
      </Paper>

      {/* Stats Grid */}
      <Typography variant="h4" fontWeight={800} color="text.primary" mb={4} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconifyIcon icon="mingcute:chart-bar-fill" color={theme.palette.primary.main} />
        핵심 실적 지표
      </Typography>
      
      <Grid container spacing={3.5} mb={8}>
        {role !== 'HQ_ADMIN' ? (
          <>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="오늘의 매출" value="₩1,240,000" icon="mingcute:bank-card-line" color={theme.palette.primary.main} subtitle="+12.5%" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="내일 예측 판매량" value="450건" icon="mingcute:arrows-up-down-line" color={theme.palette.secondary.main} subtitle="순환 알고리즘" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="재고 부족 알림" value="3건" icon="mingcute:alert-line" color={theme.palette.warning.main} subtitle="즉시 확인 필요" trend="down" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard title="미승인 발주" value="1건" icon="mingcute:time-line" color={theme.palette.info.main} subtitle="본사 검토 중" trend="up" />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="전체 가맹점 매출" value="₩45M" icon="mingcute:store-2-line" color={theme.palette.primary.main} subtitle="지속 가능 성장 중" trend="up" />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="네트워크 평균 폐기율" value="8.2%" icon="mingcute:recycle-line" color={theme.palette.secondary.main} subtitle="순환 경제 지수 개선" trend="down" />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="승인 대기 발주" value="14건" icon="mingcute:clipboard-line" color={theme.palette.warning.main} subtitle="즉시 승인 권장" trend="up" />
            </Grid>
          </>
        )}
      </Grid>

      {/* Impact Section */}
      <Box sx={{ mb: 8 }}>
        <Typography variant="h3" fontWeight={800} textAlign="center" color="text.primary" mb={2}>지구를 위한 약속</Typography>
        <Typography variant="h6" textAlign="center" color="text.secondary" mb={6}>FoodGuard와 함께 만드는 지속 가능한 미래</Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem 
                icon="mingcute:delete-2-fill" 
                title="식자재 폐기 감소" 
                desc="AI 수요 예측을 통해 불필요한 재고를 줄이고 폐기율 15~20% 절감을 목표로 합니다." 
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem 
                icon="mingcute:pig-money-fill" 
                title="비용 절감" 
                desc="정확한 발주 최적화로 가맹점주님의 수익성을 향상시키고 경영 효율을 극대화합니다." 
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem 
                icon="mingcute:tree-2-fill" 
                title="탄소 배출 저감" 
                desc="음식물 쓰레기 발생량을 획기적으로 줄여 환경을 보호하고 탄소 발자국을 최소화합니다." 
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Tech Stack Section */}
      <Divider sx={{ mb: 8 }} />
      <Stack direction="row" flexWrap="wrap" justifyContent="center" alignItems="center" gap={6} sx={{ opacity: 0.7 }}>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="logos:spring-icon" width={32} />
          <Typography variant="h6" fontWeight={700}>Spring Boot</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="logos:python" width={32} />
          <Typography variant="h6" fontWeight={700}>Python AI</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="logos:react" width={32} />
          <Typography variant="h6" fontWeight={700}>React</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="logos:mysql-icon" width={32} />
          <Typography variant="h6" fontWeight={700}>MySQL</Typography>
        </Stack>
      </Stack>
    </Box>  );
};

export default Dashboard;
