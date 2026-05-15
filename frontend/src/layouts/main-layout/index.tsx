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
  const [open, setOpen] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Topbar open={open} handleDrawerToggle={handleDrawerToggle} onLogout={onLogout} />
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerOpenWidth },
          }}
        >
          <Sidebar open={true} role={role} setMobileOpen={setMobileOpen} />
        </Drawer>
        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          component="aside"
          open={open}
          sx={{
            display: { xs: 'none', sm: 'block' },
            width: open ? drawerOpenWidth : drawerCloseWidth,
            '& .MuiDrawer-paper': {
              width: open ? drawerOpenWidth : drawerCloseWidth,
            },
          }}
        >
          <Drawer
            variant="permanent"
            component="aside"
            open={open}
            sx={{
              width: open ? drawerOpenWidth : drawerCloseWidth,
              transition: TRANSITION,
              '& .MuiDrawer-paper': {
                width: open ? drawerOpenWidth : drawerCloseWidth,
                transition: TRANSITION,
                overflow: 'hidden',
              },
            }}
          >
            <Sidebar open={open} role={role} />
          </Drawer>
        </Box>
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
          <Toolbar
            sx={{
              height: 96,
            }}
          />
          {children}
        </Box>
      </Box>
      <Footer open={false} />
    </>
  );
};

export default MainLayout;
