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

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

function useDateTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const d = now;
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}(${DAY_KO[d.getDay()]})`;
  const ampm = d.getHours() < 12 ? '오전' : '오후';
  const h = d.getHours() % 12 || 12;
  const timeStr = `${ampm} ${pad(h)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${dateStr} ${timeStr}`;
}

function useTemperature() {
  const [temp, setTemp] = useState<string>('--');
  useEffect(() => {
    const fetch_ = () =>
      fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true')
        .then(r => r.json())
        .then(d => setTemp(`${Math.round(d.current_weather.temperature)}°C`))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return temp;
}

const PAGE_SUBTITLES: Record<string, string> = {
  '/pos': 'POS 시스템',
  '/orders': '식자재 발주',
  '/predictions': 'AI 수요 예측',
  '/assistant': 'AI 운영 비서',
  '/inventory': '실시간 자원 및 재고 현황',
  '/ingredients': '식자재 관리',
  '/store': '가게 등록',
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
  const dateTime = useDateTime();
  const temperature = useTemperature();
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

  const fetchNotifications = useCallback(async (initial = false) => {
    if (!storeId) return;
    if (initial) setNotiLoading(true);
    try {
      const data = await notificationService.getUnread(storeId);
      const incoming = Array.isArray(data) ? data : [];
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newOnes = incoming
          .filter(n => !existingIds.has(n.id))
          .map(n => ({ ...n, _localRead: false }));
        return [...prev, ...newOnes];
      });
    } catch {} finally {
      if (initial) setNotiLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    fetchNotifications(true);
    const t = setInterval(() => fetchNotifications(false), 30000);
    return () => clearInterval(t);
  }, [storeId, fetchNotifications]);

  const handleBellClick = (e: React.MouseEvent<HTMLElement>) => {
    setBellAnchor(e.currentTarget);
    fetchNotifications();
  };

  // 읽음 처리 — 목록에서 제거하지 않고 로컬 isRead만 표시
  const handleMarkRead = async (id: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === id && !n._localRead ? { ...n, _localRead: true } : n)
    );
    try { await notificationService.markAsRead(id); } catch {}
  };

  // X 버튼 — 목록에서 직접 제거
  const handleDismiss = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, _localRead: true })));
    for (const n of notifications) {
      try { await notificationService.markAsRead(n.id); } catch {}
    }
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
          height: 116,
          '& *:focus': { outline: 'none' },
        }}
      >
        {/* FoodGuard 로고 + 현재 페이지 부제목 */}
        <Stack direction="row" gap={1.5} alignItems="center" ml={2.5} flex="1 1 auto">
          <Typography
            variant="h5" fontWeight={800} color="primary.main"
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer', flexShrink: 0, letterSpacing: '-0.3px' }}
          >
            FoodGuard
          </Typography>
          {subtitle && (
            <>
              <Typography color="text.disabled" sx={{ fontSize: 18, lineHeight: 1 }}>·</Typography>
              <Typography variant="body1" color="text.secondary" fontWeight={500} noWrap>
                {subtitle}
              </Typography>
            </>
          )}
        </Stack>

        {/* 우측 알림 + 유저 */}
        <Stack direction="row" gap={3.75} alignItems="center" justifyContent="flex-end" mr={3.75} flex="1 1 20%">
          <Typography variant="h6" color="text.secondary" fontWeight={500} noWrap sx={{ letterSpacing: 0.2 }}>
            {dateTime} · {temperature}
          </Typography>
          <Badge
            color="error"
            badgeContent={notifications.filter(n => !n._localRead).length || undefined}
            max={9}
            sx={{ '& .MuiBadge-badge': { top: 6, right: 6, fontSize: 10, minWidth: 18, height: 18 } }}
          >
            <IconButton sx={{ padding: 1 }} onClick={handleBellClick}>
              <IconifyIcon icon="ph:bell-bold" width={29} height={32} color="#111111" />
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
                    onMouseEnter={() => handleMarkRead(noti.id)}
                    sx={{
                      px: 2.5, py: 1.75,
                      cursor: 'default',
                      '&:hover': { bgcolor: 'action.hover' },
                      bgcolor: noti._localRead ? 'transparent' : 'primary.50',
                      opacity: noti._localRead ? 0.6 : 1,
                      transition: 'opacity 0.2s, background-color 0.2s',
                    }}
                    secondaryAction={
                      <IconButton size="small" onClick={() => handleDismiss(noti.id)} sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}>
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
