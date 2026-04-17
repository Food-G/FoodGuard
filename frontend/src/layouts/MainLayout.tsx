import React, { useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, IconButton, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Button, Divider } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

const drawerWidth = 240;

const MainLayout = ({ children, role, onLogout }: { children: ReactNode, role: string, onLogout: () => void }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = role === 'HQ' ? [
    { title: '대시보드', icon: 'mingcute:home-5-line', path: '/' },
    { title: '전 가맹점 현황', icon: 'mingcute:grid-fill', path: '/admin/stores' },
    { title: '폐기율 통계', icon: 'mingcute:chart-bar-fill', path: '/admin/stats' },
    { title: '발주 승인/관리', icon: 'mingcute:list-check-fill', path: '/admin/orders' },
  ] : [
    { title: '대시보드', icon: 'mingcute:home-5-line', path: '/' },
    { title: '매출 입력', icon: 'mingcute:edit-fill', path: '/sales' },
    { title: 'AI 수요 예측', icon: 'mingcute:brain-fill', path: '/predictions' },
    { title: '식자재 발주', icon: 'mingcute:shopping-cart-fill', path: '/orders' },
    { title: '재고 현황', icon: 'mingcute:inventory-line', path: '/inventory' },
  ];

  const drawer = (
    <Box sx={{ bgcolor: 'background.default', height: '100%', color: 'text.primary', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Typography variant="h6" color="primary.main" fontWeight="bold">FoodGuard</Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.title} disablePadding>
            <ListItemButton 
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              selected={location.pathname === item.path}
              sx={{
                '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } },
                '&:hover': { bgcolor: 'primary.light', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } },
                m: 1, borderRadius: 1
              }}
            >
              <ListItemIcon sx={{ color: 'primary.main', minWidth: 40 }}>
                <IconifyIcon icon={item.icon} />
              </ListItemIcon>
              <ListItemText primary={item.title} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Button 
          fullWidth 
          variant="outlined" 
          color="error" 
          startIcon={<IconifyIcon icon="mingcute:exit-line" />}
          onClick={onLogout}
        >
          로그아웃
        </Button>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, bgcolor: 'background.paper', backgroundImage: 'none' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <IconifyIcon icon="mingcute:menu-fill" />
          </IconButton>
          <Typography variant="h6" noWrap component="div" color="text.primary">Dashboard</Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid', borderColor: 'divider' } }} open>
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: '64px' }}>
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
