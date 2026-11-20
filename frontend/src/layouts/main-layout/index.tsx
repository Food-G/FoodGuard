import { ReactElement, ReactNode } from 'react';

export const drawerOpenWidth = 240;
export const drawerCloseWidth = 110;
import { Box, Toolbar } from '@mui/material';
import Topbar from './Topbar/Topbar';
import Footer from './Footer/Footer';

interface MainLayoutProps {
  children: ReactNode;
  role: string;
  onLogout: () => void;
}

const MainLayout = ({ children, onLogout }: MainLayoutProps): ReactElement => {
  return (
    <>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Topbar onLogout={onLogout} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: 1,
            pt: 4,
            pr: { xs: 3, sm: 7 },
            pb: 8,
            pl: { xs: 3, sm: 7 },
            overflow: 'auto',
          }}
        >
          <Toolbar sx={{ height: 128 }} />
          {children}
        </Box>
      </Box>
      <Footer />
    </>
  );
};

export default MainLayout;
