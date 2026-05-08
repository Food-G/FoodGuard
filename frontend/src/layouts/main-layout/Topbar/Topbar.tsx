import {
  Badge, Stack, AppBar, Toolbar, IconButton, Box,
  Popover, Typography, Paper, List, ListItem, ListItemButton,
  ListItemText, ListItemIcon, Divider, CircularProgress,
  Button, Chip, ClickAwayListener,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { drawerCloseWidth, drawerOpenWidth } from '..';
import UserDropdown from './UserDropdown';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';

/* ────────── 검색 대상 페이지 ────────── */
const SEARCH_PAGES = [
  {
    title: '대시보드',
    path: '/',
    icon: 'mingcute:home-5-line',
    description: '주간 매출, 월간 매출, 재고 부족 경보, 대기 발주 현황, 오늘의 요약',
    keywords: ['대시보드', '매출', '재고', '경보', '발주', '알림', '통계', '현황'],
  },
  {
    title: '매출 입력',
    path: '/sales',
    icon: 'mingcute:edit-fill',
    description: '매출 데이터 입력, 판매 내역 조회, 메뉴별 판매 수량 등록',
    keywords: ['매출', '판매', '입력', '수량', '메뉴', '판매내역'],
  },
  {
    title: 'AI 수요 예측',
    path: '/predictions',
    icon: 'mingcute:brain-fill',
    description: 'AI 기반 메뉴별 수요 예측 결과, 예측 정확도 확인',
    keywords: ['AI', '예측', '수요', '메뉴', '판매량', '수요예측', '인공지능'],
  },
  {
    title: '식자재 발주',
    path: '/orders',
    icon: 'mingcute:shopping-cart-fill',
    description: '식자재 발주 요청 등록, 발주 내역 조회, 발주 상태 확인 및 취소',
    keywords: ['발주', '식자재', '주문', '요청', '승인', '반려', '완료', '취소'],
  },
  {
    title: '재고 현황',
    path: '/inventory',
    icon: 'mingcute:inventory-line',
    description: '재고 등록, 재고 수량 수정, 유통기한 관리, 재고 삭제, 총 가격 확인',
    keywords: ['재고', '식자재', '수량', '유통기한', '등록', '삭제', '수정', '단가', '가격'],
  },
];

/* ────────── 키워드 하이라이트 ────────── */
const Highlight = ({ text, query }: { text: string; query: string }) => {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <Box
        component="span"
        sx={{ bgcolor: '#fff176', px: 0.3, borderRadius: 0.5, fontWeight: 700, color: '#333' }}
      >
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
};

const searchPages = (q: string) => {
  if (!q.trim()) return [];
  const lq = q.toLowerCase();
  return SEARCH_PAGES.filter(
    (p) =>
      p.title.toLowerCase().includes(lq) ||
      p.description.toLowerCase().includes(lq) ||
      p.keywords.some((k) => k.toLowerCase().includes(lq)),
  );
};

/* ────────── 호버 확장 검색바 ────────── */
const HoverSearchBar = () => {
  const [hovered,  setHovered]  = useState(false);
  const [focused,  setFocused]  = useState(false);
  const [query,    setQuery]    = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const isOpen  = hovered || focused || query.length > 0;
  const results = useMemo(() => searchPages(query), [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    setQuery('');
    setShowDrop(false);
    setFocused(false);
    setHovered(false);
    inputRef.current?.blur();
  };

  const handleClickAway = () => {
    setShowDrop(false);
    setFocused(false);
  };

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {/* 검색 컨테이너 */}
        <Box
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={() => inputRef.current?.focus()}
          sx={{
            display: 'flex',
            alignItems: 'center',
            width: isOpen ? 320 : 48,
            height: 46,
            borderRadius: isOpen ? '12px' : '50%',
            bgcolor: isOpen ? 'white' : 'transparent',
            border: isOpen ? '2px solid' : '2px solid transparent',
            borderColor: isOpen ? 'primary.main' : 'transparent',
            boxShadow: isOpen ? '0 2px 12px rgba(0,0,0,0.12)' : 'none',
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), border-radius 0.3s, border-color 0.2s, box-shadow 0.2s',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {/* 돋보기 아이콘 — 항상 왼쪽에 중앙 정렬 */}
          <Box
            sx={{
              width: 46,
              height: 46,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconifyIcon
              icon="akar-icons:search"
              width={22}
              height={22}
              sx={{ color: '#111', flexShrink: 0 }}
            />
          </Box>

          {/* 텍스트 입력 — 확장 시에만 보임 */}
          <Box
            component="input"
            ref={inputRef}
            value={query}
            onChange={(e: any) => {
              setQuery(e.target.value);
              setShowDrop(true);
            }}
            onFocus={() => {
              setFocused(true);
              if (query) setShowDrop(true);
            }}
            onBlur={() => {
              // blur는 mousedown 이벤트가 완료된 후 처리되므로
              // 검색 결과 클릭 시에는 handleSelect가 먼저 실행됨
              setTimeout(() => setFocused(false), 150);
            }}
            placeholder="페이지 또는 기능 검색..."
            sx={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              flex: 1,
              minWidth: 0,
              fontSize: '0.875rem',
              color: '#111',
              fontFamily: 'inherit',
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? 'auto' : 'none',
              transition: 'opacity 0.2s',
              '&::placeholder': { color: '#aaa' },
            }}
          />

          {/* X 버튼 */}
          {query.length > 0 && (
            <Box
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery('');
                setShowDrop(false);
                inputRef.current?.focus();
              }}
              sx={{
                width: 28, height: 28, mr: 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <IconifyIcon icon="mingcute:close-line" width={14} height={14} sx={{ color: '#555' }} />
            </Box>
          )}
        </Box>

        {/* 검색 결과 드롭다운 */}
        {showDrop && query.trim() && (
          <Paper
            elevation={8}
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: 360,
              zIndex: 9999,
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {results.length > 0 ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    px: 2, pt: 1.5, pb: 0.5,
                    display: 'block',
                    fontWeight: 700,
                    color: 'text.secondary',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontSize: '0.68rem',
                  }}
                >
                  검색 결과 {results.length}개
                </Typography>
                <Divider />
                <List dense disablePadding>
                  {results.map((page, i) => (
                    <ListItemButton
                      key={page.path}
                      /* mousedown → blur 전에 실행되므로 클릭 이벤트가 정상 작동 */
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(page.path);
                      }}
                      divider={i < results.length - 1}
                      sx={{ py: 1.5, px: 2, '&:hover': { bgcolor: '#f1f8f1' } }}
                    >
                      <ListItemIcon sx={{ minWidth: 38 }}>
                        <Box
                          sx={{
                            width: 30, height: 30, borderRadius: 1.5,
                            background: 'linear-gradient(135deg,#43a047,#1e88e5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <IconifyIcon icon={page.icon} width={15} height={15} sx={{ color: 'white' }} />
                        </Box>
                      </ListItemIcon>

                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={700} color="text.primary">
                            <Highlight text={page.title} query={query} />
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary" component="span">
                            <Highlight text={page.description} query={query} />
                          </Typography>
                        }
                      />
                      <IconifyIcon
                        icon="mingcute:arrow-right-line"
                        width={16} height={16}
                        sx={{ color: 'text.disabled', ml: 1, flexShrink: 0 }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </>
            ) : (
              <Box sx={{ p: 2.5, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>"{query}"</strong>에 해당하는 페이지가 없습니다.
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
};

/* ────────── Topbar ────────── */
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
        boxShadow: 'none',
      }}
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
        {/* 검색 영역 — HoverSearchBar */}
        <Stack direction="row" gap={2} alignItems="center" ml={2.5} flex="1 1 52.5%">
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <HoverSearchBar />
          </Box>
        </Stack>

        {/* 우측 알림 + 유저 */}
        <Stack direction="row" gap={3.75} alignItems="center" justifyContent="flex-end" mr={3.75} flex="1 1 20%">
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
