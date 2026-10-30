import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Badge, Paper, Stack, useTheme, alpha, CircularProgress } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { storeService } from '../services/storeService';
import { salesService } from '../services/salesService';
import { inventoryService } from '../services/inventoryService';
import { orderService } from '../services/orderService';

interface TileProps {
  title: string;
  icon: string;
  color: string;
  path: string;
  badge?: number;
}

const OWNER_TILES: TileProps[] = [
  { title: 'POS 시스템',      icon: 'mdi:cash-register',         color: '#e53935', path: '/pos' },
  { title: '식자재 발주',     icon: 'mingcute:refresh-2-line',   color: '#1976d2', path: '/orders' },
  { title: 'AI 수요 예측',    icon: 'mingcute:brain-fill',       color: '#7b1fa2', path: '/predictions' },
  { title: '재고 현황',       icon: 'mingcute:box-3-line',       color: '#388e3c', path: '/inventory' },
  { title: '식자재 관리',     icon: 'mdi:carrot',                color: '#f57c00', path: '/ingredients' },
  { title: '메뉴 관리',       icon: 'mingcute:fork-spoon-line',  color: '#0288d1', path: '/menus' },
  { title: '판매 입력',       icon: 'mingcute:chart-line-line',  color: '#00897b', path: '/sales' },
  // 폐기예측 & 기부, 기부 이력 타일은 백엔드 API 가 없어 임시로 숨김 → DEV_ROADMAP AG-2/AG-3 완료 시 복구
];

const ADMIN_TILES: TileProps[] = [
  { title: '가맹점 관리', icon: 'mingcute:grid-fill',      color: '#388e3c', path: '/admin/stores' },
  { title: '통계 분석',   icon: 'mingcute:chart-bar-fill', color: '#7b1fa2', path: '/admin/stats' },
];

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
// 원화 축약 (소수점 생략): 45,000 → ₩4만, 8,000 → ₩8천, 500 → ₩500
const wonShort = (n: number) => {
  if (n >= 10000) return `₩${Math.floor(n / 10000)}만`;
  if (n >= 1000) return `₩${Math.floor(n / 1000)}천`;
  return `₩${Math.round(n)}`;
};

const LaunchTile = ({ title, icon, color, path, badge }: TileProps) => {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(path)}
      sx={{
        aspectRatio: '1 / 1',
        borderRadius: 4,
        background: `linear-gradient(145deg, ${color}ee 0%, ${color}aa 100%)`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 30px ${color}55` },
        '&:active': { transform: 'scale(0.97)' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: { xs: 0.8, sm: 1.2 },
        position: 'relative',
      }}
    >
      {badge != null && badge > 0 && (
        <Badge badgeContent={badge} color="error" sx={{ position: 'absolute', top: 14, right: 14 }} />
      )}
      <Box
        sx={{
          width: { xs: 40, sm: 52 },
          height: { xs: 40, sm: 52 },
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <IconifyIcon icon={icon} width={28} height={28} color="white" />
      </Box>
      <Typography fontWeight={700} color="white" fontSize={{ xs: 11, sm: 13 }} textAlign="center" lineHeight={1.25} sx={{ px: 0.5 }}>
        {title}
      </Typography>
    </Box>
  );
};

const StatCard = ({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color: string }) => {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, flex: 1, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" gap={1.2}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, bgcolor: alpha(color, 0.12), color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconifyIcon icon={icon} width={22} />
        </Box>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
          <Typography variant="h6" fontWeight={800} lineHeight={1.1} noWrap>{value}</Typography>
          {sub && <Typography variant="caption" color="text.disabled" noWrap>{sub}</Typography>}
        </Box>
      </Stack>
    </Paper>
  );
};

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const role = user?.role || 'OWNER';
  const tiles = role === 'HQ_ADMIN' ? ADMIN_TILES : OWNER_TILES;

  const [storeName, setStoreName] = useState('');
  const [today, setToday] = useState<{ revenue: number; qty: number } | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [lowStock, setLowStock] = useState<{ low: number; total: number }>({ low: 0, total: 0 });
  const [week, setWeek] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(role !== 'HQ_ADMIN');

  useEffect(() => {
    if (role === 'HQ_ADMIN' || !user?.id) return;
    storeService.getMyStores(user.id)
      .then(async (stores: any[]) => {
        if (!stores?.length) { setLoading(false); return; }
        const sid: number = stores[0].id;
        setStoreName(stores[0].storeName ?? '');

        const end = new Date();
        const start = new Date(); start.setDate(end.getDate() - 6);
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        const [summary, inv, orders, range] = await Promise.all([
          salesService.getTodaySummary(sid).catch(() => null),
          inventoryService.getByStore(sid).catch(() => []),
          orderService.getByStore(sid).catch(() => []),
          salesService.getByDateRange(sid, fmt(start), fmt(end)).catch(() => []),
        ]);

        if (summary) setToday({ revenue: summary.revenue ?? 0, qty: summary.qty ?? 0 });

        const invArr = Array.isArray(inv) ? inv : [];
        const low = invArr.filter((x: any) => Number(x.currentQty) < Number(x.minThreshold ?? 0)).length;
        setLowStock({ low, total: invArr.length });

        const active = (Array.isArray(orders) ? orders : [])
          .filter((o: any) => !['DONE', 'CANCELLED', 'REJECTED'].includes(o.status));
        setOrderCount(active.length);

        // 최근 7일 일별 매출 (수량 × 메뉴가격)
        const byDate: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(end.getDate() - i);
          byDate[fmt(d)] = 0;
        }
        (Array.isArray(range) ? range : []).forEach((s: any) => {
          const key = s.saleDate;
          const rev = (s.quantity ?? 0) * (s.menu?.price ?? 0);
          if (key in byDate) byDate[key] += rev;
        });
        setWeek(Object.entries(byDate).map(([date, revenue]) => ({ date, revenue })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, role]);

  const maxRev = useMemo(() => Math.max(...week.map((w) => w.revenue), 1), [week]);
  const weekTotal = useMemo(() => week.reduce((s, w) => s + w.revenue, 0), [week]);

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 3, md: 4 }, alignItems: 'flex-start' }}>
      {/* ── 좌측: 3×3 타일 ── */}
      <Box sx={{ width: { xs: '100%', md: 480 }, flexShrink: 0 }}>
        <Typography variant="h5" fontWeight={800} mb={2}>바로가기</Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: role === 'HQ_ADMIN' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          {tiles.map((tile) => <LaunchTile key={tile.path} {...tile} />)}
        </Box>
      </Box>

      {/* ── 우측: 데이터 대시보드 (점주만) ── */}
      {role !== 'HQ_ADMIN' && (
        <Box sx={{ flex: 1, minWidth: 0, width: { xs: '100%', md: 'auto' } }}>
          <Stack direction="row" alignItems="baseline" gap={1} mb={2} flexWrap="wrap">
            <Typography variant="h5" fontWeight={800}>대시보드</Typography>
            {storeName && <Typography variant="body2" color="text.secondary">{storeName}</Typography>}
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : (
            <Stack gap={2}>
              {/* 통계 카드 */}
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
                <StatCard icon="mingcute:currency-won-line" color="#2e7d32" label="오늘 매출"
                  value={won(today?.revenue ?? 0)} sub={`${today?.qty ?? 0}건 판매`} />
                <StatCard icon="mingcute:refresh-2-line" color="#1976d2" label="진행 중 발주"
                  value={`${orderCount}건`} sub="대기·승인·배송" />
                <StatCard icon="mingcute:alert-line" color="#ed6c02" label="재고 부족"
                  value={`${lowStock.low}종`} sub={`전체 ${lowStock.total}종`} />
              </Stack>

              {/* 주간 매출 그래프 (CSS 막대) */}
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={2.5}>
                  <Typography fontWeight={700}>최근 7일 매출</Typography>
                  <Typography variant="body2" color="text.secondary">합계 {won(weekTotal)}</Typography>
                </Stack>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.8, sm: 1.5 }, height: 160 }}>
                  {week.map((w) => {
                    const h = Math.round((w.revenue / maxRev) * 100);
                    const dt = new Date(w.date);
                    const isToday = w.date === new Date().toISOString().split('T')[0];
                    return (
                      <Stack key={w.date} flex={1} alignItems="center" gap={0.8} sx={{ height: '100%', justifyContent: 'flex-end', minWidth: 0 }}>
                        <Typography variant="caption" color="text.disabled" fontSize={10} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {w.revenue > 0 ? wonShort(w.revenue) : ''}
                        </Typography>
                        <Box
                          sx={{
                            width: '100%', maxWidth: 38, borderRadius: 1.5,
                            height: `${Math.max(h, 2)}%`,
                            background: isToday
                              ? `linear-gradient(180deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`
                              : alpha(theme.palette.primary.main, 0.28),
                            transition: 'height .4s ease',
                          }}
                        />
                        <Typography variant="caption" color={isToday ? 'primary.main' : 'text.secondary'} fontWeight={isToday ? 700 : 500} fontSize={11}>
                          {`${dt.getMonth() + 1}/${dt.getDate()}`}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Box>
              </Paper>

              {/* 재고 부족 안내 */}
              <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" gap={1.2}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: alpha(lowStock.low > 0 ? theme.palette.warning.main : theme.palette.success.main, 0.12), color: lowStock.low > 0 ? 'warning.main' : 'success.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon={lowStock.low > 0 ? 'mingcute:alert-line' : 'mingcute:check-circle-line'} width={22} />
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>{lowStock.low > 0 ? `${lowStock.low}종 식자재 부족` : '재고 양호'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {lowStock.low > 0 ? '발주가 필요합니다' : '모든 식자재가 충분합니다'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    onClick={() => window.location.assign('/inventory')}
                    sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}
                  >
                    재고 보기 →
                  </Typography>
                </Stack>
              </Paper>
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
