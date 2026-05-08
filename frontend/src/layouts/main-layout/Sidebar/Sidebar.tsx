import { ReactElement } from 'react';
import { Link, List, Toolbar, Box, Typography, Stack } from '@mui/material';
<<<<<<< HEAD
import NavItem from './NavItem';
import { drawerOpenWidth } from '..';
=======
import SimpleBar from 'simplebar-react';
import NavItem from './NavItem';
import { drawerCloseWidth, drawerOpenWidth } from '..';
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
import IconifyIcon from 'components/base/IconifyIcon';

interface SidebarProps {
  open: boolean;
  role: string;
  setMobileOpen?: (open: boolean) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

<<<<<<< HEAD
const Sidebar = ({ open, role, setMobileOpen, onMouseEnter, onMouseLeave }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ_ADMIN' ? [
    { title: '통합 관리 센터', icon: 'mingcute:home-5-line', path: '/admin' },
    { title: '가맹점 네트워크', icon: 'mingcute:grid-fill', path: '/admin/stores' },
    { title: '발주 관리', icon: 'mingcute:list-check-fill', path: '/admin/orders' },
=======
const FoodGuardLogo = ({ open }: { open: boolean }) => (
  <Link href="/" underline="none">
    <Stack direction="row" alignItems="center" gap={1} sx={{ overflow: 'hidden' }}>
      {/* 아이콘 */}
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

      {/* 텍스트 (사이드바 열렸을 때만) */}
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

const Sidebar = ({ open, role, setMobileOpen }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ' ? [
    { title: '대시보드', icon: 'mingcute:home-5-line', path: '/', active: true },
    { title: '전 가맹점 현황', icon: 'mingcute:grid-fill', path: '/admin/stores', active: true },
    { title: '폐기율 통계', icon: 'mingcute:chart-bar-fill', path: '/admin/stats', active: true },
    { title: '발주 승인/관리', icon: 'mingcute:list-check-fill', path: '/admin/orders', active: true },
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
  ] : [
    { title: '에코 대시보드', icon: 'mingcute:leaf-line', path: '/' },
    { title: '가게 등록', icon: 'mingcute:store-2-line', path: '/store' },
    { title: 'POS 시스템', icon: 'mingcute:cashier-2-line', path: '/pos', extraIcon: 'ph:cash-register', blackIcon: true },
    { title: 'AI 수요 예측', icon: 'mingcute:brain-fill', path: '/predictions' },
    { title: '식자재 발주', icon: 'mingcute:refresh-2-line', path: '/orders' },
    { title: '자원 현황', icon: 'mingcute:inventory-line', path: '/inventory' },
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
<<<<<<< HEAD
        <Link href="/" sx={{ mt: 3 }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ textDecoration: 'none', px: 1 }}>
            <IconifyIcon icon="mingcute:leaf-fill" color="primary.main" width={32} height={32} />
            {open && (
              <Typography fontWeight={900} color="primary.main" sx={{ fontSize: 20, letterSpacing: '-0.05em', whiteSpace: 'nowrap' }}>
                FoodGuard
              </Typography>
            )}
          </Stack>
        </Link>
=======
        <Box sx={{ mt: 1 }}>
          <FoodGuardLogo open={open} />
        </Box>
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
      </Toolbar>

      {/* Nav list — scrollbar hidden */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
        }}
      >
        <List component="nav" sx={{ mt: 2, py: 2 }}>
          {menuItems.map((navItem) => (
            <NavItem
              key={navItem.title}
<<<<<<< HEAD
              navItem={{ ...navItem, active: true }}
=======
              navItem={navItem}
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
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
