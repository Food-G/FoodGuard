import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Badge, Chip, CircularProgress } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { salesService } from '../services/salesService';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';

interface TileProps {
  title: string;
  icon: string;
  color: string;
  path: string;
  badge?: number;
}

const LaunchTile = ({ title, icon, color, path, badge }: TileProps) => {
  const navigate = useNavigate();
  return (
    <Box
      onClick={() => navigate(path)}
      sx={{
        aspectRatio: '1 / 1',
        width: '100%',
        borderRadius: 3,
        background: `linear-gradient(145deg, ${color}ee 0%, ${color}aa 100%)`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'scale(1.06)', boxShadow: `0 12px 28px ${color}55` },
        '&:active': { transform: 'scale(0.97)' },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        position: 'relative',
        overflow: 'visible',
        minWidth: 0,
      }}
    >
      {badge != null && badge > 0 && (
        <Badge badgeContent={badge} color="error" sx={{ position: 'absolute', top: 8, right: 8 }} />
      )}
      <Box sx={{ width: '42%', aspectRatio: '1/1', borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconifyIcon icon={icon} width="55%" height="55%" color="white" />
      </Box>
      <Typography fontWeight={700} color="white" fontSize="clamp(9px, 1.1vw, 13px)" textAlign="center" lineHeight={1.3} sx={{ px: 0.5 }}>
        {title}
      </Typography>
    </Box>
  );
};

const OWNER_TILES: TileProps[] = [
  { title: 'POS 시스템',      icon: 'mingcute:cashier-2-line',   color: '#e53935', path: '/pos' },
  { title: '예약 현황',       icon: 'mingcute:calendar-2-line',  color: '#1976d2', path: '/reservations' },
  { title: '메뉴 관리',       icon: 'mingcute:fork-spoon-line',  color: '#0288d1', path: '/menus' },
  { title: '판매 입력',       icon: 'mingcute:chart-line-line',  color: '#00897b', path: '/sales' },
  { title: '재고 현황',       icon: 'mingcute:inventory-line',   color: '#388e3c', path: '/inventory' },
  { title: '매출 통계',       icon: 'mingcute:chart-bar-fill',   color: '#f57c00', path: '/sales-stats' },
  { title: 'AI 수요 예측',    icon: 'mingcute:brain-fill',       color: '#7b1fa2', path: '/predictions' },
  { title: '폐기예측 & 기부', icon: 'mingcute:heart-fill',       color: '#c62828', path: '/waste-prediction' },
];

const ADMIN_TILES: TileProps[] = [
  { title: '가맹점 관리', icon: 'mingcute:grid-fill',      color: '#388e3c', path: '/admin/stores' },
  { title: '통계 분석',   icon: 'mingcute:chart-bar-fill', color: '#7b1fa2', path: '/admin/stats' },
];

const MOCK_EMPLOYEES = [
  { name: '정태현',     status: 'in',  time: '09:00' },
  { name: '서준호',     status: 'in',  time: '10:30' },
  { name: '김지환',     status: 'in',  time: '08:45' },
  { name: '지현윤',     status: 'out', time: '-' },
  { name: '몽흐데르겔', status: 'in',  time: '11:00' },
];

/* ───────── 배너 ───────── */
const FoodGuardBanner = () => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        borderRadius: 4,
        background: 'linear-gradient(135deg, #0d1b4b 0%, #1a3a7c 50%, #1565c0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 'clamp(16px, 3.5vw, 40px)',
        py: 'clamp(14px, 2vw, 24px)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(13,27,75,0.45)',
        flexShrink: 0,
      }}
    >
      <Box sx={{ position: 'absolute', width: '40%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', top: '-40%', right: '8%' }} />
      <Box sx={{ position: 'absolute', width: '25%', aspectRatio: '1', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: '-50%', right: '-2%' }} />

      <Box sx={{ zIndex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8 }}>
          <IconifyIcon icon="mingcute:leaf-fill" width="clamp(18px, 2vw, 28px)" height="clamp(18px, 2vw, 28px)" color="#69f0ae" />
          <Typography fontWeight={900} fontSize="clamp(16px, 2vw, 26px)" color="white" letterSpacing={1} lineHeight={1}>
            FoodGuard
          </Typography>
        </Box>
        <Typography fontSize="clamp(10px, 1.1vw, 14px)" color="rgba(255,255,255,0.75)" fontWeight={500} noWrap>
          식자재 낭비 없는 스마트 매장 관리 솔루션
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {['AI 수요예측', '실시간 재고', '친환경 기부'].map((tag) => (
            <Box key={tag} sx={{ px: 'clamp(6px, 1vw, 12px)', py: '2px', borderRadius: 99, background: 'rgba(105,240,174,0.18)', border: '1px solid rgba(105,240,174,0.4)' }}>
              <Typography fontSize="clamp(9px, 0.9vw, 12px)" color="#69f0ae" fontWeight={600}>{tag}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        onClick={() => navigate('/orders')}
        sx={{
          zIndex: 1, flexShrink: 0, ml: 2,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8,
          cursor: 'pointer',
          transition: 'transform 0.15s ease',
          '&:hover': { transform: 'scale(1.08)' },
          '&:active': { transform: 'scale(0.96)' },
        }}
      >
        <Box sx={{
          width: 'clamp(44px, 5.5vw, 72px)',
          height: 'clamp(44px, 5.5vw, 72px)',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(105,240,174,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          <IconifyIcon icon="mingcute:store-2-fill" width="clamp(22px, 2.8vw, 36px)" height="clamp(22px, 2.8vw, 36px)" color="rgba(255,255,255,0.9)" />
        </Box>
        <Typography fontSize="clamp(9px, 0.9vw, 12px)" fontWeight={700} color="rgba(255,255,255,0.9)" textAlign="center">
          식자재 발주
        </Typography>
      </Box>
    </Box>
  );
};

/* ───────── 공통 카드 ───────── */
const CARD_SX = {
  borderRadius: 3,
  bgcolor: '#ffffff',
  border: '1px solid #E8EAF0',
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  p: 'clamp(12px, 1.6vw, 20px)',
};

const CardHeader = ({ icon, iconColor, title, right }: { icon: string; iconColor: string; title: string; right?: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 'clamp(10px, 1.2vw, 16px)' }}>
    <Box sx={{
      width: 'clamp(26px, 2.8vw, 36px)', height: 'clamp(26px, 2.8vw, 36px)',
      borderRadius: 2, bgcolor: `${iconColor}18`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <IconifyIcon icon={icon} width="clamp(13px, 1.5vw, 19px)" height="clamp(13px, 1.5vw, 19px)" color={iconColor} />
    </Box>
    <Typography fontWeight={700} fontSize="clamp(12px, 1.3vw, 16px)" color="#1A1C1E">{title}</Typography>
    {right && <Box sx={{ ml: 'auto' }}>{right}</Box>}
  </Box>
);

/* ───────── 매출 요약 ───────── */
const SalesSummaryWidget = ({ storeId }: { storeId: number | null }) => {
  const [data, setData] = useState<{ count: number; totalQty: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }
    const today = new Date().toISOString().split('T')[0];
    salesService.getByDateRange(storeId, today, today)
      .then((sales: any[]) => {
        setData({ count: sales.length, totalQty: sales.reduce((s: number, r: any) => s + (r.quantity ?? 0), 0) });
      })
      .catch(() => setData({ count: 0, totalQty: 0 }))
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <Box sx={{ ...CARD_SX, flex: 1, minWidth: 0, borderTop: '3px solid #1D9E75' }}>
      <CardHeader icon="mingcute:chart-line-line" iconColor="#1D9E75" title="오늘의 매출 요약" />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} sx={{ color: '#1D9E75' }} /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1vw, 12px)' }}>
          {[{ label: '결제 건수', value: data?.count ?? 0, unit: '건' }, { label: '총 판매량', value: data?.totalQty ?? 0, unit: '개' }].map(({ label, value, unit }) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 'clamp(8px, 1.2vw, 14px)', py: 'clamp(8px, 1vw, 12px)', borderRadius: 2, bgcolor: '#F3FAF7' }}>
              <Typography fontSize="clamp(11px, 1.2vw, 15px)" color="#44474E" fontWeight={500}>{label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography fontWeight={800} fontSize="clamp(18px, 2.2vw, 26px)" color="#1D9E75" lineHeight={1}>{value}</Typography>
                <Typography fontSize="clamp(11px, 1.1vw, 14px)" color="#44474E" fontWeight={500}>{unit}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ───────── 재고 경고 ───────── */
const InventoryAlertWidget = ({ storeId }: { storeId: number | null }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }
    inventoryService.getByStore(storeId)
      .then((items: any[]) => {
        const soon = new Date(); soon.setDate(soon.getDate() + 3);
        setAlerts(items.filter((item: any) => {
          if (item.expiryDate && new Date(item.expiryDate) <= soon) return true;
          return Number(item.currentQty ?? item.quantity ?? 0) <= 1;
        }).slice(0, 4));
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [storeId]);

  const badge = alerts.length > 0 && (
    <Chip label={`${alerts.length}건`} size="small" sx={{ bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: 'clamp(9px, 0.9vw, 12px)', height: 22, border: '1px solid #FFCC80' }} />
  );

  return (
    <Box sx={{ ...CARD_SX, flex: 1, minWidth: 0, borderTop: '3px solid #FF9800' }}>
      <CardHeader icon="mingcute:warning-fill" iconColor="#FF9800" title="재고 경고 알림" right={badge} />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} sx={{ color: '#FF9800' }} /></Box>
      ) : alerts.length === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 'clamp(8px, 1.2vw, 14px)', py: 'clamp(8px, 1vw, 12px)', borderRadius: 2, bgcolor: '#F1F8F5' }}>
          <IconifyIcon icon="mingcute:check-circle-fill" width="clamp(13px, 1.4vw, 18px)" height="clamp(13px, 1.4vw, 18px)" color="#1D9E75" />
          <Typography fontSize="clamp(11px, 1.2vw, 15px)" color="#44474E" fontWeight={500}>경고 항목 없음</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 'clamp(5px, 0.8vw, 10px)' }}>
          {alerts.map((item: any, i: number) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 'clamp(8px, 1.2vw, 14px)', py: 'clamp(6px, 0.8vw, 10px)', borderRadius: 2, bgcolor: '#FFF8F0', border: '1px solid #FFE0B2' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#FF9800', flexShrink: 0 }} />
                <Typography fontSize="clamp(11px, 1.2vw, 15px)" color="#1A1C1E" fontWeight={600}>{item.ingredient?.name ?? '식자재'}</Typography>
              </Box>
              <Typography fontSize="clamp(10px, 1.1vw, 14px)" color="#E65100" fontWeight={700}>
                {item.currentQty ?? item.quantity ?? 0} {item.unit}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ───────── 직원 출퇴근 ───────── */
const EmployeeWidget = () => {
  const onCount = MOCK_EMPLOYEES.filter((e) => e.status === 'in').length;

  const badge = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1.2, py: 0.4, borderRadius: 99, bgcolor: '#E8F5E9', border: '1px solid #A5D6A7' }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#43A047' }} />
      <Typography fontSize="clamp(9px, 0.9vw, 12px)" color="#2E7D32" fontWeight={700}>근무중 {onCount}명</Typography>
    </Box>
  );

  return (
    <Box sx={{ ...CARD_SX, borderTop: '3px solid #1976D2' }}>
      <CardHeader icon="mingcute:user-2-fill" iconColor="#1976D2" title="직원 출퇴근 현황" right={badge} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(100px, 12vw, 150px), 1fr))', gap: 'clamp(6px, 0.8vw, 10px)' }}>
        {MOCK_EMPLOYEES.map((emp) => {
          const isIn = emp.status === 'in';
          return (
            <Box key={emp.name} sx={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.8vw, 12px)', px: 'clamp(8px, 1.2vw, 14px)', py: 'clamp(7px, 0.9vw, 12px)', borderRadius: 2, bgcolor: isIn ? '#EEF4FF' : '#F8F9FA', border: `1px solid ${isIn ? '#BBCFFF' : '#E8EAF0'}` }}>
              <Box sx={{ width: 'clamp(24px, 2.8vw, 34px)', height: 'clamp(24px, 2.8vw, 34px)', borderRadius: '50%', bgcolor: isIn ? '#1976D218' : '#E8EAF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconifyIcon icon="mingcute:user-2-fill" width="clamp(12px, 1.5vw, 18px)" height="clamp(12px, 1.5vw, 18px)" color={isIn ? '#1976D2' : '#9E9E9E'} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontSize="clamp(11px, 1.2vw, 15px)" fontWeight={700} color={isIn ? '#1A1C1E' : '#8E9199'} noWrap>{emp.name}</Typography>
                <Typography fontSize="clamp(9px, 1vw, 13px)" fontWeight={500} color={isIn ? '#1976D2' : '#8E9199'}>
                  {isIn ? `출근 ${emp.time}` : '미출근'}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/* ───────── Dashboard ───────── */
const Dashboard = ({ user }: any) => {
  const role = user?.role || 'OWNER';
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id && role === 'OWNER') {
      storeService.getMyStores(user.id)
        .then((stores: any[]) => { if (stores.length > 0) setStoreId(stores[0].id); })
        .catch(() => {});
    }
  }, [user?.id, role]);

  if (role === 'HQ_ADMIN') {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, p: 5 }}>
        {ADMIN_TILES.map((tile) => <LaunchTile key={tile.path} {...tile} />)}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 'calc(100vh - 120px)', p: { xs: 1.5, sm: 2.5, md: 4 }, gap: { xs: 2, md: 3 } }}>

      {/* 좌측: 3×3 타일 그리드 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, sm: 1.5, md: 2 }, width: '100%' }}>
          {OWNER_TILES.map((tile) => <LaunchTile key={tile.path} {...tile} />)}
        </Box>
      </Box>

      {/* 우측: 배너 + 위젯들 */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.2vw, 16px)' }}>
        <FoodGuardBanner />
        <Box sx={{ display: 'flex', gap: 'clamp(8px, 1.2vw, 16px)', minWidth: 0 }}>
          <SalesSummaryWidget storeId={storeId} />
          <InventoryAlertWidget storeId={storeId} />
        </Box>
        <EmployeeWidget />
      </Box>
    </Box>
  );
};

export default Dashboard;
