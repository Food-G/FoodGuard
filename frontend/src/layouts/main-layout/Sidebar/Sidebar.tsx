import { ReactElement } from 'react';
import { Link, List, Toolbar, Box, Typography, Stack } from '@mui/material';
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

const Sidebar = ({ open, role, setMobileOpen, onMouseEnter, onMouseLeave }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ_ADMIN' ? [
    { title: '통합 관리 센터', icon: 'mingcute:home-5-line', path: '/admin' },
    { title: '가맹점 네트워크', icon: 'mingcute:grid-fill', path: '/admin/stores' },
    { title: '발주 관리', icon: 'mingcute:list-check-fill', path: '/admin/orders' },
  ] : [
    { title: '에코 대시보드', icon: 'mingcute:leaf-line', path: '/' },
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
              navItem={{ ...navItem, active: true }}
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
