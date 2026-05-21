import { useEffect, useState } from 'react';
import { Typography, Box, Paper, Stack, Grid, useTheme, Button, alpha, Divider, CircularProgress } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { salesService } from '../services/salesService';
import { predictionService } from '../services/predictionService';
import { storeService } from '../services/storeService';
import { notificationService } from '../services/notificationService';

const StatusCard = ({ title, value, icon, color, subtitle, trend, loading }: any) => {
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
        '&:hover': { transform: 'translateY(-4px)', boxShadow: `0 12px 24px -4px ${color}20` }
      }}
    >
      <Stack gap={2.5}>
        <Box sx={{ p: 1.25, borderRadius: 3, bgcolor: `${color}15`, color: color, width: 'fit-content', display: 'flex' }}>
          <IconifyIcon icon={icon} width={28} height={28} />
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={500} gutterBottom>{title}</Typography>
          {loading ? (
            <CircularProgress size={24} color="inherit" sx={{ color }} />
          ) : (
            <Typography variant="h3" color="text.primary" fontWeight={800}>{value}</Typography>
          )}
          <Stack direction="row" alignItems="center" gap={0.5} mt={1}>
            <Typography variant="caption" color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary'} fontWeight={700}>
              {subtitle}
            </Typography>
            {trend && <Typography variant="caption" color="text.secondary">전일 대비</Typography>}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

const ImpactItem = ({ icon, title, desc }: any) => (
  <Stack alignItems="center" textAlign="center" gap={2} p={3}>
    <Box sx={{ p: 2, borderRadius: '50%', bgcolor: 'primary.light', color: 'primary.main', display: 'flex' }}>
      <IconifyIcon icon={icon} width={40} height={40} />
    </Box>
    <Typography variant="h5" fontWeight={700} color="primary.dark">{title}</Typography>
    <Typography variant="body1" color="text.secondary">{desc}</Typography>
  </Stack>
);

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const role = user?.role || 'OWNER';

  const [todaySummary, setTodaySummary] = useState<any>(null);
  const [tomorrowQty, setTomorrowQty] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id || role === 'HQ_ADMIN') { setLoading(false); return; }
    storeService.getMyStores(user.id).then(async (stores: any[]) => {
      if (!stores?.length) { setLoading(false); return; }
      const sid = stores[0].id;
      setStoreId(sid);
      try {
        const [summary, preds, notifs] = await Promise.allSettled([
          salesService.getTodaySummary(sid),
          predictionService.getByStore(sid),
          notificationService.getUnread(sid),
        ]);
        if (summary.status === 'fulfilled') setTodaySummary(summary.value);
        if (preds.status === 'fulfilled') {
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split('T')[0];
          const tomorrowPreds = (preds.value as any[]).filter((p: any) => p.predictionDate === tomorrowStr);
          setTomorrowQty(tomorrowPreds.reduce((s: number, p: any) => s + p.predictedQty, 0));
        }
        if (notifs.status === 'fulfilled') setUnreadCount((notifs.value as any[]).length);
      } catch { /* ignore */ }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user, role]);

  const formatRevenue = (v: number) => v >= 10000 ? `₩${(v / 10000).toFixed(0)}만` : `₩${v.toLocaleString()}`;

  return (
    <Box sx={{ pb: 10, bgcolor: 'background.default' }}>
      <Paper
        sx={{
          p: { xs: 4, md: 8 }, mb: 6, borderRadius: 6, bgcolor: 'primary.dark', color: 'white',
          position: 'relative', overflow: 'hidden',
          backgroundImage: 'linear-gradient(135deg, #147A5A 0%, #3B6D11 100%)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" gap={4}>
          <Box sx={{ maxWidth: 600, zIndex: 1 }}>
            <Typography variant="h2" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
              식자재 낭비,<br />AI로 지킵니다
            </Typography>
            <Typography variant="h5" sx={{ mb: 4, opacity: 0.9, fontWeight: 400 }}>친환경 수요 예측 플랫폼, FoodGuard</Typography>
            <Button
              variant="contained" size="large"
              sx={{ bgcolor: 'white', color: 'primary.dark', fontWeight: 700, px: 6, '&:hover': { bgcolor: alpha('#fff', 0.9) } }}
              href="/predictions"
            >
              AI 예측 시작하기
            </Button>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, opacity: 0.2 }}>
            <IconifyIcon icon="mingcute:leaf-fill" width={300} height={300} />
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h4" fontWeight={800} color="text.primary" mb={4} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconifyIcon icon="mingcute:chart-bar-fill" color={theme.palette.primary.main} />
        핵심 실적 지표
      </Typography>

      <Grid container spacing={3.5} mb={8}>
        {role !== 'HQ_ADMIN' ? (
          <>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard
                title="오늘의 매출"
                value={todaySummary ? formatRevenue(todaySummary.revenue) : '₩0'}
                icon="mingcute:bank-card-line"
                color={theme.palette.primary.main}
                subtitle={todaySummary ? `${todaySummary.changeRate > 0 ? '+' : ''}${todaySummary.changeRate}%` : '-'}
                trend={todaySummary?.trend ?? 'neutral'}
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard
                title="내일 예측 판매량"
                value={tomorrowQty !== null ? `${tomorrowQty}건` : '예측 없음'}
                icon="mingcute:arrows-up-down-line"
                color={theme.palette.secondary.main}
                subtitle="AI 수요 예측"
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard
                title="오늘 판매 건수"
                value={todaySummary ? `${todaySummary.qty}건` : '0건'}
                icon="mingcute:shopping-bag-line"
                color={theme.palette.success.main}
                subtitle="실제 판매 집계"
                loading={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <StatusCard
                title="미읽은 알림"
                value={unreadCount !== null ? `${unreadCount}건` : '0건'}
                icon="mingcute:alert-line"
                color={theme.palette.warning.main}
                subtitle={unreadCount ? '확인 필요' : '없음'}
                loading={loading}
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="전체 가맹점 매출" value="대시보드 확인" icon="mingcute:store-2-line" color={theme.palette.primary.main} subtitle="통계 메뉴에서 상세 조회" loading={false} />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="네트워크 폐기율" value="AI 예측 적용중" icon="mingcute:recycle-line" color={theme.palette.secondary.main} subtitle="지속 모니터링 중" loading={false} />
            </Grid>
            <Grid item xs={12} sm={6} lg={4}>
              <StatusCard title="전체 발주 관리" value="발주 메뉴 확인" icon="mingcute:clipboard-line" color={theme.palette.warning.main} subtitle="승인 대기 발주 확인" loading={false} />
            </Grid>
          </>
        )}
      </Grid>

      <Box sx={{ mb: 8 }}>
        <Typography variant="h3" fontWeight={800} textAlign="center" color="text.primary" mb={2}>지구를 위한 약속</Typography>
        <Typography variant="h6" textAlign="center" color="text.secondary" mb={6}>FoodGuard와 함께 만드는 지속 가능한 미래</Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem icon="mingcute:delete-2-fill" title="식자재 폐기 감소" desc="AI 수요 예측을 통해 불필요한 재고를 줄이고 폐기율 15~20% 절감을 목표로 합니다." />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem icon="mingcute:pig-money-fill" title="비용 절감" desc="정확한 발주 최적화로 가맹점주님의 수익성을 향상시키고 경영 효율을 극대화합니다." />
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ height: 1, borderRadius: 5, border: `1px solid ${theme.palette.divider}` }}>
              <ImpactItem icon="mingcute:tree-2-fill" title="탄소 배출 저감" desc="음식물 쓰레기 발생량을 획기적으로 줄여 환경을 보호하고 탄소 발자국을 최소화합니다." />
            </Paper>
          </Grid>
        </Grid>
      </Box>

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
    </Box>
  );
};

export default Dashboard;
