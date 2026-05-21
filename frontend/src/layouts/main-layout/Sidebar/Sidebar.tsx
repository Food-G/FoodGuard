import { ReactElement } from 'react';
import { Link, List, Toolbar, Box, Typography, Stack } from '@mui/material';
import SimpleBar from 'simplebar-react';
import NavItem from './NavItem';
import { drawerCloseWidth, drawerOpenWidth } from '..';
import IconifyIcon from 'components/base/IconifyIcon';

interface SidebarProps {
  open: boolean;
  role: string;
  setMobileOpen?: (open: boolean) => void;
}

const Sidebar = ({ open, role, setMobileOpen }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ_ADMIN' ? [
    { title: '통합 관리 센터', icon: 'mingcute:home-5-line', path: '/admin', active: true },
    { title: '가맹점 네트워크', icon: 'mingcute:grid-fill', path: '/admin/stores', active: true },
    { title: '발주 관리', icon: 'mingcute:list-check-fill', path: '/admin/orders', active: true },
  ] : [
    { title: '에코 대시보드', icon: 'mingcute:leaf-line', path: '/', active: true },
    { title: '가게 등록', icon: 'mingcute:store-2-line', path: '/store', active: true },
    { title: '메뉴 관리', icon: 'mingcute:fork-spoon-line', path: '/menus', active: true },
    { title: '판매 실적 입력', icon: 'mingcute:edit-fill', path: '/sales', active: true },
    { title: 'AI 수요 예측', icon: 'mingcute:brain-fill', path: '/predictions', active: true },
    { title: '식자재 발주', icon: 'mingcute:refresh-2-line', path: '/orders', active: true },
    { title: '자원 현황', icon: 'mingcute:inventory-line', path: '/inventory', active: true },
  ];

  return (
    <>
      <Toolbar
        sx={{
          position: 'fixed',
          height: 98,
          zIndex: 1,
          bgcolor: 'background.default',
          p: 0,
          justifyContent: 'center',
          width: open ? drawerOpenWidth - 1 : drawerCloseWidth - 1,
        }}
      >
        <Link
          href="/"
          sx={{
            mt: 3,
          }}
        >
          <Stack direction="row" alignItems="center" gap={1} sx={{ textDecoration: 'none' }}>
            <IconifyIcon icon="mingcute:leaf-fill" color="primary.main" width={32} height={32} />
            {open && (
              <Typography fontWeight={900} color="primary.main" sx={{ fontSize: 20, letterSpacing: '-0.05em' }}>
                FoodGuard
              </Typography>
            )}
          </Stack>
        </Link>
      </Toolbar>
      <Box component={SimpleBar} style={{ maxHeight: '100vh' }}>
        <List
          component="nav"
          sx={{
            mt: 24.5,
            py: 2.5,
            height: 724,
            justifyContent: 'space-between',
          }}
        >
          {menuItems.map((navItem) => (
            <NavItem 
              key={navItem.title} 
              navItem={navItem} 
              open={open} 
              onClick={() => setMobileOpen && setMobileOpen(false)} 
            />
          ))}
        </List>
      </Box>
    </>
  );
};

export default Sidebar;
