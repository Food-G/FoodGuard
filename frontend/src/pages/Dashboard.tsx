import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Box, Typography, Badge } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { notificationService } from '../services/notificationService';

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
        width: { xs: 130, sm: 155, md: 165 },
        height: { xs: 130, sm: 155, md: 165 },
        borderRadius: 4,
        background: `linear-gradient(145deg, ${color}ee 0%, ${color}aa 100%)`,
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'scale(1.07)',
          boxShadow: `0 16px 36px ${color}55`,
        },
        '&:active': {
          transform: 'scale(0.97)',
        },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {badge != null && badge > 0 && (
        <Badge
          badgeContent={badge}
          color="error"
          sx={{ position: 'absolute', top: 10, right: 10 }}
        />
      )}
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.20)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconifyIcon icon={icon} width={34} height={34} color="white" />
      </Box>
      <Typography
        fontWeight={700}
        color="white"
        fontSize={{ xs: 12, sm: 13 }}
        textAlign="center"
        lineHeight={1.3}
        sx={{ px: 1 }}
      >
        {title}
      </Typography>
    </Box>
  );
};

const OWNER_TILES: TileProps[] = [
  { title: 'POS 시스템',       icon: 'mingcute:cashier-2-line',   color: '#e53935', path: '/pos' },
  { title: '식자재 발주',      icon: 'mingcute:refresh-2-line',    color: '#1976d2', path: '/orders' },
  { title: 'AI 수요 예측',     icon: 'mingcute:brain-fill',        color: '#7b1fa2', path: '/predictions' },
  { title: '재고 현황',        icon: 'mingcute:inventory-line',    color: '#388e3c', path: '/inventory' },
  { title: '식자재 관리',      icon: 'mingcute:vegetable-line',    color: '#f57c00', path: '/ingredients' },
  { title: '메뉴 관리',        icon: 'mingcute:fork-spoon-line',   color: '#0288d1', path: '/menus' },
  { title: '판매 입력',        icon: 'mingcute:chart-line-line',   color: '#00897b', path: '/sales' },
  { title: '폐기예측 & 기부',  icon: 'mingcute:heart-fill',        color: '#c62828', path: '/waste-prediction' },
  { title: '기부 이력',        icon: 'mingcute:history-line',      color: '#6a1b9a', path: '/donations' },
  { title: '가게 등록',        icon: 'mingcute:store-2-line',      color: '#5d4037', path: '/store' },
  { title: 'AI 운영 비서',     icon: 'mingcute:chat-3-line',       color: '#3949ab', path: '/assistant' },
];

const ADMIN_TILES: TileProps[] = [
  { title: '발주 관리',   icon: 'mingcute:truck-line',         color: '#1976d2', path: '/admin/orders' },
  { title: '가맹점 관리', icon: 'mingcute:grid-fill',         color: '#388e3c', path: '/admin/stores' },
  { title: '통계 분석',   icon: 'mingcute:chart-bar-fill',    color: '#7b1fa2', path: '/admin/stats' },
];

const Dashboard = ({ user }: any) => {
  const role = user?.role || 'OWNER';
  const { storeId } = useMyStore(user);
  const [orderBadge, setOrderBadge] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    const fetch_ = () =>
      notificationService.getUnread(storeId)
        .then((data: any[]) => setOrderBadge((data ?? []).filter((n) => n.type === 'ORDER').length))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 30000);
    return () => clearInterval(t);
  }, [storeId]);

  const tiles = role === 'HQ_ADMIN' ? ADMIN_TILES : OWNER_TILES.map((tile) =>
    tile.path === '/orders' ? { ...tile, badge: orderBadge } : tile
  );

  return (
    <Box>
      {/* 타일 그리드 */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: { xs: 2.5, sm: 3, md: 3.5 },
          p: { xs: 2, sm: 4, md: 5 },
        }}
      >
        {tiles.map((tile) => (
          <LaunchTile key={tile.path} {...tile} />
        ))}
      </Box>
    </Box>
  );
};

export default Dashboard;
