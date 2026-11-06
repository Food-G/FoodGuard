import {
  Badge, Stack, AppBar, Toolbar, IconButton, Box,
  Popover, Typography, List, ListItem,
  ListItemText, ListItemIcon, Divider, CircularProgress,
  Button, Chip,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserDropdown from './UserDropdown';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';

const PAGE_SUBTITLES: Record<string, string> = {
  '/pos': 'POS 시스템',
  '/orders': '식자재 발주',
  '/predictions': 'AI 수요 예측',
  '/inventory': '실시간 자원 및 재고 현황',
  '/ingredients': '식자재 관리',
  '/menus': '메뉴 관리',
  '/sales': '판매 실적 기록',
  '/waste-prediction': '폐기 예측 & 기부',
  '/donations': '기부 이력',
  '/admin/stores': '가맹점 네트워크 관리',
  '/admin/stats': '환경 통계 분석',
  '/admin/orders': '발주 관리',
};

interface TopbarProps {
  onLogout: () => void;
}

const Topbar = ({ onLogout }: TopbarProps): ReactElement => {
  const navigate = useNavigate();
  const location = useLocation();
  const subtitle = PAGE_SUBTITLES[location.pathname] ?? '';
  // Notification state
  const [bellAnchor, setBellAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notiLoading, setNotiLoading] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded?.id) return;
    storeService.getMyStores(decoded.id).then((stores: any[]) => {
      if (stores?.length) setStoreId(stores[0].id);
    }).catch(() => {});
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!storeId) return;
    setNotiLoading(true);
    try {
      const data = await notificationService.getUnread(storeId);
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotiLoading(false);
    }
  }, [storeId]);

  const handleBellClick = (e: React.MouseEvent<HTMLElement>) => {
    setBellAnchor(e.currentTarget);
    fetchNotifications();
  };

  const handleMarkRead = async (id: number) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      try { await notificationService.markAsRead(n.id); } catch {}
    }
    setNotifications([]);
  };

  const notiTypeIcon: Record<string, string> = {
    ORDER: 'mingcute:refresh-2-line',
    ALERT: 'mingcute:warning-line',
    INFO: 'mingcute:information-line',
    PREDICTION: 'mingcute:brain-fill',
  };

  const notiTypeColor: Record<string, string> = {
    ORDER: '#2e7d32', ALERT: '#ed6c02', INFO: '#0288d1', PREDICTION: '#7b1fa2',
  };
  return (
    <AppBar
      position="fixed"
      sx={{
        left: 0,
        width: '100%',
        paddingRight: '0 !important',
        bgcolor: 'background.default',
        backgroundImage: 'none',
        boxShadow: 'none',      }}
    >
      <Toolbar
        component={Stack}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          bgcolor: 'background.default',
          height: { xs: 66, sm: 116 },
          minHeight: { xs: 66 },
          px: { xs: 1, sm: 2 },
          '& *:focus': { outline: 'none' },
        }}
      >
        {/* 뒤로가기(메인) + FoodGuard 로고 + 현재 페이지 부제목 */}
        <Stack direction="row" gap={{ xs: 0.8, sm: 1.5 }} alignItems="center" ml={{ xs: 0.5, sm: 2.5 }} flex="1 1 auto" minWidth={0}>
          {location.pathname !== '/' && (
            <IconButton
              onClick={() => navigate('/')}
              title="메인으로"
              sx={{
                flexShrink: 0,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <IconifyIcon icon="mingcute:arrow-left-line" width={22} />
            </IconButton>
          )}
          <Typography
            variant="h5" fontWeight={800} color="primary.main"
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer', flexShrink: 0, letterSpacing: '-0.3px' }}
          >
            FoodGuard
          </Typography>
          {subtitle && (
            <Stack direction="row" gap={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' }, minWidth: 0 }}>
              <Typography color="text.disabled" sx={{ fontSize: 18, lineHeight: 1 }}>·</Typography>
              <Typography variant="body1" color="text.secondary" fontWeight={500} noWrap>
                {subtitle}
              </Typography>
            </Stack>
          )}
        </Stack>

        {/* 우측 알림 + 유저 */}
        <Stack direction="row" gap={{ xs: 1.5, sm: 3.75 }} alignItems="center" justifyContent="flex-end" mr={{ xs: 1, sm: 3.75 }} flexShrink={0}>
          <Badge
            color="error"
            badgeContent={notifications.length > 0 ? notifications.length : undefined}
            max={9}
            sx={{ '& .MuiBadge-badge': { top: 6, right: 6, fontSize: 10, minWidth: 18, height: 18 } }}
          >
            <IconButton sx={{ padding: 1 }} onClick={handleBellClick}>              <IconifyIcon icon="ph:bell-bold" width={29} height={32} />
            </IconButton>
          </Badge>
          <UserDropdown onLogout={onLogout} />
        </Stack>
      </Toolbar>

      {/* Notification Popover */}
      <Popover
        open={Boolean(bellAnchor)}
        anchorEl={bellAnchor}
        onClose={() => setBellAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 360,
            maxHeight: 480,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            mt: 1,
          },
        }}
      >
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2.5} py={2} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="ph:bell-bold" color="primary.main" width={20} />
            <Typography variant="h6" fontWeight={700}>알림</Typography>
            {notifications.length > 0 && (
              <Chip label={notifications.length} size="small" color="error" sx={{ height: 20, fontSize: 11 }} />
            )}
          </Stack>
          {notifications.length > 0 && (
            <Button size="small" onClick={handleMarkAllRead} sx={{ fontSize: 12, borderRadius: 1.5 }}>
              모두 읽음
            </Button>
          )}
        </Stack>

        {/* Body */}
        <Box sx={{ maxHeight: 380, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { borderRadius: 4, bgcolor: 'divider' } }}>
          {notiLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Stack alignItems="center" py={5} gap={1.5}>
              <IconifyIcon icon="mingcute:notification-off-line" width={40} color="text.disabled" />
              <Typography variant="body2" color="text.disabled">새 알림이 없습니다</Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {notifications.map((noti, idx) => (
                <Box key={noti.id}>
                  {idx > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      px: 2.5, py: 1.75,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: 'primary.50',
                    }}
                    secondaryAction={
                      <IconButton size="small" onClick={() => handleMarkRead(noti.id)} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                        <IconifyIcon icon="mingcute:close-line" width={14} />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                      <Box sx={{
                        width: 32, height: 32, borderRadius: '50%',
                        bgcolor: `${notiTypeColor[noti.type] ?? '#1976d2'}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <IconifyIcon
                          icon={notiTypeIcon[noti.type] ?? 'mingcute:information-line'}
                          width={16}
                          sx={{ color: notiTypeColor[noti.type] ?? 'primary.main' }}
                        />
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={noti.message}
                      secondary={noti.createdAt ? new Date(noti.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 600, sx: { pr: 3 } }}
                      secondaryTypographyProps={{ variant: 'caption', color: 'text.disabled' }}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Popover>
    </AppBar>
  );
};

export default Topbar;
