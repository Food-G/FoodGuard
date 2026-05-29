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

const TRANSITION = 'width 0.25s cubic-bezier(0.4,0,0.2,1)';

const MainLayout = ({ children, role, onLogout }: MainLayoutProps): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Topbar open={open} onLogout={onLogout} />

        {/* 모바일 Drawer */}
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

        {/* 데스크톱 Drawer — 호버로 열림/닫힘 */}
        <Box
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          sx={{
            display: { xs: 'none', sm: 'block' },
            flexShrink: 0,
            width: open ? drawerOpenWidth : drawerCloseWidth,
            transition: TRANSITION,
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
            flexGrow: 1,
            width: 1,
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
