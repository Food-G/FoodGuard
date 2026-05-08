import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Stack, Grid, Chip,
  CircularProgress, LinearProgress, Divider, Avatar,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { storeService } from '../services/storeService';
import { inventoryService } from '../services/inventoryService';
import { api } from '../services/api';

/* ────────── 유틸 ────────── */
const formatKRW = (v: number) =>
  v >= 1_000_000
    ? `₩${(v / 1_000_000).toFixed(1)}M`
    : `₩${Number(v).toLocaleString('ko-KR')}`;

const today = () => {
  const d = new Date();
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
};

/* ────────── 통계 카드 ────────── */
const StatCard = ({ title, value, sub, icon, grad, loading }: any) => (
  <Paper
    elevation={0}
    sx={{
      p: 3, borderRadius: 4, height: 1,
      background: 'background.paper',
      border: '1px solid',
      borderColor: 'divider',
      transition: 'transform .2s, box-shadow .2s',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(0,0,0,.12)' },
      position: 'relative', overflow: 'hidden',
    }}
  >
    {/* 배경 장식 */}
    <Box sx={{
      position: 'absolute', top: -20, right: -20,
      width: 100, height: 100, borderRadius: '50%',
      background: grad, opacity: 0.08,
    }} />

    <Stack gap={2}>
      <Box sx={{
        width: 48, height: 48, borderRadius: 3,
        background: grad, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 14px rgba(0,0,0,.15)`,
      }}>
        <IconifyIcon icon={icon} color="white" width={26} height={26} />
      </Box>
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {title}
        </Typography>
        {loading ? (
          <Box sx={{ mt: 1 }}><LinearProgress sx={{ borderRadius: 2, height: 6 }} /></Box>
        ) : (
          <Typography variant="h4" fontWeight={800} color="text.primary" mt={0.5}>
            {value}
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
          {sub}
        </Typography>
      </Box>
    </Stack>
  </Paper>
);

/* ────────── 재고 바 아이템 ────────── */
const InventoryBar = ({ name, qty, unit, price, max }: any) => {
  const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 0;
  const total = qty * price;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.5}>
        <Typography variant="body2" fontWeight={600}>{name}</Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {qty} {unit}
          </Typography>
          {price > 0 && (
            <Typography variant="caption" fontWeight={700} color="primary.main">
              {total.toLocaleString('ko-KR')}원
            </Typography>
          )}
        </Stack>      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8, borderRadius: 4,
          bgcolor: 'grey.100',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            background: pct < 20
              ? 'linear-gradient(90deg,#f44336,#ff7043)'
              : pct < 50
              ? 'linear-gradient(90deg,#ff9800,#ffc107)'
              : 'linear-gradient(90deg,#43a047,#1e88e5)',
          },
        }}
      />
    </Box>
  );
};

/* ────────── 메인 컴포넌트 ────────── */const Dashboard = ({ user }: any) => {
  const role = user?.role || 'OWNER';
  const [loading, setLoading] = useState(true);
  const [dashData, setDashData] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const uid = user?.userId ?? user?.id;
        if (!uid) return;

        if (role !== 'HQ') {
          const stores = await storeService.getMyStores(uid);
          if (stores?.length > 0) {
            const sid = stores[0].id;
            setStoreId(sid);
            setStoreName(stores[0].storeName ?? '내 매장');

            const [dash, inv] = await Promise.all([
              api.get(`/dashboard/store/${sid}`),
              inventoryService.getByStore(sid),
            ]);
            setDashData(dash);
            setInventory(
              (inv || []).sort((a: any, b: any) => b.id - a.id).slice(0, 8)
            );
          }
        } else {
          const dash = await api.get('/dashboard/hq');
          setDashData(dash);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const maxQty = Math.max(
    ...inventory.map((i: any) => Number(i.currentQty ?? 0)), 1
  );

  /* ────── OWNER 대시보드 ────── */
  if (role !== 'HQ') {
    return (
      <Box sx={{ pb: 4 }}>
        {/* ── Hero 헤더 ── */}
        <Paper
          elevation={0}
          sx={{
            mb: 4, p: { xs: 3, sm: 4 }, borderRadius: 5,
            background: 'linear-gradient(135deg, #1b5e20 0%, #0d47a1 100%)',
            color: 'white', position: 'relative', overflow: 'hidden',
          }}
        >
          {/* 배경 원형 장식 */}
          {[
            { size: 220, top: -80, right: -60, opacity: 0.08 },
            { size: 140, bottom: -50, right: 120, opacity: 0.06 },
            { size: 80, top: 20, right: 200, opacity: 0.1 },
          ].map((c, i) => (
            <Box key={i} sx={{
              position: 'absolute', borderRadius: '50%',
              width: c.size, height: c.size,
              top: c.top, bottom: (c as any).bottom, right: c.right,
              background: 'white', opacity: c.opacity,
            }} />
          ))}

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
            <Box>
              <Stack direction="row" alignItems="center" gap={1.5} mb={1}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '10px',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconifyIcon icon="mingcute:leaf-fill" color="white" width={22} />
                </Box>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.5px' }}>
                  FoodGuard
                </Typography>
              </Stack>
              <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                안녕하세요, 점주님!
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>
                {storeName && `${storeName} · `}{today()}
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" gap={1.5}
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', px: 2.5, py: 1.5, borderRadius: 3 }}>
              <IconifyIcon icon="mingcute:leaf-fill" color="rgba(255,255,255,0.8)" width={20} />
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>오늘의 절감 목표</Typography>
                <Typography variant="body2" fontWeight={700}>식자재 폐기 0건</Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {/* ── 통계 카드 4개 ── */}
        <Grid container spacing={3} mb={4}>
          {[
            {
              title: '주간 매출',
              value: loading ? '...' : formatKRW(dashData?.weeklyRevenue ?? 0),
              sub: `판매 ${dashData?.weeklySalesCount ?? 0}건`,
              icon: 'mingcute:currency-line',
              grad: 'linear-gradient(135deg,#43a047,#66bb6a)',
            },
            {
              title: '월간 매출',
              value: loading ? '...' : formatKRW(dashData?.monthlyRevenue ?? 0),
              sub: '이번 달 누계',
              icon: 'mingcute:chart-bar-fill',
              grad: 'linear-gradient(135deg,#1e88e5,#42a5f5)',
            },
            {
              title: '재고 부족',
              value: loading ? '...' : `${dashData?.lowStockCount ?? 0}건`,
              sub: '최소 임계값 이하',
              icon: 'mingcute:alert-line',
              grad: dashData?.lowStockCount > 0
                ? 'linear-gradient(135deg,#f44336,#ef9a9a)'
                : 'linear-gradient(135deg,#78909c,#b0bec5)',
            },
            {
              title: '대기 발주',
              value: loading ? '...' : `${dashData?.pendingOrderCount ?? 0}건`,
              sub: '승인 대기 중',
              icon: 'mingcute:time-line',
              grad: 'linear-gradient(135deg,#fb8c00,#ffa726)',
            },
          ].map((card) => (
            <Grid item xs={12} sm={6} lg={3} key={card.title}>
              <StatCard {...card} loading={loading} />
            </Grid>
          ))}
        </Grid>

        {/* ── 본문 2열 ── */}
        <Grid container spacing={3}>
          {/* 재고 현황 바 차트 */}
          <Grid item xs={12} lg={8}>
            <Paper elevation={0} sx={{ p: 3.5, borderRadius: 4, border: '1px solid', borderColor: 'divider', height: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>재고 현황</Typography>
                  <Typography variant="caption" color="text.secondary">
                    최근 등록순 상위 8개 · 바 길이 = 상대 재고량
                  </Typography>
                </Box>
                <Chip
                  icon={<IconifyIcon icon="mingcute:inventory-line" width={14} height={14} />}
                  label={`총 ${inventory.length}품목`}
                  size="small"
                  sx={{ bgcolor: 'primary.50', color: 'primary.main', fontWeight: 600 }}
                />
              </Stack>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                  <CircularProgress size={36} />
                </Box>
              ) : inventory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <IconifyIcon icon="mingcute:inventory-line" width={52} height={52} color="text.disabled" />
                  <Typography color="text.secondary" mt={1}>
                    등록된 재고가 없습니다.
                  </Typography>
                </Box>
              ) : (
                <Stack gap={2.5}>
                  {inventory.map((item: any) => (
                    <InventoryBar
                      key={item.id}
                      name={item.ingredient?.name ?? '-'}
                      qty={Number(item.currentQty ?? 0)}
                      unit={item.unit ?? '개'}
                      price={Number(item.price ?? 0)}
                      max={maxQty}
                    />
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* 우측 패널 */}
          <Grid item xs={12} lg={4}>
            <Stack gap={3} height={1}>
              {/* 재고 부족 경보 */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider', flex: 1 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                  <Typography variant="subtitle1" fontWeight={700}>재고 부족 경보</Typography>
                  {(dashData?.lowStockItems?.length ?? 0) > 0 && (
                    <Chip label={dashData.lowStockItems.length} size="small" color="error" sx={{ ml: 'auto', fontWeight: 700 }} />
                  )}
                </Stack>

                {loading ? (
                  <LinearProgress sx={{ borderRadius: 2 }} />
                ) : !dashData?.lowStockItems?.length ? (
                  <Stack alignItems="center" gap={1} py={2}>
                    <IconifyIcon icon="mingcute:check-circle-fill" width={36} height={36} color="success.main" />
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      모든 재고 정상
                    </Typography>
                  </Stack>
                ) : (
                  <Stack gap={1.5}>
                    {dashData.lowStockItems.map((item: any, idx: number) => (
                      <Stack key={idx} direction="row" justifyContent="space-between" alignItems="center"
                        sx={{ p: 1.5, bgcolor: 'error.50', borderRadius: 2, border: '1px solid', borderColor: 'error.100' }}>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <IconifyIcon icon="mingcute:alert-fill" color="error.main" width={16} height={16} />
                          <Typography variant="body2" fontWeight={600}>{item.ingredientName}</Typography>
                        </Stack>
                        <Typography variant="caption" color="error.main" fontWeight={700}>
                          {Number(item.currentQty).toFixed(1)}{item.unit}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* 오늘의 요약 */}
              <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle1" fontWeight={700} mb={2}>오늘의 요약</Typography>
                <Stack gap={1.5} divider={<Divider flexItem />}>
                  {[
                    {
                      label: '등록 재고 품목',
                      value: `${inventory.length}개`,
                      icon: 'mingcute:inventory-line',
                      color: '#43a047',
                    },
                    {
                      label: '미읽은 알림',
                      value: `${dashData?.unreadNotificationCount ?? 0}건`,
                      icon: 'ph:bell-bold',
                      color: '#1e88e5',
                    },
                    {
                      label: '대기 발주',
                      value: `${dashData?.pendingOrderCount ?? 0}건`,
                      icon: 'mingcute:shopping-cart-fill',
                      color: '#fb8c00',
                    },
                  ].map((row) => (
                    <Stack key={row.label} direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Avatar sx={{ width: 28, height: 28, bgcolor: `${row.color}18` }}>
                          <IconifyIcon icon={row.icon} width={14} height={14} sx={{ color: row.color }} />
                        </Avatar>
                        <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                      </Stack>
                      <Typography variant="body2" fontWeight={700}>{row.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    );
  }

  /* ────── HQ 대시보드 ────── */
  return (
    <Box sx={{ pb: 4 }}>
      {/* Hero */}
      <Paper elevation={0} sx={{
        mb: 4, p: 4, borderRadius: 5,
        background: 'linear-gradient(135deg, #0d47a1 0%, #1b5e20 100%)',
        color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <Box sx={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'white', opacity: 0.07 }} />
        <Stack direction="row" alignItems="center" gap={1.5} mb={1}>
          <IconifyIcon icon="mingcute:leaf-fill" color="white" width={22} />
          <Typography variant="h5" fontWeight={800}>FoodGuard</Typography>
        </Stack>
        <Typography variant="h4" fontWeight={700}>본사 통합 관리 대시보드</Typography>
        <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5 }}>{today()}</Typography>
      </Paper>

      {/* HQ 통계 */}
      <Grid container spacing={3} mb={4}>
        {[
          { title: '전체 가맹점', value: loading ? '...' : `${dashData?.totalStores ?? 0}개`, sub: '등록된 가맹점', icon: 'mingcute:store-2-line', grad: 'linear-gradient(135deg,#43a047,#66bb6a)' },
          { title: '활성 가맹점', value: loading ? '...' : `${dashData?.activeStores ?? 0}개`, sub: '정상 운영 중', icon: 'mingcute:check-circle-fill', grad: 'linear-gradient(135deg,#1e88e5,#42a5f5)' },
          { title: '승인 대기 발주', value: loading ? '...' : `${dashData?.pendingOrderCount ?? 0}건`, sub: '즉시 처리 필요', icon: 'mingcute:clipboard-line', grad: 'linear-gradient(135deg,#fb8c00,#ffa726)' },
          { title: '주간 네트워크 매출', value: loading ? '...' : formatKRW(dashData?.totalWeeklyRevenue ?? 0), sub: '전 가맹점 합산', icon: 'mingcute:currency-line', grad: 'linear-gradient(135deg,#7b1fa2,#ab47bc)' },
        ].map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.title}>
            <StatCard {...card} loading={loading} />
          </Grid>
        ))}
      </Grid>

      {/* 가맹점 현황 테이블 */}
      <Paper elevation={0} sx={{ p: 3.5, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight={700} mb={3}>가맹점 현황</Typography>
        {loading ? <LinearProgress sx={{ borderRadius: 2 }} /> : (
          <Stack gap={1.5}>
            {/* 헤더 */}
            <Stack direction="row" sx={{ px: 2, pb: 1, borderBottom: '2px solid', borderColor: 'divider' }}>
              {['매장명', '지역', '상태', '저재고', '미읽은 알림'].map((h) => (
                <Typography key={h} variant="caption" fontWeight={700} color="text.secondary"
                  sx={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </Typography>
              ))}
            </Stack>
            {(dashData?.storesSummary ?? []).map((s: any) => (
              <Stack key={s.storeId} direction="row" alignItems="center"
                sx={{ px: 2, py: 1.5, borderRadius: 2, bgcolor: 'background.default',
                  '&:hover': { bgcolor: 'action.hover' }, transition: 'background .15s' }}>
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{s.storeName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{s.region}</Typography>
                <Box sx={{ flex: 1 }}>
                  <Chip label={s.isActive ? '운영중' : '휴업'} size="small"
                    color={s.isActive ? 'success' : 'default'} sx={{ fontWeight: 600 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  {s.lowStockCount > 0
                    ? <Chip label={`${s.lowStockCount}건`} size="small" color="error" variant="outlined" />
                    : <Typography variant="caption" color="success.main" fontWeight={600}>정상</Typography>}
                </Box>
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}
                  color={s.unreadAlerts > 0 ? 'warning.main' : 'text.secondary'}>
                  {s.unreadAlerts > 0 ? `${s.unreadAlerts}건` : '-'}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>    </Box>
  );
};

export default Dashboard;
