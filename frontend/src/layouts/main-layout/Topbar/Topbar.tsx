import {
  Badge, Stack, AppBar, IconButton, Box,
  Popover, Typography, List, ListItem,
  ListItemText, ListItemIcon, Divider, CircularProgress,
  Button, Chip, Collapse, Portal, ClickAwayListener, alpha, InputBase,
} from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { ReactElement, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserDropdown from './UserDropdown';
import CopilotDrawer from '../../../components/CopilotDrawer';
import { notificationService } from '../../../services/notificationService';
import { storeService } from '../../../services/storeService';
import { authService } from '../../../services/authService';
import { decodeToken } from '../../../utils/jwt';
import { menuFor } from '../menu';

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
  // 메뉴 아이콘 호버 카드 (카드로 마우스를 옮기는 동안 닫히지 않게 약간 늦게 닫는다)
  const [quickOpen, setQuickOpen] = useState(false);       // 퀵메뉴 펼침
  const [quick, setQuick] = useState<number | null>(null);  // 마우스가 올라간 메뉴 줄
  const quickRowOpen = Math.max(...menu.map((g) => g.items.length)) * 32 + 10;
  // 스크롤할 때 퀵메뉴가 살짝 따라 움직였다가 제자리로 돌아오게 (관성 효과)
  const [drift, setDrift] = useState(0);
  useEffect(() => {
    let last = window.scrollY;
    let settle: number | undefined;
    const onScroll = () => {
      const dy = window.scrollY - last;
      last = window.scrollY;
      setDrift(Math.max(-14, Math.min(14, -dy * 0.35)));
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setDrift(0), 90);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(settle); };
  }, []);
  const searchOpen = searchHover || searchFocus || !!search;

  useEffect(() => { setMegaOpen(false); setQuickOpen(false); setQuick(null); }, [location.pathname]);

  const searchHits = search.trim()
    ? menu.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))).filter((i) => `${i.title} ${i.group}`.includes(search.trim()))
    : [];
  const activeGroup = menu.findIndex((g) => g.items.some((i) => i.path === location.pathname));

  // Notification state
  const [bellAnchor, setBellAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notiLoading, setNotiLoading] = useState(false);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [isHq, setIsHq] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  // 메인 화면 등 다른 곳에서 코파일럿을 열 수 있게 (window 이벤트 'fg:open-copilot')
  useEffect(() => {
    const open = () => setCopilotOpen(true);
    window.addEventListener('fg:open-copilot', open);
    return () => window.removeEventListener('fg:open-copilot', open);
  }, []);

  useEffect(() => {
    const token = authService.getToken();
    if (!token) return;
    const decoded = decodeToken(token);
    if (!decoded?.id) return;
    if (decoded.role === 'HQ_ADMIN') { setIsHq(true); return; }
    storeService.getMyStores(decoded.id).then((stores: any[]) => {
      if (stores?.length) setStoreId(stores[0].id);
    }).catch(() => {});
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!storeId && !isHq) return;
    setNotiLoading(true);
    try {
      const data = isHq ? await notificationService.getHqUnread() : await notificationService.getUnread(storeId!);
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotiLoading(false);
    }
  }, [storeId, isHq]);

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
            <Box sx={utilLink} onClick={() => setCopilotOpen(true)}>
              <IconifyIcon icon="mingcute:robot-line" width={15} /> AI 코파일럿
            </Box>
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

      {/* ── GNB: 로고 바로 옆에 4개 메뉴, 오른쪽은 메뉴 검색·코파일럿·사용자 ── */}
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
            onMouseEnter={() => { setSearchHover(true); searchRef.current?.focus(); }}
            onMouseLeave={() => setSearchHover(false)}
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

          <IconButton sx={{ padding: 1, color: 'inherit', display: { lg: 'none' } }} title="AI 코파일럿" aria-label="AI 코파일럿" onClick={() => setCopilotOpen(true)}>
            <IconifyIcon icon="mingcute:robot-line" width={24} height={24} />
          </IconButton>
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
            {/* 오른쪽 여백: 코파일럿 안내 카드 */}
            <Box flex={1} sx={{ display: { xs: 'none', xl: 'flex' }, justifyContent: 'flex-end', pl: 3 }}>
              <Stack onClick={() => { setMegaOpen(false); setCopilotOpen(true); }} sx={{
                width: 260, p: 2.2, borderRadius: '10px', cursor: 'pointer',
                background: 'linear-gradient(135deg, #E6F5EE 0%, #ECE8FD 100%)', '&:hover': { boxShadow: '0 10px 24px rgba(30,40,90,.10)' },
              }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: 'common.white', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconifyIcon icon="mingcute:sparkles-line" width={18} />
                  </Box>
                  <Typography fontWeight={800} fontSize={14.5}>찾는 메뉴가 없나요?</Typography>
                </Stack>
                <Typography fontSize={12.5} color="text.secondary" mt={1}>AI 코파일럿에게 매장 데이터를 물어보세요.</Typography>
                <Typography fontSize={12.5} fontWeight={700} color="primary.main" mt={1.2}>대화 시작하기 ›</Typography>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Collapse>

      {/* ── 화면 오른쪽에 떠 있는 퀵메뉴: 호버하면 아이콘 줄이 왼쪽으로 밀리고, 각 아이콘 오른쪽에 그 메뉴의 세부 기능이 모두 펼쳐진다 ── */}
      <Portal>
        <ClickAwayListener onClickAway={() => { setQuickOpen(false); setQuick(null); }}>
          <Stack
            component="nav"
            aria-label="퀵메뉴"
            onMouseEnter={() => setQuickOpen(true)}
            onMouseLeave={() => { setQuickOpen(false); setQuick(null); }}
            sx={{
              position: 'fixed', right: { xs: 8, sm: 16 }, top: '50%', zIndex: 1090,
              transform: `translateY(calc(-50% + ${drift}px))`,
              transition: drift ? 'transform .2s ease-out' : 'transform .5s cubic-bezier(.22,1,.36,1)',
              bgcolor: 'background.paper', borderRadius: '10px', overflow: 'hidden', py: 1.2,
              border: '1px solid #E3E7EF', boxShadow: quickOpen ? '0 20px 48px rgba(30,40,90,.18)' : '0 12px 32px rgba(30,40,90,.14)',
              transitionProperty: 'transform, box-shadow',
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ px: 1.2, pb: 0.8 }}>
              <Typography sx={{ width: { xs: 48, sm: 70 }, flexShrink: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'primary.main', textAlign: 'center' }}>MENU</Typography>
              <Typography noWrap sx={{
                width: quickOpen ? { xs: 170, sm: 196 } : 0, opacity: quickOpen ? 1 : 0, overflow: 'hidden', pl: quickOpen ? 1.2 : 0,
                fontSize: 12, fontWeight: 700, color: 'text.secondary', transition: 'all .4s cubic-bezier(.22,1,.36,1)',
              }}>
                전체 메뉴 바로가기
              </Typography>
            </Stack>
            {menu.map((g, i) => {
              const on = quick === i;
              const here = activeGroup === i;
              return (
                <Stack
                  key={g.title}
                  direction="row"
                  alignItems="center"
                  onMouseEnter={() => setQuick(i)}
                  sx={{
                    mx: 0.8, px: 0.4, borderRadius: '8px', bgcolor: on ? alpha(g.color, 0.07) : 'transparent',
                    // 줄 높이를 모두 같게: 접힘은 아이콘 높이, 펼침은 세부 기능이 가장 많은 메뉴 기준
                    height: quickOpen ? `${quickRowOpen}px` : { xs: '52px', sm: '74px' },
                    transition: 'height .45s cubic-bezier(.22,1,.36,1), background-color .2s',
                  }}
                >
                  {/* 메뉴 아이콘 */}
                  <Stack
                    role="button"
                    aria-label={`${g.title} 메뉴`}
                    alignItems="center"
                    gap={0.5}
                    onClick={() => setQuickOpen(!quickOpen)}
                    sx={{ width: { xs: 48, sm: 70 }, flexShrink: 0, py: 0.5, cursor: 'pointer' }}
                  >
                    <Box sx={{
                      width: { xs: 36, sm: 42 }, height: { xs: 36, sm: 42 }, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: on || here ? g.color : alpha(g.color, 0.1), color: on || here ? 'common.white' : g.color, transition: 'all .2s',
                    }}>
                      <IconifyIcon icon={g.icon} width={22} />
                    </Box>
                    <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 11.5, fontWeight: on || here ? 800 : 600, color: on || here ? g.color : 'text.secondary', textAlign: 'center', lineHeight: 1.2, wordBreak: 'keep-all' }}>
                      {g.title}
                    </Typography>
                  </Stack>

                  {/* 세부 기능 (펼칠 때 아이콘 오른쪽에 모두 나타남) */}
                  <Box sx={{
                    width: quickOpen ? { xs: 170, sm: 196 } : 0, opacity: quickOpen ? 1 : 0, overflow: 'hidden', flexShrink: 0,
                    transition: quickOpen
                      ? `width .45s cubic-bezier(.22,1,.36,1), opacity .3s ease ${0.06 + i * 0.04}s`
                      : 'width .35s cubic-bezier(.4,0,.2,1), opacity .12s ease',
                  }}>
                    <Box sx={{ width: { xs: 170, sm: 196 }, pl: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      {g.items.map((item) => {
                        const current = location.pathname === item.path;
                        return (
                          <Stack key={item.path} direction="row" alignItems="center" gap={0.9} onClick={() => { setQuickOpen(false); setQuick(null); navigate(item.path); }} sx={{
                            px: 1.1, height: 32, borderRadius: '4px', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap',
                            bgcolor: current ? alpha(g.color, 0.14) : 'transparent', color: current ? g.color : 'text.primary', fontWeight: current ? 700 : 500,
                            transition: 'background-color .2s, color .2s',
                            '&:hover': { bgcolor: alpha(g.color, 0.14), color: g.color, fontWeight: 700 },
                          }}>
                            <IconifyIcon icon={item.icon} width={15} sx={{ flexShrink: 0, opacity: 0.85 }} />
                            <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</Box>
                          </Stack>
                        );
                      })}
                    </Box>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </ClickAwayListener>
      </Portal>

      <CopilotDrawer open={copilotOpen} onClose={() => setCopilotOpen(false)} storeId={storeId} isHq={isHq} />

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
            maxWidth: 'calc(100vw - 32px)',
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
