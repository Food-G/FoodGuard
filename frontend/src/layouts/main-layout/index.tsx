import { useState, ReactElement, ReactNode } from 'react';
import { Box, Drawer, Toolbar } from '@mui/material';
import Topbar from './Topbar/Topbar';
import Sidebar from './Sidebar/Sidebar';
import Footer from './Footer/Footer';

export const drawerOpenWidth = 240;
export const drawerCloseWidth = 110;

interface MainLayoutProps {
  children: ReactNode;
  role: string;
  onLogout: () => void;
}

const MainLayout = ({ children, role, onLogout }: MainLayoutProps): ReactElement => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Topbar onLogout={onLogout} />

        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerOpenWidth },
          }}
        >
          <Sidebar open={true} role={role} setMobileOpen={setMobileOpen} />
        </Drawer>

        {/* Desktop Drawer — always takes drawerCloseWidth space, paper overlays when hovered */}
        <Drawer
          variant="permanent"
          component="aside"
          sx={{
            display: { xs: 'none', sm: 'block' },
            width: drawerCloseWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: sidebarOpen ? drawerOpenWidth : drawerCloseWidth,
              transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
              boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.08)' : 'none',
              zIndex: sidebarOpen ? 1300 : 1200,
            },
          }}
        >
          <Sidebar
            open={sidebarOpen}
            role={role}
            onMouseEnter={() => setSidebarOpen(true)}
            onMouseLeave={() => setSidebarOpen(false)}
          />
        </Drawer>

        <Box
          component="main"
          sx={{
            width: 1,
            flexGrow: 1,
            pt: 5,
            pr: { xs: 3, sm: 5.175 },
            pb: 6.25,
            pl: { xs: 3, sm: 5.25 },
            overflow: 'auto',
          }}
        >
          <Toolbar sx={{ height: 96 }} />
          {children}
        </Box>
      </Box>
      <Footer open={false} />
    </>
  );
};

export default MainLayout;
