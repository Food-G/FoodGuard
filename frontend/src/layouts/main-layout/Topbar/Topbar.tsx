import {
  Badge, Stack, AppBar, Toolbar, IconButton, Box,
  Popover, Typography, Paper, List, ListItem, ListItemButton,
  ListItemText, ListItemIcon, Divider, CircularProgress,
  Button, Chip, ClickAwayListener,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useMemo, useRef, useEffect, useCallback } from 'react';import { drawerCloseWidth, drawerOpenWidth } from '..';
import UserDropdown from './UserDropdown';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';

interface TopbarProps {
  open?: boolean;
  onLogout: () => void;
}

const Topbar = ({ open = false, onLogout }: TopbarProps): ReactElement => {
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
        ml: { xs: 0, sm: `${open ? drawerOpenWidth : drawerCloseWidth}px` },
        width: { xs: '100%', sm: `calc(100% - ${open ? drawerOpenWidth : drawerCloseWidth}px)` },
        paddingRight: '0 !important',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), margin 0.25s cubic-bezier(0.4,0,0.2,1)',
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
          height: 116,
          '& *:focus': { outline: 'none' },
        }}
      >
        {/* 검색 영역 — HoverSearchBar */}        <Stack direction="row" gap={2} alignItems="center" ml={2.5} flex="1 1 52.5%">
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
          >
            <IconifyIcon
              icon={open ? 'ri:menu-unfold-4-line' : 'ri:menu-unfold-3-line'}
              color="text.primary"
            />
          </IconButton>
          <TextField
            variant="filled"
            fullWidth
            placeholder="Search here..."
            sx={{
              display: { xs: 'none', sm: 'flex' },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="end">
                  <IconifyIcon icon="akar-icons:search" width={13} height={13} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>

        {/* 우측 알림 + 유저 */}
        <Stack direction="row" gap={3.75} alignItems="center" justifyContent="flex-end" mr={3.75} flex="1 1 20%">
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
