import {
  Badge, Stack, AppBar, Toolbar, TextField, IconButton,
  InputAdornment, Collapse, Box, Popover, Typography,
  List, ListItem, ListItemText, ListItemIcon, Divider,
  CircularProgress, Button, Chip,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useRef, useEffect, useCallback } from 'react';
import { drawerCloseWidth } from '..';
import UserDropdown from './UserDropdown';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';

interface TopbarProps {
  onLogout: () => void;
}

const PAGE_MAP: Record<string, string> = {
  '대시보드': '/', '에코': '/',
  'pos': '/pos', '포스': '/pos', '메뉴': '/pos', '판매': '/pos',
  '예측': '/predictions', 'ai': '/predictions',
  '발주': '/orders', '재고': '/inventory', '자원': '/inventory', '가게': '/store',
};

const Topbar = ({ onLogout }: TopbarProps): ReactElement => {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [bellAnchor, setBellAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notiLoading, setNotiLoading] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);

  // Get storeId once from JWT user
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

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [searchOpen]);

  const handleSearch = () => {
    if (!query.trim()) return;
    const lower = query.toLowerCase();
    const path = Object.entries(PAGE_MAP).find(([k]) => lower.includes(k))?.[1] ?? '/';
    navigate(path);
    setQuery('');
    setSearchOpen(false);
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
      sx={{ left: 0, ml: { sm: `${drawerCloseWidth}px` }, width: { sm: `calc(100% - ${drawerCloseWidth}px)` }, paddingRight: '0 !important' }}
    >
      <Toolbar
        component={Stack}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ bgcolor: 'background.default', height: 116 }}
      >
        {/* Left: Search */}
        <Stack direction="row" alignItems="center" gap={1.5} ml={2.5} flex={1}>
          <IconButton onClick={() => setSearchOpen(v => !v)} sx={{ color: searchOpen ? 'primary.main' : 'text.primary' }}>
            <IconifyIcon icon="akar-icons:search" width={22} height={22} />
          </IconButton>
          <Collapse in={searchOpen} orientation="horizontal" timeout={200}>
            <Box sx={{ width: 280 }}>
              <TextField
                inputRef={inputRef}
                variant="filled"
                size="small"
                fullWidth
                placeholder="페이지 검색... (예: POS, 발주, 예측)"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearch();
                  if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); }
                }}
                InputProps={{
                  endAdornment: query ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleSearch}>
                        <IconifyIcon icon="mingcute:arrow-right-line" width={16} />
                      </IconButton>
                    </InputAdornment>
                  ) : undefined,
                }}
                sx={{ '& .MuiFilledInput-root': { borderRadius: 2 } }}
              />
            </Box>
          </Collapse>
        </Stack>

        {/* Right: Bell + Profile */}
        <Stack direction="row" gap={3.75} alignItems="center" justifyContent="flex-end" mr={3.75}>
          <Badge
            color="error"
            badgeContent={notifications.length > 0 ? notifications.length : undefined}
            max={9}
            sx={{ '& .MuiBadge-badge': { top: 6, right: 6, fontSize: 10, minWidth: 18, height: 18 } }}
          >
            <IconButton sx={{ padding: 1 }} onClick={handleBellClick}>
              <IconifyIcon icon="ph:bell-bold" width={29} height={32} />
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
