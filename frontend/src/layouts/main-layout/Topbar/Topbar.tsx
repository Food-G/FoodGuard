import {
  Badge, Stack, AppBar, IconButton, Box,
  Popover, Typography, CircularProgress,
  Collapse, alpha, InputBase,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserDropdown from './UserDropdown';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';
import { menuFor } from '../menu';
import { timeAgo } from '../../../utils/timeAgo';

const UTIL_HEIGHT = 36;   // 데스크톱 상단 유틸리티 띠
const GNB_HEIGHT = 76;
export const TOPBAR_HEIGHT = { xs: 64, lg: UTIL_HEIGHT + GNB_HEIGHT };
// GNB 항목과 메가메뉴 칼럼 폭을 같게 해서 세로로 줄을 맞춘다 (로고 칸 폭도 메가메뉴 왼쪽 칸과 같다)
const NAV_W = { lg: 124, xl: 142 };
const LOGO_W = { lg: 210, xl: 240 };

interface TopbarProps {
  role: string;
  onLogout: () => void;
}

export const Logo = ({ light = false }: { light?: boolean }) => (
  <Stack direction="row" alignItems="center" gap={1.2}>
    <Box sx={{
      width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
      background: 'linear-gradient(135deg, #1D9E75 0%, #2F7DD1 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <IconifyIcon icon="mingcute:leaf-fill" color="white" width={21} height={21} />
    </Box>
    <Box className="logo-text">
      <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', lineHeight: 1, letterSpacing: '-0.5px', color: light ? 'common.white' : 'text.primary' }}>
        FoodGuard
      </Typography>
      <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.14em', mt: 0.3, whiteSpace: 'nowrap', color: light ? alpha('#fff', 0.7) : 'text.secondary' }}>
        AI FOOD MANAGEMENT
      </Typography>
    </Box>
  </Stack>
);

const Topbar = ({ role, onLogout }: TopbarProps): ReactElement => {
  const navigate = useNavigate();
  const location = useLocation();
  const menu = menuFor(role);

  // 메가메뉴: GNB 에 마우스를 올리면 펼치고, 헤더(패널 포함) 밖으로 나가면 접는다
  const [megaOpen, setMegaOpen] = useState(false);
  const [hoverGroup, setHoverGroup] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [searchHover, setSearchHover] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // 마우스가 검색 칸을 벗어나면 잠시 뒤 입력을 비우고 돋보기로 접는다 (결과 목록으로 옮기는 틈에는 접히지 않게)
  const searchLeaveTimer = useRef<number>();
  const openSearch = () => { window.clearTimeout(searchLeaveTimer.current); setSearchHover(true); searchRef.current?.focus(); };
  const closeSearchSoon = () => {
    window.clearTimeout(searchLeaveTimer.current);
    searchLeaveTimer.current = window.setTimeout(() => { setSearchHover(false); setSearch(''); searchRef.current?.blur(); }, 250);
  };
  useEffect(() => () => window.clearTimeout(searchLeaveTimer.current), []);
  const searchOpen = searchHover || searchFocus || !!search;

  useEffect(() => { setMegaOpen(false); }, [location.pathname]);

  const searchHits = search.trim()
    ? menu.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))).filter((i) => `${i.title} ${i.group}`.includes(search.trim()))
    : [];
  const activeGroup = menu.findIndex((g) => g.items.some((i) => i.path === location.pathname));

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
    if (decoded.role === 'HQ_ADMIN') return;
    storeService.getMyStores(decoded.id).then((stores: any[]) => {
      if (stores?.length) setStoreId(stores[0].id);
    }).catch(() => {});
  }, []);

  // 본사 알림 API 는 아직 없다 (매장 알림만)
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

  // 알림 종류별 아이콘·색·이름 (에이전트 알림 포함: fgagent/agents/*.py notifications)
  const NOTI_TYPE: Record<string, { icon: string; color: string; label: string }> = {
    ORDER: { icon: 'mingcute:refresh-2-line', color: '#2F7DD1', label: '발주' },
    ALERT: { icon: 'mingcute:warning-line', color: '#E0803D', label: '주의' },
    WASTE: { icon: 'mingcute:delete-2-line', color: '#E0533D', label: '폐기 위험' },
    PREDICTION: { icon: 'mingcute:brain-fill', color: '#7A4FD6', label: '수요 예측' },
    ACCURACY: { icon: 'mingcute:brain-fill', color: '#7A4FD6', label: '예측 점검' },
    AUDIT: { icon: 'mingcute:search-line', color: '#B7791F', label: '데이터 점검' },
    INFO: { icon: 'mingcute:information-line', color: '#1D9E75', label: '안내' },
  };
  const notiType = (t: string) => NOTI_TYPE[t] ?? NOTI_TYPE.INFO;
  // "[발주 참모] 내용" → 보낸 곳과 본문을 나눠서 보여준다
  const splitMessage = (m: string) => {
    const hit = /^\[([^\]]+)\]\s*/.exec(m ?? '');
    return hit ? { from: hit[1], body: m.slice(hit[0].length) } : { from: '', body: m };
  };

  const utilLink = {
    display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', fontSize: 12.5, color: 'text.secondary',
    '&:hover': { color: 'text.primary' },
  };

  return (
    <AppBar
      position="fixed"
      onMouseLeave={() => { setMegaOpen(false); setHoverGroup(null); }}
      sx={{
        left: 0,
        width: '100%',
        paddingRight: '0 !important',
        bgcolor: 'background.paper',
        color: 'text.primary',
        backgroundImage: 'none',
        boxShadow: 'none',
        borderRadius: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* ── 유틸리티 띠 (데스크톱) ── */}
      <Box sx={{ display: { xs: 'none', lg: 'block' }, bgcolor: '#F4F6F9', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: UTIL_HEIGHT, maxWidth: 1440, mx: 'auto', px: 6 }}>
          <Stack direction="row" alignItems="center" gap={0.8} sx={{ fontSize: 12, color: 'text.secondary' }}>
            <IconifyIcon icon="mingcute:leaf-fill" width={14} sx={{ color: 'primary.main' }} />
            FoodGuard 는 식자재 낭비를 줄이는 AI 매장 관리 서비스입니다.
          </Stack>
          <Stack direction="row" alignItems="center" gap={2.5}>
            <Box sx={utilLink} onClick={handleBellClick}>
              <IconifyIcon icon="ph:bell-bold" width={14} /> 알림
              {notifications.length > 0 && (
                <Box component="span" sx={{ ml: 0.3, px: 0.7, borderRadius: 9, bgcolor: 'error.main', color: 'common.white', fontSize: 10, fontWeight: 700 }}>
                  {notifications.length}
                </Box>
              )}
            </Box>
          </Stack>
        </Stack>
      </Box>

      {/* ── GNB: 로고 바로 옆에 4개 메뉴, 오른쪽은 메뉴 검색·사용자 ── */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{ height: { xs: TOPBAR_HEIGHT.xs, lg: GNB_HEIGHT }, width: 1, maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4, lg: 6 }, '& *:focus': { outline: 'none' } }}
      >
        <Box sx={{ width: { lg: LOGO_W.lg, xl: LOGO_W.xl }, flexShrink: 0 }}>
          <Box onClick={() => navigate('/')} sx={{ cursor: 'pointer', display: 'inline-flex', '& .logo-text': { display: { xs: 'none', sm: 'block' } } }}>
            <Logo />
          </Box>
        </Box>

        <Stack component="nav" direction="row" sx={{ display: { xs: 'none', lg: 'flex' }, height: 1 }}>
          {menu.map((group, i) => {
            const on = hoverGroup === i || (hoverGroup === null && activeGroup === i);
            return (
              <Stack
                key={group.title}
                direction="row"
                alignItems="center"
                justifyContent="center"
                gap={0.5}
                tabIndex={0}
                onMouseEnter={() => { setMegaOpen(true); setHoverGroup(i); }}
                onFocus={() => { setMegaOpen(true); setHoverGroup(i); }}
                onClick={() => navigate(group.items[0].path)}
                sx={{
                  width: NAV_W, height: 1, cursor: 'pointer', position: 'relative', flexShrink: 0,
                  color: on ? 'primary.main' : 'text.primary', transition: 'color .2s',
                  '&::after': {
                    content: '""', position: 'absolute', bottom: -1, left: '50%', height: 3,
                    width: on ? '70%' : 0, transform: 'translateX(-50%)',
                    bgcolor: 'primary.main', transition: 'width .25s ease',
                  },
                  '& .chev': { transform: on && megaOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s' },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: 16.5, color: 'inherit', whiteSpace: 'nowrap' }}>{group.title}</Typography>
                <IconifyIcon className="chev" icon="mingcute:down-line" width={16} sx={{ opacity: 0.6 }} />
              </Stack>
            );
          })}
        </Stack>

        <Box flex={1} />

        <Stack direction="row" gap={{ xs: 0.5, sm: 1 }} alignItems="center" justifyContent="flex-end" onMouseEnter={() => { setMegaOpen(false); setHoverGroup(null); }}>
          {/* 메뉴 검색: 평소엔 돋보기만, 호버하면 왼쪽으로 늘어나며 입력 */}
          <Box
            sx={{ position: 'relative', display: { xs: 'none', xl: 'block' } }}
            onMouseEnter={openSearch}
            onMouseLeave={closeSearchSoon}
          >
            <Stack direction="row" alignItems="center" sx={{
              width: searchOpen ? 240 : 40, height: 40, borderRadius: 9, overflow: 'hidden',
              bgcolor: searchOpen ? '#F4F6FA' : 'transparent',
              boxShadow: searchFocus ? 'inset 0 0 0 1.5px #1D9E75' : 'inset 0 0 0 1px transparent',
              transition: 'width .6s cubic-bezier(.4,0,.2,1), background-color .45s ease, box-shadow .3s ease',
              '&:hover': { bgcolor: '#F4F6FA' },
            }}>
              <Box sx={{
                width: 40, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: searchOpen ? 'primary.main' : 'text.primary',
                transform: searchOpen ? 'rotate(-8deg) scale(.94)' : 'none',
                transition: 'color .3s ease, transform .5s cubic-bezier(.22,1,.36,1)',
              }}>
                <IconifyIcon icon="mingcute:search-line" width={21} />
              </Box>
              <InputBase
                inputRef={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchHits[0]) { navigate(searchHits[0].path); setSearch(''); }
                  if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); }
                }}
                placeholder="메뉴 검색"
                inputProps={{ 'aria-label': '상단 메뉴 검색', tabIndex: searchOpen ? 0 : -1 }}
                sx={{
                  flex: 1, minWidth: 0, fontSize: 14, pr: 2,
                  opacity: searchOpen ? 1 : 0, transform: searchOpen ? 'translateX(0)' : 'translateX(14px)',
                  transition: searchOpen
                    ? 'opacity .35s ease .12s, transform .5s cubic-bezier(.22,1,.36,1) .05s'
                    : 'opacity .15s ease, transform .2s ease',
                  '& input::placeholder': { color: 'text.secondary', opacity: 0.9 },
                }}
              />
            </Stack>
            {searchFocus && search.trim() && (
              <Box sx={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 260, bgcolor: 'background.paper', borderRadius: '10px',
                border: '1px solid', borderColor: 'divider', boxShadow: '0 16px 36px rgba(30,40,90,.14)', py: 0.8, zIndex: 10,
              }}>
                {searchHits.length === 0 ? (
                  <Typography fontSize={13} color="text.disabled" px={2} py={1}>일치하는 메뉴가 없습니다</Typography>
                ) : searchHits.map((h) => (
                  <Stack key={h.path} direction="row" alignItems="center" gap={1.2} onMouseDown={() => { navigate(h.path); setSearch(''); }}
                    sx={{ px: 2, py: 1, cursor: 'pointer', '&:hover': { bgcolor: '#F4F6FA' } }}>
                    <IconifyIcon icon={h.icon} width={17} sx={{ color: 'primary.main' }} />
                    <Typography fontSize={13.5} fontWeight={600} flex={1}>{h.title}</Typography>
                    <Typography fontSize={11.5} color="text.disabled">{h.group}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
          </Box>

          <Badge
            color="error"
            badgeContent={notifications.length > 0 ? notifications.length : undefined}
            max={9}
            sx={{ display: { lg: 'none' }, '& .MuiBadge-badge': { top: 6, right: 6, fontSize: 10, minWidth: 18, height: 18 } }}
          >
            <IconButton sx={{ padding: 1, color: 'inherit' }} onClick={handleBellClick} aria-label="알림">
              <IconifyIcon icon="ph:bell-bold" width={24} height={24} />
            </IconButton>
          </Badge>
          <UserDropdown onLogout={onLogout} />
        </Stack>
      </Stack>

      {/* ── 메가메뉴: 기능마다 박스, 호버하면 그 박스에 색이 들어온다 ── */}
      <Collapse in={megaOpen} timeout={250} sx={{ display: { xs: 'none', lg: 'block' } }}>
        <Box sx={{ bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider', boxShadow: '0 24px 40px rgba(15,40,30,0.08)' }}>
          <Stack direction="row" sx={{ px: 6, py: 3.5, maxWidth: 1440, mx: 'auto' }}>
            <Box sx={{ width: { lg: LOGO_W.lg, xl: LOGO_W.xl }, flexShrink: 0, pr: 3 }}>
              <Typography sx={{ fontSize: 11.5, letterSpacing: '0.2em', color: 'primary.main', fontWeight: 700 }}>QUICK MENU</Typography>
              <Typography fontSize={20} fontWeight={800} mt={0.8} color="text.primary">
                {hoverGroup !== null ? menu[hoverGroup].title : '바로가기'}
              </Typography>
              <Typography color="text.secondary" mt={0.8} sx={{ fontSize: 12.5, wordBreak: 'keep-all' }}>
                {hoverGroup !== null ? menu[hoverGroup].desc : '원하는 메뉴로 바로 이동하세요'}
              </Typography>
            </Box>
            <Stack direction="row">
              {menu.map((group, i) => (
                <Stack key={group.title} onMouseEnter={() => setHoverGroup(i)} gap={0} sx={{ width: NAV_W, px: 0.5, flexShrink: 0 }}>
                  {group.items.map((item) => {
                    const current = location.pathname === item.path;
                    return (
                      <Stack
                        key={item.path}
                        direction="row"
                        alignItems="center"
                        gap={0.8}
                        onClick={(e) => { e.stopPropagation(); navigate(item.path); }}
                        sx={{
                          // 평소엔 흰 바탕, 호버한 기능만 박스가 보인다 (작은 안쪽 여백, 마진 없음, 아주 작은 둥근 모서리)
                          px: 1.2, py: 0, m: 0, height: 38, borderRadius: '4px', cursor: 'pointer', fontSize: 13.5, whiteSpace: 'nowrap',
                          bgcolor: current ? alpha(group.color, 0.14) : 'transparent',
                          color: current ? group.color : 'text.primary', fontWeight: current ? 700 : 500,
                          transition: 'background-color .2s, color .2s',
                          '&:hover': { bgcolor: alpha(group.color, 0.14), color: group.color, fontWeight: 700 },
                        }}
                      >
                        <IconifyIcon icon={item.icon} width={15} sx={{ flexShrink: 0, opacity: 0.85 }} />
                        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</Box>
                      </Stack>
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>
      </Collapse>

      {/* 알림 팝오버: 메인 화면 카드와 같은 톤 (연한 그라데이션 머리, 색 아이콘 칸, 알약 라벨) */}
      <Popover
        open={Boolean(bellAnchor)}
        anchorEl={bellAnchor}
        onClose={() => setBellAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            width: 400, maxWidth: 'calc(100vw - 32px)', mt: 1, overflow: 'hidden',
            borderRadius: '12px', border: '1px solid #E3E7EF', boxShadow: '0 20px 48px rgba(30,40,90,.16)',
          },
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.4} sx={{
          px: 2.5, py: 2,
          background: 'linear-gradient(115deg, rgba(29,158,117,.12) 0%, #F3F1FF 60%, #FFF2F5 100%)',
        }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: 'common.white', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(29,158,117,.18)' }}>
            <IconifyIcon icon="ph:bell-bold" width={20} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Typography fontWeight={800} fontSize={16}>알림</Typography>
            <Typography fontSize={12.5} color="text.secondary">
              {notifications.length > 0 ? `읽지 않은 알림 ${notifications.length}개` : '모두 확인했어요'}
            </Typography>
          </Box>
          {notifications.length > 0 && (
            <Box onClick={handleMarkAllRead} sx={{
              px: 1.4, py: 0.5, borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              bgcolor: 'common.white', color: 'primary.main', border: '1px solid', borderColor: alpha('#1D9E75', 0.35),
              '&:hover': { bgcolor: 'primary.main', color: 'common.white' },
            }}>
              모두 읽음
            </Box>
          )}
        </Stack>

        <Box sx={{ maxHeight: 420, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { borderRadius: 4, bgcolor: 'divider' } }}>
          {notiLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={28} />
            </Box>
          ) : notifications.length === 0 ? (
            <Stack alignItems="center" py={5} px={3} gap={1}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: alpha('#1D9E75', 0.1), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon="mingcute:check-circle-line" width={28} />
              </Box>
              <Typography fontWeight={800} fontSize={14.5} mt={0.5}>새 알림이 없어요</Typography>
              <Typography fontSize={12.5} color="text.secondary" textAlign="center">발주·재고·AI 소식이 생기면 여기에서 알려드릴게요.</Typography>
            </Stack>
          ) : (
            <Stack sx={{ p: 1 }} gap={0.5}>
              {notifications.map((noti) => {
                const t = notiType(noti.type);
                const { from, body } = splitMessage(noti.message);
                return (
                  <Stack key={noti.id} direction="row" gap={1.4} sx={{
                    p: 1.4, borderRadius: '10px', transition: 'background-color .2s',
                    '&:hover': { bgcolor: alpha(t.color, 0.06) }, '&:hover .close': { opacity: 1 },
                  }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0, bgcolor: alpha(t.color, 0.12), color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon={t.icon} width={18} />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Stack direction="row" alignItems="center" gap={0.7} mb={0.4}>
                        <Box sx={{ px: 0.9, py: 0.1, borderRadius: 9, bgcolor: alpha(t.color, 0.12), color: t.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{from || t.label}</Box>
                        <Typography fontSize={11.5} color="text.disabled" noWrap>{timeAgo(noti.createdAt)}</Typography>
                      </Stack>
                      <Typography fontSize={13.5} sx={{ lineHeight: 1.6, wordBreak: 'keep-all' }}>{body}</Typography>
                    </Box>
                    <IconButton className="close" size="small" aria-label="읽음 처리" title="읽음 처리" onClick={() => handleMarkRead(noti.id)}
                      sx={{ alignSelf: 'flex-start', opacity: 0.45, transition: 'opacity .2s' }}>
                      <IconifyIcon icon="mingcute:close-line" width={14} />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </Box>
      </Popover>
    </AppBar>
  );
};

export default Topbar;
