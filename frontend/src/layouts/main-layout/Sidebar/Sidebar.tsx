import { ReactElement } from 'react';
import { Link, List, Toolbar, Box } from '@mui/material';
import SimpleBar from 'simplebar-react';
import NavItem from './NavItem';
import { drawerCloseWidth, drawerOpenWidth } from '..';
import Image from 'components/base/Image';

const logoWithText = '/Logo-with-text.png';
const logo = '/LOGO.png';

interface SidebarProps {
  open: boolean;
  role: string;
  setMobileOpen?: (open: boolean) => void;
}

const Sidebar = ({ open, role, setMobileOpen }: SidebarProps): ReactElement => {
  const menuItems = role === 'HQ' ? [
    { title: '대시보드', icon: 'mingcute:home-5-line', path: '/', active: true },
    { title: '전 가맹점 현황', icon: 'mingcute:grid-fill', path: '/admin/stores', active: true },
    { title: '폐기율 통계', icon: 'mingcute:chart-bar-fill', path: '/admin/stats', active: true },
    { title: '발주 승인/관리', icon: 'mingcute:list-check-fill', path: '/admin/orders', active: true },
  ] : [
    { title: '대시보드', icon: 'mingcute:home-5-line', path: '/', active: true },
    { title: '매출 입력', icon: 'mingcute:edit-fill', path: '/sales', active: true },
    { title: 'AI 수요 예측', icon: 'mingcute:brain-fill', path: '/predictions', active: true },
    { title: '식자재 발주', icon: 'mingcute:shopping-cart-fill', path: '/orders', active: true },
    { title: '재고 현황', icon: 'mingcute:inventory-line', path: '/inventory', active: true },
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
          <Image
            src={open ? logoWithText : logo}
            alt={open ? 'logo with text' : 'logo'}
            height={40}
          />
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
