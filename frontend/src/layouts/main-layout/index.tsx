import { ReactElement, ReactNode } from 'react';

export const drawerOpenWidth = 240;
export const drawerCloseWidth = 110;
import { Box, Stack, Typography, alpha, keyframes } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import IconifyIcon from 'components/base/IconifyIcon';
import Topbar, { TOPBAR_HEIGHT } from './Topbar/Topbar';
import Footer from './Footer/Footer';
import { findPage } from './menu';

interface MainLayoutProps {
  children: ReactNode;
  role: string;
  onLogout: () => void;
}

const drift = keyframes`0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-10px) rotate(-4deg) }`;
const rise = keyframes`from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none }`;

// 서브 페이지 상단: 그룹 색 배너 + 브레드크럼 + 같은 그룹 페이지 탭
const SubVisual = ({ role }: { role: string }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page = findPage(role, pathname);
  if (!page) return null;
  const { group, item } = page;

  return (
    <>
      <Box sx={{
        position: 'relative', overflow: 'hidden', color: 'text.primary',
        background: `linear-gradient(115deg, ${alpha(group.color, 0.12)} 0%, #F3F1FF 55%, #FFF2F5 100%)`,
        px: { xs: 2, sm: 4, lg: 6 }, py: { xs: 4, md: 5 },
      }}>
        <Stack direction="row" alignItems="center" sx={{ position: 'relative', maxWidth: 1440, mx: 'auto', animation: `${rise} .6s ease both` }}>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" gap={0.8} sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
              <Box onClick={() => navigate('/')} sx={{ display: 'flex', cursor: 'pointer' }}><IconifyIcon icon="mingcute:home-4-line" width={15} /></Box>
              <IconifyIcon icon="mingcute:right-line" width={13} />
              <span>{group.title}</span>
              <IconifyIcon icon="mingcute:right-line" width={13} />
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{item.title}</Box>
            </Stack>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: group.color }}>{group.title}</Typography>
            <Typography sx={{ fontSize: { xs: 26, md: 36 }, fontWeight: 800, letterSpacing: '-0.5px', mt: 0.3 }}>{item.title}</Typography>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 0.8, display: { xs: 'none', sm: 'block' } }}>{group.desc}</Typography>
          </Box>
          <Box sx={{
            display: { xs: 'none', sm: 'flex' }, width: { sm: 96, md: 120 }, height: { sm: 96, md: 120 }, borderRadius: '32%',
            bgcolor: 'common.white', color: group.color, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: `0 18px 40px ${alpha(group.color, 0.22)}`, animation: `${drift} 8s ease-in-out infinite`,
          }}>
            <IconifyIcon icon={item.icon} width="50%" height="50%" />
          </Box>
        </Stack>
      </Box>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflowX: 'auto' }}>
        <Stack direction="row" sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 1, sm: 3, lg: 5 } }}>
          {group.items.map((it) => {
            const on = it.path === pathname;
            return (
              <Box key={it.path} onClick={() => navigate(it.path)} sx={{
                px: { xs: 1.5, sm: 2.5 }, py: 1.8, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 15,
                fontWeight: on ? 700 : 500, color: on ? 'text.primary' : 'text.secondary',
                borderBottom: '3px solid', borderColor: on ? group.color : 'transparent',
                '&:hover': { color: 'text.primary' },
              }}>
                {it.title}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </>
  );
};

const MainLayout = ({ children, role, onLogout }: MainLayoutProps): ReactElement => {
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <Stack sx={{ minHeight: '100vh' }}>
      <Topbar role={role} onLogout={onLogout} />
      <Box component="main" sx={{ flexGrow: 1, width: 1, minWidth: 0 }}>
        {isHome ? children : (
          <>
            <Box sx={{ height: TOPBAR_HEIGHT }} />
            <SubVisual role={role} />
            <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 4, lg: 6 }, pt: { xs: 3, md: 5 }, pb: { xs: 6, md: 10 } }}>
              {children}
            </Box>
          </>
        )}
      </Box>
      <Footer role={role} />
    </Stack>
  );
};

export default MainLayout;
