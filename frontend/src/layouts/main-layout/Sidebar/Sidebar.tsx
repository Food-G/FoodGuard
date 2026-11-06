import { ReactElement } from 'react';
import { Link, List, Toolbar, Box, Typography, Stack } from '@mui/material';
import SimpleBar from 'simplebar-react';
import NavItem from './NavItem';
import { drawerOpenWidth } from '..';
import IconifyIcon from 'components/base/IconifyIcon';

interface SidebarProps {
  open: boolean;
  role: string;
  setMobileOpen?: (open: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const FoodGuardLogo = ({ open }: { open: boolean }) => (
  <Link href="/" underline="none">
    <Stack direction="row" alignItems="center" gap={1} sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #43a047 0%, #1e88e5 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(67,160,71,0.4)',
        }}
      >
        <IconifyIcon icon="mingcute:leaf-fill" color="white" width={22} height={22} />
      </Box>
      {open && (
        <Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.15rem',
              lineHeight: 1.1,
              background: 'linear-gradient(135deg, #43a047 0%, #1e88e5 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px',
            }}
          >
            FoodGuard
          </Typography>
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: 'text.secondary',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            AI 식자재 관리
          </Typography>
        </Box>
      )}
    </Stack>
  </Link>
);

const Sidebar = ({ open, role, setMobileOpen, onMouseEnter, onMouseLeave }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ_ADMIN' ? [
    { title: '통합 관리 센터', icon: 'mingcute:home-5-line', path: '/admin', active: true },
    { title: '가맹점 네트워크', icon: 'mingcute:grid-fill', path: '/admin/stores', active: true },
    { title: '환경 통계 분석', icon: 'mingcute:chart-bar-fill', path: '/admin/stats', active: true },
  ] : [
    { title: '에코 대시보드', icon: 'mingcute:leaf-line', path: '/', active: true },
    { title: '가게 등록', icon: 'mingcute:store-2-line', path: '/store', active: true },
    { title: 'POS 시스템', icon: 'mingcute:card-pay-line', path: '/pos', active: true, extraIcon: 'ph:cash-register', blackIcon: true },
    { title: 'AI 수요 예측', icon: 'mingcute:brain-fill', path: '/predictions', active: true },
    { title: '식자재 발주', icon: 'mingcute:refresh-2-line', path: '/orders', active: true },
    { title: '식자재 관리', icon: 'mingcute:vegetable-line', path: '/ingredients', active: true },
    { title: '자원 현황', icon: 'mingcute:inventory-line', path: '/inventory', active: true },
    { title: '폐기예측 & 기부', icon: 'mingcute:heart-fill', path: '/waste-prediction', active: true },
    { title: '기부 이력', icon: 'mingcute:history-line', path: '/donations', active: true },
  ];

  return (
    <Box
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <Toolbar
        sx={{
          position: 'sticky',
          top: 0,
          height: 98,
          zIndex: 1,
          bgcolor: 'background.default',
          p: 0,
          justifyContent: 'center',
          minWidth: open ? drawerOpenWidth - 1 : undefined,
        }}
      >
        <Box sx={{ mt: 1 }}>
          <FoodGuardLogo open={open} />
        </Box>
      </Toolbar>

      <Box component={SimpleBar} style={{ maxHeight: '100vh' }}>
        <List component="nav" sx={{ mt: 2, py: 1 }}>          {menuItems.map((navItem) => (
            <NavItem 
              key={navItem.title} 
              navItem={navItem} 
              open={open} 
              onClick={() => setMobileOpen && setMobileOpen(false)} 
            />
          ))}
        </List>
      </Box>
    </Box>
  );
};

export default Sidebar;
