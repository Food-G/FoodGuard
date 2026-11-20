import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, useTheme, alpha, CircularProgress, InputBase, IconButton, keyframes,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { CARD_ICON, HqBriefing, TONE, useOwnerBriefing } from '../components/AgentBriefing';
import heroBg from '../assets/hero-bg.jpg';
import { menuFor, MenuLink } from '../layouts/main-layout/menu';
import { AGENTS } from './AgentCenter';
import { agentService, AgentProposal, AgentRun } from '../services/agentService';
import { storeService } from '../services/storeService';
import { salesService } from '../services/salesService';
import { inventoryService } from '../services/inventoryService';
import { orderService } from '../services/orderService';

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
// 원화 축약 (소수점 생략): 45,000 → ₩4만, 8,000 → ₩8천, 500 → ₩500
const wonShort = (n: number) => {
  if (n >= 10000) return `₩${Math.floor(n / 10000)}만`;
  if (n >= 1000) return `₩${Math.floor(n / 1000)}천`;
  return `₩${Math.round(n)}`;
};
const mmdd = (s: string) => {
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fadeUp = keyframes`from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: none }`;
const twinkle = keyframes`0%,100% { opacity: .2 } 50% { opacity: 1 }`;
const floaty = keyframes`0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) }`;

const PAGE = { maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 } };
const CARD = { bgcolor: 'background.paper', borderRadius: '10px', border: '1px solid', borderColor: 'divider', boxShadow: '0 6px 24px rgba(30,40,90,0.06)' };

// ── 히어로 슬라이드: 색 있는 머리말 + 굵은 제목 + 밑줄 강조 설명 ──
interface Slide { eyebrow: string; title: string; desc: [string, string, string]; to: string; color: string }
const SLIDE_MS = 6000;
const OWNER_SLIDES: Slide[] = [
  { eyebrow: 'AI 식자재 관리 FoodGuard', title: '버려지는 식자재 없이', desc: ['판매·재고·발주를 ', '한 화면에서 이어서 관리', '해 보세요!'], to: '/pos', color: '#1D9E75' },
  { eyebrow: 'AI 수요 예측', title: '내일 판매량 미리 보기', desc: ['메뉴별 판매량을 예측하고, ', '발주 참모가 발주안', '을 준비합니다.'], to: '/predictions', color: '#6A4BD1' },
  { eyebrow: '폐기 예측 & 기부', title: '남는 식자재는 이웃에게', desc: ['폐기 위험을 미리 감지해 ', '가까운 기부처', '와 연결합니다.'], to: '/waste-prediction', color: '#D0457F' },
];
const HQ_SLIDES: Slide[] = [
  { eyebrow: '가맹점 네트워크', title: '전 매장의 운영을 한눈에', desc: ['매장별 발주와 ', '환경 지표', '를 한곳에서 살핍니다.'], to: '/admin/stores', color: '#1D9E75' },
  { eyebrow: 'AI 에이전트', title: '에이전트가 먼저 찾습니다', desc: ['발주 심사·입고 추적·예측 운영을 ', 'AI 에이전트', '가 맡습니다.'], to: '/agents', color: '#6A4BD1' },
];

// ── 직원 출퇴근 현황 (예시 데이터: 근태 기능이 생기면 API 로 교체) ──
const STAFF = [
  { name: '정태현', role: '매니저', start: '09:00', end: '18:00', clockIn: '08:52', color: '#1D9E75' },
  { name: '김지환', role: '주방', start: '10:00', end: '19:00', clockIn: '10:07', color: '#2F7DD1' },
  { name: '지현윤', role: '홀', start: '11:00', end: '20:00', clockIn: '10:55', color: '#D0457F' },
  { name: '서준호', role: '파트타임', start: '17:00', end: '22:00', clockIn: '16:58', color: '#6A4BD1' },
];
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const ATTEND = {
  before: { label: '출근 전', color: '#7A8194', bg: '#EEF0F4' },
  working: { label: '근무 중', color: '#1D9E75', bg: '#E3F5EE' },
  off: { label: '퇴근', color: '#5468C4', bg: '#ECEEFA' },
};

// ── 자주 쓰는 메뉴 카드 ──
interface Helper { cat: string; icon: string; color: string; q: string; links: MenuLink[] }
const L = (title: string, path: string): MenuLink => ({ title, path, icon: '' });
const OWNER_HELPERS: Helper[] = [
  { cat: '매출', icon: 'mingcute:chart-line-line', color: '#2F7DD1', q: '오늘 얼마나 팔았는지 궁금해요!', links: [L('판매 입력', '/sales'), L('POS 시스템', '/pos')] },
  { cat: '발주', icon: 'mingcute:refresh-2-line', color: '#1D9E75', q: '부족한 식자재를 주문하고 싶어요!', links: [L('식자재 발주', '/orders'), L('재고 현황', '/inventory')] },
  { cat: '예측', icon: 'mingcute:brain-fill', color: '#6A4BD1', q: '내일 얼마나 팔릴지 알고 싶어요!', links: [L('AI 수요 예측', '/predictions'), L('발주 참모 제안 보기', '/agent-inbox')] },
  { cat: '폐기·기부', icon: 'mingcute:heart-line', color: '#D0457F', q: '버려질 재료를 줄이고 싶어요!', links: [L('폐기 예측 & 기부', '/waste-prediction'), L('기부 이력', '/donations')] },
  { cat: '메뉴', icon: 'mingcute:fork-spoon-line', color: '#E0803D', q: '메뉴와 레시피를 바꾸고 싶어요!', links: [L('메뉴 관리', '/menus'), L('식자재 목록', '/ingredients')] },
  { cat: 'AI 에이전트', icon: 'mingcute:robot-line', color: '#5468C4', q: 'AI가 무엇을 했는지 궁금해요!', links: [L('AI 에이전트 센터', '/agents'), L('AI 승인함', '/agent-inbox')] },
];
const HQ_HELPERS: Helper[] = [
  { cat: '가맹점', icon: 'mingcute:grid-fill', color: '#1D9E75', q: '매장들을 한눈에 보고 싶어요!', links: [L('가맹점 네트워크', '/admin/stores'), L('환경 통계 분석', '/admin/stats')] },
  { cat: '발주', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', q: '들어온 발주를 처리하고 싶어요!', links: [L('발주 관리', '/admin/orders'), L('AI 승인함', '/agent-inbox')] },
  { cat: 'AI 에이전트', icon: 'mingcute:robot-line', color: '#6A4BD1', q: '에이전트 실행 현황이 궁금해요!', links: [L('AI 에이전트 센터', '/agents'), L('AI 승인함', '/agent-inbox')] },
];

// 스크롤해서 화면에 들어오면 아래에서 떠오르게
const Reveal = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Box ref={ref} sx={{ height: 1, opacity: shown ? 1 : 0, animation: shown ? `${fadeUp} .7s ease ${delay}s both` : 'none' }}>
      {children}
    </Box>
  );
};

const MoreButton = ({ onClick }: { onClick: () => void }) => (
  <Stack direction="row" alignItems="center" gap={0.3} onClick={onClick} sx={{
    cursor: 'pointer', fontSize: 11.5, color: 'text.secondary', px: 1.2, py: 0.3, borderRadius: 9, border: '1px solid', borderColor: 'divider', flexShrink: 0,
    '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
  }}>
    더보기 <IconifyIcon icon="mingcute:add-line" width={12} />
  </Stack>
);

// 소식 섹션 카드 머리: 막대 + 제목, 오른쪽에 "1 / 4 ‹ ›"
const NEWS_BOX = { height: { xs: 280, md: 300 }, borderRadius: '10px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' };
const NewsHead = ({ label, count, onPrev, onNext }: { label: string; count?: string; onPrev?: () => void; onNext?: () => void }) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.2}>
    <Stack direction="row" alignItems="center" gap={0.8}>
      <Box sx={{ width: 4, height: 16, borderRadius: 2, bgcolor: 'primary.main' }} />
      <Typography fontWeight={800} fontSize={16}>{label}</Typography>
    </Stack>
    <Stack direction="row" alignItems="center" gap={0.3}>
      {count && <Typography fontSize={12.5} fontWeight={700} color="text.secondary" mr={0.5}>{count}</Typography>}
      {onPrev && <IconButton size="small" onClick={onPrev} aria-label="이전" sx={{ p: 0.3 }}><IconifyIcon icon="mingcute:left-line" width={16} /></IconButton>}
      {onNext && <IconButton size="small" onClick={onNext} aria-label="다음" sx={{ p: 0.3 }}><IconifyIcon icon="mingcute:right-line" width={16} /></IconButton>}
    </Stack>
  </Stack>
);

const PROMOS = [
  { tag: '폐기 예측 & 기부', title: '버려질 식자재,\n이웃의 한 끼로', desc: '유통기한이 임박한 재고를 미리 찾아 가까운 기부처와 연결해요.', icon: 'mingcute:heart-line', color: '#D0457F', bg: 'linear-gradient(120deg, #FDE7EF 0%, #FFF4F7 100%)', to: '/waste-prediction' },
  { tag: 'AI 수요 예측', title: '내일 판매량을\n미리 확인하세요', desc: '메뉴별 예측으로 필요한 만큼만 준비하고 발주해요.', icon: 'mingcute:chart-line-line', color: '#6A4BD1', bg: 'linear-gradient(120deg, #ECE7FD 0%, #F7F5FF 100%)', to: '/predictions' },
  { tag: '식자재 발주', title: '부족한 재료는\n한 번에 주문', desc: '재고 현황을 보고 바로 발주를 올릴 수 있어요.', icon: 'mingcute:truck-line', color: '#1D9E75', bg: 'linear-gradient(120deg, #E1F5EC 0%, #F3FBF7 100%)', to: '/orders' },
];

const CardHead = ({ title, more }: { title: string; more?: () => void }) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
    <Typography fontWeight={800} fontSize={16}>{title}</Typography>
    {more && (
      <Stack direction="row" alignItems="center" gap={0.3} onClick={more} sx={{
        cursor: 'pointer', fontSize: 11.5, color: 'text.secondary', px: 1.2, py: 0.3, borderRadius: 9, border: '1px solid', borderColor: 'divider',
        '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
      }}>
        더보기 <IconifyIcon icon="mingcute:add-line" width={12} />
      </Stack>
    )}
  </Stack>
);

const IconTile = ({ item, onClick, size = 44 }: { item: MenuLink; onClick: () => void; size?: number }) => (
  <Stack alignItems="center" gap={0.8} onClick={onClick} sx={{
    cursor: 'pointer', minWidth: 0, '&:hover .tile': { transform: 'translateY(-3px)', bgcolor: 'primary.main', color: 'common.white' },
  }}>
    <Box className="tile" sx={{
      width: size, height: size, borderRadius: '10px', bgcolor: alpha('#1D9E75', 0.08), color: 'primary.main',
      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
    }}>
      <IconifyIcon icon={item.icon} width={size * 0.5} />
    </Box>
    <Typography sx={{ fontSize: 12, textAlign: 'center', lineHeight: 1.3, color: 'text.secondary', wordBreak: 'keep-all' }}>{item.title}</Typography>
  </Stack>
);

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const role = user?.role || 'OWNER';
  const isHq = role === 'HQ_ADMIN';
  const slides = isHq ? HQ_SLIDES : OWNER_SLIDES;
  const helpers = isHq ? HQ_HELPERS : OWNER_HELPERS;
  const menu = menuFor(role);
  const allLinks = useMemo(() => menu.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title }))), [menu]);
  const aiGroup = menu.find((g) => g.title === 'AI 비서');
  const quickTabs = [
    { label: isHq ? '본사 업무' : '매장 업무', items: menu.filter((g) => g !== aiGroup).flatMap((g) => g.items) },
    { label: 'AI 서비스', items: aiGroup?.items ?? [] },
  ];

  // 히어로 슬라이드
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setSlide((s) => (s + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [slide, paused, slides.length]);
  const cur = slides[slide];

  const [quickTab, setQuickTab] = useState(0);
  // 출퇴근 상태는 현재 시각 기준이라 1분마다 다시 계산
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 60000); return () => clearInterval(t); }, []);
  const [briefIdx, setBriefIdx] = useState(0);
  const [promoIdx, setPromoIdx] = useState(0);
  const [query, setQuery] = useState('');
  const results = query.trim() ? allLinks.filter((l) => `${l.title} ${l.group}`.includes(query.trim())) : [];
  const scroller = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: number) => scroller.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });

  // 매장 데이터
  const [storeId, setStoreId] = useState<number | null>(null);
  const [storeName, setStoreName] = useState('');
  const [today, setToday] = useState<{ revenue: number; qty: number } | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [lowStock, setLowStock] = useState<{ low: number; total: number }>({ low: 0, total: 0 });
  const [week, setWeek] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(!isHq);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [pending, setPending] = useState<AgentProposal[]>([]);

  useEffect(() => {
    if (isHq || !user?.id) return;
    storeService.getMyStores(user.id)
      .then(async (stores: any[]) => {
        if (!stores?.length) { setLoading(false); return; }
        const sid: number = stores[0].id;
        setStoreId(sid);
        setStoreName(stores[0].storeName ?? '');

        const end = new Date();
        const start = new Date(); start.setDate(end.getDate() - 6);
        const fmt = (d: Date) => d.toISOString().split('T')[0];

        const [summary, inv, orders, range] = await Promise.all([
          salesService.getTodaySummary(sid).catch(() => null),
          inventoryService.getByStore(sid).catch(() => []),
          orderService.getByStore(sid).catch(() => []),
          salesService.getByDateRange(sid, fmt(start), fmt(end)).catch(() => []),
        ]);

        if (summary) setToday({ revenue: summary.revenue ?? 0, qty: summary.qty ?? 0 });

        const invArr = Array.isArray(inv) ? inv : [];
        const low = invArr.filter((x: any) => Number(x.currentQty) < Number(x.minThreshold ?? 0)).length;
        setLowStock({ low, total: invArr.length });

        const active = (Array.isArray(orders) ? orders : [])
          .filter((o: any) => !['DONE', 'CANCELLED', 'REJECTED'].includes(o.status));
        setOrderCount(active.length);

        // 최근 7일 일별 매출 (수량 × 메뉴가격)
        const byDate: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(end.getDate() - i);
          byDate[fmt(d)] = 0;
        }
        (Array.isArray(range) ? range : []).forEach((s: any) => {
          const key = s.saleDate;
          const rev = (s.quantity ?? 0) * (s.menu?.price ?? 0);
          if (key in byDate) byDate[key] += rev;
        });
        setWeek(Object.entries(byDate).map(([date, revenue]) => ({ date, revenue })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, isHq]);

  // 에이전트 소식 (본사는 전 매장, 점주는 자기 매장)
  useEffect(() => {
    if (!isHq && !storeId) return;
    const scope = isHq ? null : storeId;
    agentService.getRuns(scope).then((r) => setRuns(Array.isArray(r) ? r : [])).catch(() => {});
    agentService.getProposals(scope, 'PENDING').then((p) => setPending(Array.isArray(p) ? p : [])).catch(() => {});
  }, [isHq, storeId]);

  const briefing = useOwnerBriefing(isHq ? null : storeId);
  const todayLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  const maxRev = useMemo(() => Math.max(...week.map((w) => w.revenue), 1), [week]);
  const weekTotal = useMemo(() => week.reduce((s, w) => s + w.revenue, 0), [week]);
  const recentPending = useMemo(() => [...pending].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), [pending]);
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  const staff = STAFF.map((st) => {
    const start = toMin(st.start); const end = toMin(st.end);
    const state: keyof typeof ATTEND = nowMin < start ? 'before' : nowMin < end ? 'working' : 'off';
    const late = state !== 'before' && toMin(st.clockIn) > start ? toMin(st.clockIn) - start : 0;
    const progress = state === 'working' ? Math.round(((nowMin - start) / (end - start)) * 100) : state === 'off' ? 100 : 0;
    const detail = state === 'before' ? `${st.start} 출근 예정` : state === 'working' ? `${st.clockIn} 출근` : `${st.clockIn} 출근 · ${st.end} 퇴근`;
    return { ...st, state, late, progress, detail };
  });
  const staffCount = (k: keyof typeof ATTEND) => staff.filter((x) => x.state === k).length;

  return (
    <Box sx={{ bgcolor: '#FFFFFF' }}>
      {/* ════════ HERO (파스텔) ════════ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden', pb: { xs: 10, md: 9 },
        // 배경 사진(글자 없는 숲·채소 그림) + 왼쪽 글씨가 잘 읽히도록 흰빛 그라데이션
        background: `linear-gradient(90deg, rgba(255,255,255,.82) 0%, rgba(255,255,255,.55) 34%, rgba(255,255,255,0) 58%), url(${heroBg}) center / cover no-repeat`,
        borderBottom: '1px solid rgba(80,70,140,.10)',
      }}>
        <Box sx={{ height: { xs: 64, lg: 112 } }} />
        <Box sx={{ ...PAGE, pt: { xs: 3, md: 5 }, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 400px' }, gap: { xs: 3, lg: 4 } }}>
          {/* 왼쪽: 슬라이드 */}
          <Box onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
            sx={{ position: 'relative', minHeight: { sm: 330 }, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' } }}>
            <Box key={slide} sx={{ position: 'relative', zIndex: 1, maxWidth: { xs: 1, sm: '58%' } }}>
              <Typography sx={{ fontSize: { xs: 17, md: 22 }, fontWeight: 600, color: cur.color, animation: `${fadeUp} .6s ease both` }}>
                {cur.eyebrow}
              </Typography>
              <Typography sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1.25, mt: 0.5, color: '#1B1F3B', animation: `${fadeUp} .6s ease .1s both` }}>
                {cur.title}
              </Typography>
              <Typography sx={{ fontSize: { xs: 15, md: 17 }, color: '#4A5070', mt: 2, lineHeight: 1.7, animation: `${fadeUp} .6s ease .2s both` }}>
                {cur.desc[0]}
                <Box component="span" sx={{ fontWeight: 800, color: cur.color, textDecoration: 'underline', textUnderlineOffset: 4 }}>{cur.desc[1]}</Box>
                {cur.desc[2]}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.5} onClick={() => navigate(cur.to)} sx={{
                mt: 3, cursor: 'pointer', fontSize: 15, fontWeight: 600, color: cur.color, width: 'fit-content',
                animation: `${fadeUp} .6s ease .3s both`, '&:hover .arr': { transform: 'translateX(4px)' },
              }}>
                자세히 보기 <Box className="arr" sx={{ display: 'flex', transition: 'transform .2s' }}><IconifyIcon icon="mingcute:arrows-right-line" width={16} /></Box>
              </Stack>
              {/* 슬라이드 컨트롤 */}
              <Stack direction="row" alignItems="center" gap={0.3} sx={{
                mt: 4, width: 'fit-content', px: 1.2, py: 0.4, borderRadius: 9, bgcolor: alpha('#1B1F3B', 0.75), color: 'common.white', fontSize: 11.5,
              }}>
                <Box sx={{ fontWeight: 700, px: 0.5, fontVariantNumeric: 'tabular-nums' }}>{slide + 1} / {slides.length}</Box>
                {[
                  { icon: paused ? 'mingcute:play-fill' : 'mingcute:pause-fill', on: () => setPaused(!paused), label: paused ? '재생' : '정지' },
                  { icon: 'mingcute:left-line', on: () => setSlide((slide - 1 + slides.length) % slides.length), label: '이전' },
                  { icon: 'mingcute:right-line', on: () => setSlide((slide + 1) % slides.length), label: '다음' },
                ].map((b) => (
                  <IconButton key={b.label} size="small" aria-label={b.label} onClick={b.on} sx={{ color: 'inherit', p: 0.4 }}>
                    <IconifyIcon icon={b.icon} width={13} />
                  </IconButton>
                ))}
              </Stack>
            </Box>
          </Box>

          {/* 오른쪽: 오늘의 매장(위) + 직원 출퇴근 현황(아래) */}
          <Stack gap={2} sx={{ position: 'relative', zIndex: 1 }}>
            <Paper elevation={0} sx={{ ...CARD, borderRadius: 0, p: 2.5, boxShadow: '0 12px 32px rgba(40,50,110,0.10)' }}>
              {isHq ? (
                <>
                  <Stack direction="row" alignItems="center" gap={1.2} mb={2}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: alpha('#1D9E75', 0.12), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon="mingcute:star-line" width={19} />
                    </Box>
                    <Typography fontWeight={800} fontSize={16}>자주 찾는 서비스</Typography>
                  </Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5 }}>
                    {allLinks.slice(0, 8).map((it) => <IconTile key={it.path} item={it} size={38} onClick={() => navigate(it.path)} />)}
                  </Box>
                </>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" gap={1.2} mb={2}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: alpha('#1D9E75', 0.12), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon="mingcute:store-2-line" width={19} />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={800} fontSize={16} noWrap>{storeName || '오늘의 매장'}</Typography>
                      <Typography fontSize={12} color="text.secondary">{todayLabel} 기준</Typography>
                    </Box>
                    <MoreButton onClick={() => navigate('/sales')} />
                  </Stack>
                  {loading ? <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box> : (
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                      {[
                        { icon: 'mingcute:currency-won-line', label: '오늘 매출', value: won(today?.revenue ?? 0), sub: `${today?.qty ?? 0}건 판매`, color: '#2F7DD1', to: '/sales' },
                        { icon: 'mingcute:refresh-2-line', label: '진행 중 발주', value: `${orderCount}건`, sub: '대기·승인·배송', color: '#1D9E75', to: '/orders' },
                        { icon: 'mingcute:alert-line', label: '재고 부족', value: `${lowStock.low}종`, sub: `전체 ${lowStock.total}종`, color: lowStock.low > 0 ? '#E0803D' : '#8A90A6', to: '/inventory' },
                      ].map((x) => (
                        <Stack key={x.label} gap={0.6} onClick={() => navigate(x.to)} sx={{
                          p: 1.4, borderRadius: '8px', bgcolor: '#F6F8FB', cursor: 'pointer', minWidth: 0, transition: 'all .2s',
                          '&:hover': { bgcolor: alpha(x.color, 0.08) },
                        }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: alpha(x.color, 0.14), color: x.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconifyIcon icon={x.icon} width={16} />
                          </Box>
                          <Typography fontSize={12} color="text.secondary" mt={0.4}>{x.label}</Typography>
                          <Typography fontWeight={900} fontSize={17} lineHeight={1.1} noWrap>{x.value}</Typography>
                          <Typography fontSize={11} color="text.disabled" noWrap>{x.sub}</Typography>
                        </Stack>
                      ))}
                    </Box>
                  )}
                </>
              )}
            </Paper>

            <Paper elevation={0} sx={{ ...CARD, borderRadius: 0, p: 2.5, boxShadow: '0 12px 32px rgba(40,50,110,0.10)' }}>
              <Stack direction="row" alignItems="center" gap={1.2} mb={1.5}>
                <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: alpha('#5468C4', 0.12), color: '#5468C4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconifyIcon icon="mingcute:user-3-line" width={19} />
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={800} fontSize={16}>직원 출퇴근 현황</Typography>
                  <Typography fontSize={12} color="text.secondary">
                    {todayLabel} {String(clock.getHours()).padStart(2, '0')}:{String(clock.getMinutes()).padStart(2, '0')} 기준
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" gap={0.8} mb={1.2}>
                {(['working', 'before', 'off'] as const).map((k) => (
                  <Stack key={k} direction="row" alignItems="center" gap={0.6} sx={{ flex: 1, justifyContent: 'center', py: 0.7, borderRadius: '8px', bgcolor: ATTEND[k].bg }}>
                    <Typography fontSize={12} color={ATTEND[k].color} fontWeight={600}>{ATTEND[k].label}</Typography>
                    <Typography fontSize={14} color={ATTEND[k].color} fontWeight={900}>{staffCount(k)}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Box>
                {staff.map((st, i) => {
                  const a = ATTEND[st.state];
                  return (
                    <Stack key={st.name} direction="row" gap={1.2} alignItems="center" sx={{ py: 1, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
                      <Box sx={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, bgcolor: alpha(st.color, 0.14), color: st.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, position: 'relative',
                      }}>
                        {st.name[0]}
                        <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', bgcolor: a.color, border: '2px solid #fff' }} />
                      </Box>
                      <Box flex={1} minWidth={0}>
                        <Stack direction="row" alignItems="center" gap={0.7}>
                          <Typography fontSize={13.5} fontWeight={800}>{st.name}</Typography>
                          <Typography fontSize={11.5} color="text.secondary">{st.role}</Typography>
                          {st.late > 0 && <Box sx={{ px: 0.7, borderRadius: 9, bgcolor: '#FDF0E4', color: '#C26A1F', fontSize: 10.5, fontWeight: 700 }}>{st.late}분 지각</Box>}
                        </Stack>
                        <Typography fontSize={12} color="text.secondary" noWrap>근무 {st.start}–{st.end} · {st.detail}</Typography>
                        {st.state === 'working' && (
                          <Box sx={{ mt: 0.5, height: 4, borderRadius: 2, bgcolor: '#EEF0F4', overflow: 'hidden' }}>
                            <Box sx={{ width: `${st.progress}%`, height: 1, bgcolor: a.color, borderRadius: 2, transition: 'width .5s ease' }} />
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ px: 1, py: 0.3, borderRadius: 9, bgcolor: a.bg, color: a.color, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{a.label}</Box>
                    </Stack>
                  );
                })}
              </Box>
            </Paper>
          </Stack>
        </Box>
      </Box>

      {/* ════════ 퀵 메뉴 바 (히어로 아래로 겹침) ════════ */}
      <Box sx={{ ...PAGE, mt: { xs: -8, md: -7 }, position: 'relative', zIndex: 2 }}>
        <Stack direction="row" gap={1} mb={1.2}>
          {quickTabs.map((t, i) => (
            <Box key={t.label} onClick={() => setQuickTab(i)} sx={{
              px: 2, py: 0.7, borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 700,
              bgcolor: quickTab === i ? 'primary.main' : 'background.paper', color: quickTab === i ? 'common.white' : 'text.secondary',
              border: '1px solid', borderColor: quickTab === i ? 'primary.main' : 'divider',
              boxShadow: quickTab === i ? `0 6px 14px ${alpha(theme.palette.primary.main, 0.3)}` : 'none', transition: 'all .2s',
            }}>
              {t.label}
            </Box>
          ))}
        </Stack>
        <Paper elevation={0} sx={{ ...CARD, boxShadow: '0 16px 40px rgba(30,40,90,0.10)', py: { xs: 2, md: 2.5 }, px: { xs: 1, md: 3 } }}>
          <Box key={quickTab} sx={{
            display: 'grid', gap: { xs: 1.5, md: 1 }, animation: `${fadeUp} .4s ease both`,
            gridTemplateColumns: { xs: 'repeat(4, 1fr)', md: `repeat(${Math.max(quickTabs[quickTab].items.length, 4)}, 1fr)` },
          }}>
            {quickTabs[quickTab].items.map((it) => <IconTile key={it.path} item={it} onClick={() => navigate(it.path)} />)}
          </Box>
        </Paper>
      </Box>

      {/* ════════ 검색 ════════ */}
      <Box sx={{ ...PAGE, pt: { xs: 7, md: 10 }, pb: { xs: 5, md: 7 }, textAlign: 'center', position: 'relative', zIndex: 3 }}>
        <Reveal>
          <Stack direction="row" alignItems="center" justifyContent="center" gap={1.5}>
            <Typography sx={{ fontSize: { xs: 24, md: 32 }, fontWeight: 900, letterSpacing: '-0.5px' }}>어떤 도움이 필요하세요?</Typography>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, width: 52, height: 52, borderRadius: '35%', bgcolor: alpha('#6A4BD1', 0.1), color: '#6A4BD1', alignItems: 'center', justifyContent: 'center', animation: `${floaty} 3s ease-in-out infinite` }}>
              <IconifyIcon icon="mingcute:robot-line" width={30} />
            </Box>
          </Stack>
          <Box sx={{ position: 'relative', maxWidth: 520, mx: 'auto', mt: 3 }}>
            <Stack direction="row" alignItems="center" sx={{
              border: '2px solid', borderColor: 'primary.main', borderRadius: 9, px: 2.5, py: 0.6, bgcolor: 'background.paper',
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
            }}>
              <InputBase value={query} onChange={(e) => setQuery(e.target.value)} placeholder="메뉴 이름으로 검색해 보세요 (예: 발주, 기부)"
                onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) navigate(results[0].path); }}
                sx={{ flex: 1, fontSize: 15, '& .MuiInputBase-input': { py: 1, '&::placeholder': { color: 'text.secondary', opacity: 0.8 } } }} inputProps={{ 'aria-label': '메뉴 검색' }} />
              {query && <IconButton size="small" onClick={() => setQuery('')} aria-label="지우기"><IconifyIcon icon="mingcute:close-line" width={16} /></IconButton>}
              <IconifyIcon icon="mingcute:search-line" width={22} sx={{ color: 'primary.main', ml: 0.5 }} />
            </Stack>
            {query.trim() && (
              <Paper elevation={0} sx={{ ...CARD, position: 'absolute', left: 0, right: 0, top: 'calc(100% + 8px)', zIndex: 5, textAlign: 'left', py: 1, boxShadow: '0 16px 40px rgba(30,40,90,0.14)' }}>
                {results.length === 0 ? (
                  <Typography fontSize={13.5} color="text.disabled" px={2.5} py={1.5}>일치하는 메뉴가 없습니다</Typography>
                ) : results.map((r) => (
                  <Stack key={r.path} direction="row" alignItems="center" gap={1.5} onClick={() => navigate(r.path)}
                    sx={{ px: 2.5, py: 1.2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                    <IconifyIcon icon={r.icon} width={18} sx={{ color: 'primary.main' }} />
                    <Typography fontSize={14} fontWeight={600} flex={1}>{r.title}</Typography>
                    <Typography fontSize={12} color="text.disabled">{r.group}</Typography>
                  </Stack>
                ))}
              </Paper>
            )}
          </Box>
        </Reveal>
      </Box>

      {/* ════════ 자주 쓰는 메뉴 카드 ════════ */}
      <Box sx={{ ...PAGE, pb: { xs: 5, md: 6 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '230px 1fr' }, gap: { xs: 2.5, md: 3 }, alignItems: 'start' }}>
          <Reveal>
            <Box>
              <Typography sx={{ fontSize: { xs: 20, md: 23 }, fontWeight: 900, lineHeight: 1.35, letterSpacing: '-0.5px' }}>
                FoodGuard 에서<br />자주 쓰는 메뉴들을<br />모아봤어요!
              </Typography>
              <Typography fontSize={13} color="text.secondary" mt={1.5} sx={{ wordBreak: 'keep-all' }}>바로가기를 누르면 해당 화면으로 바로 이동해요.</Typography>
              <Stack gap={1} mt={2.5} direction={{ xs: 'row', md: 'column' }}>
                {(aiGroup?.items ?? []).slice(1, 3).map((it) => (
                  <Stack key={it.path} direction="row" alignItems="center" justifyContent="space-between" onClick={() => navigate(it.path)} sx={{
                    ...CARD, boxShadow: 'none', px: 2, py: 1.2, cursor: 'pointer', fontSize: 13, fontWeight: 600, flex: { xs: 1, md: 'none' },
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                  }}>
                    {it.title} <IconifyIcon icon={it.icon} width={18} sx={{ color: 'primary.main' }} />
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Reveal>
          <Box sx={{ position: 'relative', minWidth: 0 }}>
            {[-1, 1].map((d) => (
              <IconButton key={d} onClick={() => scrollBy(d)} aria-label={d < 0 ? '이전 카드' : '다음 카드'} sx={{
                display: { xs: 'none', md: 'flex' }, position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 2,
                [d < 0 ? 'left' : 'right']: 0, width: 34, height: 34, bgcolor: '#1B1F3B', color: 'common.white',
                '&:hover': { bgcolor: '#1B1F3B', opacity: 0.85 },
              }}>
                <IconifyIcon icon={d < 0 ? 'mingcute:left-line' : 'mingcute:right-line'} width={18} />
              </IconButton>
            ))}
            <Box ref={scroller} sx={{
              display: 'flex', gap: 1.5, overflowX: 'auto', scrollSnapType: 'x mandatory', pb: 1, px: { md: 5.5 }, scrollPaddingLeft: { md: 44 },
              scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
            }}>
              {helpers.map((h, i) => (
                <Box key={h.q} sx={{ flex: '0 0 auto', width: { xs: 230, md: 210 }, scrollSnapAlign: 'start' }}>
                  <Reveal delay={i * 0.06}>
                    {/* 첨부 시안 카드: 연회색 상자 + 분류 + 오른쪽 위 아이콘 + 질문 + 흰 링크 줄 */}
                    <Box sx={{
                      bgcolor: '#F4F6FA', borderRadius: '10px', p: 2, height: 1, display: 'flex', flexDirection: 'column',
                      border: '1px solid transparent', transition: 'all .25s',
                      '&:hover': { borderColor: alpha(h.color, 0.4), bgcolor: '#FFFFFF', boxShadow: `0 12px 28px ${alpha(h.color, 0.16)}` },
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography fontSize={12} fontWeight={700} color="text.secondary">{h.cat}</Typography>
                        <Box sx={{
                          width: 38, height: 38, borderRadius: '10px', color: 'common.white',
                          background: `linear-gradient(145deg, ${alpha(h.color, 0.75)} 0%, ${h.color} 100%)`,
                          boxShadow: `0 6px 14px ${alpha(h.color, 0.35)}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <IconifyIcon icon={h.icon} width={21} />
                        </Box>
                      </Stack>
                      <Typography fontSize={14.5} fontWeight={800} lineHeight={1.4} mt={1.5} mb={2} sx={{ minHeight: 41, wordBreak: 'keep-all' }}>{h.q}</Typography>
                      <Stack gap={0.8} mt="auto">
                        {h.links.map((l) => (
                          <Stack key={l.path + l.title} direction="row" alignItems="center" justifyContent="space-between" onClick={() => navigate(l.path)} sx={{
                            px: 1.4, py: 0.9, borderRadius: '6px', bgcolor: 'common.white', border: '1px solid #E6E9F0', cursor: 'pointer', fontSize: 12,
                            '&:hover': { borderColor: h.color, color: h.color },
                          }}>
                            {l.title} <IconifyIcon icon="mingcute:right-line" width={14} />
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Reveal>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ════════ 배너 카드 ════════ */}
      <Box sx={{ ...PAGE, pb: { xs: 7, md: 10 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {[
            { title: 'AI 에이전트 9종', desc: '발주·폐기·기부·입고를 에이전트가 먼저 살펴봐요.', icon: 'mingcute:robot-line', color: '#5468C4', bg: '#EEF1FB', to: '/agents', cta: '센터 보기' },
            { title: `승인 대기 제안 ${pending.length}건`, desc: '에이전트 제안은 사람이 승인해야 실행돼요.', icon: 'mingcute:inbox-line', color: '#E0803D', bg: '#FDF3EA', to: '/agent-inbox', cta: '확인하기' },
            ...(isHq ? [
              { title: '환경 통계 분석', desc: '가맹점 전체의 폐기·기부 지표를 확인해요.', icon: 'mingcute:chart-bar-fill', color: '#1D9E75', bg: '#E9F6F1', to: '/admin/stats', cta: '통계 보기' },
              { title: '발주 관리', desc: '가맹점에서 올라온 발주를 심사해요.', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', bg: '#EAF2FB', to: '/admin/orders', cta: '바로가기' },
            ] : [
              { title: '폐기 예측 & 기부', desc: '버려질 식자재를 미리 찾아 이웃과 나눠요.', icon: 'mingcute:heart-line', color: '#D0457F', bg: '#FCEEF4', to: '/waste-prediction', cta: '바로가기' },
              { title: 'AI 수요 예측', desc: '메뉴별 내일 판매량을 미리 확인해요.', icon: 'mingcute:brain-fill', color: '#6A4BD1', bg: '#F1EDFC', to: '/predictions', cta: '예측 보기' },
            ]),
          ].map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <Stack direction="row" sx={{ bgcolor: b.bg, borderRadius: '10px', p: 2.5, height: 1, gap: 1.5, position: 'relative', overflow: 'hidden' }}>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={800} fontSize={15.5}>{b.title}</Typography>
                  <Typography fontSize={12.5} color="text.secondary" mt={0.8} sx={{ wordBreak: 'keep-all' }}>{b.desc}</Typography>
                  <Stack direction="row" alignItems="center" gap={0.5} onClick={() => navigate(b.to)} sx={{
                    mt: 2, width: 'fit-content', px: 1.6, py: 0.6, borderRadius: '6px', bgcolor: b.color, color: 'common.white',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', '&:hover': { filter: 'brightness(.92)' },
                  }}>
                    {b.cta} <IconifyIcon icon="mingcute:right-line" width={13} />
                  </Stack>
                </Box>
                <Box sx={{ color: b.color, opacity: 0.9, animation: `${floaty} 4s ease-in-out ${i * 0.4}s infinite` }}>
                  <IconifyIcon icon={b.icon} width={52} />
                </Box>
              </Stack>
            </Reveal>
          ))}
        </Box>
      </Box>

      {/* ════════ 매장 현황 (남색 띠) ════════ */}
      {!isHq && (
        <Box sx={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #172457 0%, #24366F 60%, #2C3F78 100%)', py: { xs: 7, md: 10 } }}>
          {/* 반짝이는 별 */}
          {Array.from({ length: 28 }).map((_, i) => (
            <Box key={i} sx={{
              position: 'absolute', width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, borderRadius: '50%', bgcolor: 'common.white',
              top: `${(i * 37) % 60}%`, left: `${(i * 53) % 100}%`, animation: `${twinkle} ${2 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
            }} />
          ))}
          <Box sx={{ ...PAGE, position: 'relative' }}>
            <Reveal>
              <Typography textAlign="center" sx={{ color: 'common.white', fontSize: { xs: 22, md: 30 }, fontWeight: 900, letterSpacing: '-0.5px', mb: { xs: 3, md: 5 } }}>
                우리 매장 현황을 자세히 알려드려요
              </Typography>
            </Reveal>
            {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: 'common.white' }} /></Box> : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' }, gap: 2 }}>
                <Reveal>
                  <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 }, height: 1 }}>
                    <CardHead title="매출 현황" more={() => navigate('/sales')} />
                    <Typography fontSize={12.5} color="primary.main" fontWeight={700} sx={{ textDecoration: 'underline', textUnderlineOffset: 4 }}>최근 7일</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, sm: 2 }, height: { xs: 170, md: 210 }, mt: 2, px: { sm: 2 } }}>
                      {week.map((w) => {
                        const h = Math.round((w.revenue / maxRev) * 100);
                        const dt = new Date(w.date);
                        const isToday = w.date === new Date().toISOString().split('T')[0];
                        return (
                          <Stack key={w.date} flex={1} alignItems="center" gap={0.8} sx={{ height: '100%', justifyContent: 'flex-end', minWidth: 0 }}>
                            <Typography fontSize={11} fontWeight={700} noWrap sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {w.revenue > 0 ? wonShort(w.revenue) : ''}
                            </Typography>
                            <Box sx={{
                              width: '100%', maxWidth: 34, height: `${Math.max(h, 2)}%`, borderRadius: '6px 6px 0 0',
                              bgcolor: isToday ? '#23B05B' : '#2F7DD1', transition: 'height .5s ease',
                            }} />
                            <Typography fontSize={11} color={isToday ? 'success.main' : 'text.secondary'} fontWeight={isToday ? 700 : 400}>
                              {`${dt.getMonth() + 1}/${dt.getDate()}`}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Box>
                    <Stack direction="row" justifyContent="center" gap={{ xs: 2, sm: 4 }} mt={2.5} flexWrap="wrap">
                      {[
                        { k: '7일 합계', v: won(weekTotal) },
                        { k: '오늘', v: won(today?.revenue ?? 0) },
                        { k: '오늘 판매', v: `${today?.qty ?? 0}건`, hl: true },
                      ].map((x) => (
                        <Stack key={x.k} direction="row" alignItems="baseline" gap={0.8}>
                          <Typography fontSize={12} color="text.secondary">{x.k}</Typography>
                          <Typography fontWeight={800} fontSize={x.hl ? 20 : 17} color={x.hl ? '#2F7DD1' : 'text.primary'}>{x.v}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>
                </Reveal>
                <Stack gap={2}>
                  <Reveal delay={0.1}>
                    <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 } }}>
                      <CardHead title="재고 현황" more={() => navigate('/inventory')} />
                      <Typography fontSize={13} color="text.secondary" mb={2}>
                        {lowStock.low > 0 ? `전체 ${lowStock.total}종 중 ${lowStock.low}종이 부족해요. 발주가 필요합니다.` : `전체 ${lowStock.total}종 모두 충분해요.`}
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        {(menu.find((g) => g.title === '식자재 관리')?.items ?? []).concat(menu.find((g) => g.title === '매출 · 나눔')?.items.slice(1, 2) ?? [])
                          .map((it) => <IconTile key={it.path} item={it} size={40} onClick={() => navigate(it.path)} />)}
                      </Box>
                    </Paper>
                  </Reveal>
                  <Reveal delay={0.2}>
                    <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 } }}>
                      <CardHead title="AI 비서" more={() => navigate('/agents')} />
                      <Typography fontSize={13} color="text.secondary" mb={2}>
                        수요 예측부터 발주안·폐기 대응까지, 에이전트가 먼저 제안하고 사장님이 결정해요.
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        {(aiGroup?.items ?? []).concat(menu.find((g) => g.title === '매출 · 나눔')?.items.slice(2, 3) ?? [])
                          .map((it) => <IconTile key={it.path} item={it} size={40} onClick={() => navigate(it.path)} />)}
                      </Box>
                    </Paper>
                  </Reveal>
                </Stack>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* ════════ 매장 소식 (첨부 시안의 '다양한 소식' 섹션 형태) ════════ */}
      <Box sx={{ ...PAGE, py: { xs: 7, md: 10 } }}>
        <Reveal>
          <Stack direction="row" alignItems="center" justifyContent="center" gap={1.5} mb={{ xs: 3, md: 5 }}>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, width: 52, height: 52, borderRadius: '50%', bgcolor: alpha('#1D9E75', 0.1), color: 'primary.main', alignItems: 'center', justifyContent: 'center', animation: `${floaty} 3s ease-in-out infinite` }}>
              <IconifyIcon icon="mingcute:news-line" width={28} />
            </Box>
            <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 900, letterSpacing: '-0.5px', textAlign: 'center' }}>
              우리 매장 소식을 확인해 보세요!
            </Typography>
          </Stack>
        </Reveal>

        {/* 1줄: 브리핑 · 승인 대기 · 바로가기 존 */}
        {isHq ? (
          <Reveal>
            <NewsHead label="매장별 위험 현황" />
            <HqBriefing />
          </Reveal>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 2fr' }, gap: 2 }}>
            <Reveal>
              <NewsHead label="오늘의 브리핑" count={briefing ? `${briefIdx + 1} / ${briefing.length}` : undefined}
                onPrev={briefing ? () => setBriefIdx((briefIdx - 1 + briefing.length) % briefing.length) : undefined}
                onNext={briefing ? () => setBriefIdx((briefIdx + 1) % briefing.length) : undefined} />
              {!briefing ? <Box sx={{ ...NEWS_BOX, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box> : (() => {
                const c = briefing[briefIdx];
                const t = TONE[c.tone];
                return (
                  <Box key={briefIdx} onClick={() => navigate(c.to)} sx={{
                    ...NEWS_BOX, bgcolor: t.bg, borderColor: 'transparent', p: 2.5, cursor: 'pointer', display: 'flex', flexDirection: 'column', animation: `${fadeUp} .4s ease both`,
                  }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography fontWeight={800} fontSize={15}>{c.title}</Typography>
                      <Box sx={{ px: 1, py: 0.2, borderRadius: 9, bgcolor: 'common.white', color: t.color, fontSize: 11.5, fontWeight: 700 }}>{t.label}</Box>
                    </Stack>
                    <Box sx={{ my: 'auto', textAlign: 'center' }}>
                      <Box sx={{ width: 60, height: 60, mx: 'auto', borderRadius: '50%', bgcolor: 'common.white', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${alpha(t.color, 0.2)}` }}>
                        <IconifyIcon icon={CARD_ICON[c.title]} width={30} />
                      </Box>
                      <Typography fontWeight={900} fontSize={22} mt={1.5}>{c.value}</Typography>
                      <Typography fontSize={12.5} color="text.secondary" mt={0.5} sx={{ wordBreak: 'keep-all' }}>{c.sub}</Typography>
                    </Box>
                    <Typography fontSize={12.5} fontWeight={700} color={t.color} textAlign="right">자세히 보기 ›</Typography>
                  </Box>
                );
              })()}
            </Reveal>

            <Reveal delay={0.08}>
              <NewsHead label="승인 대기" count={`${pending.length}건`} />
              <Box sx={{ ...NEWS_BOX, p: 2, display: 'flex', flexDirection: 'column' }}>
                {recentPending.length === 0 ? (
                  <Stack alignItems="center" justifyContent="center" gap={1.2} sx={{ flex: 1, textAlign: 'center' }}>
                    <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: alpha('#1D9E75', 0.1), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon="mingcute:check-circle-line" width={30} />
                    </Box>
                    <Typography fontWeight={800} fontSize={15}>모두 처리했어요</Typography>
                    <Typography fontSize={12.5} color="text.secondary">새 제안이 올라오면 여기에 보여드려요.</Typography>
                  </Stack>
                ) : recentPending.slice(0, 3).map((p, i) => (
                  <Box key={p.id} onClick={() => navigate('/agent-inbox')} sx={{ py: 1.2, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider', cursor: 'pointer', '&:hover .t': { color: 'primary.main' } }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography fontSize={12} fontWeight={700} color="warning.dark">{AGENTS[p.agent]?.name ?? p.agent}</Typography>
                      <Typography fontSize={11.5} color="text.disabled">{mmdd(p.createdAt)}</Typography>
                    </Stack>
                    <Typography className="t" fontSize={13} sx={{ mt: 0.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.rationale || p.type}
                    </Typography>
                  </Box>
                ))}
                <Box onClick={() => navigate('/agent-inbox')} sx={{
                  mt: 'auto', textAlign: 'center', py: 1, borderRadius: '6px', border: '1px solid', borderColor: 'divider', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}>
                  승인함 바로가기
                </Box>
              </Box>
            </Reveal>

            <Reveal delay={0.16}>
              <NewsHead label="바로가기 존" count={`${promoIdx + 1} / ${PROMOS.length}`}
                onPrev={() => setPromoIdx((promoIdx - 1 + PROMOS.length) % PROMOS.length)}
                onNext={() => setPromoIdx((promoIdx + 1) % PROMOS.length)} />
              {(() => {
                const pr = PROMOS[promoIdx];
                return (
                  <Box key={promoIdx} onClick={() => navigate(pr.to)} sx={{
                    ...NEWS_BOX, borderColor: 'transparent', position: 'relative', overflow: 'hidden', cursor: 'pointer', p: { xs: 2.5, md: 3.5 },
                    background: pr.bg, display: 'flex', flexDirection: 'column', justifyContent: 'center', animation: `${fadeUp} .4s ease both`,
                  }}>
                    <Box sx={{ position: 'absolute', right: { xs: -10, md: 28 }, bottom: { xs: -10, md: 'auto' }, top: { md: '50%' }, transform: { md: 'translateY(-50%)' }, color: pr.color, opacity: { xs: 0.25, md: 1 } }}>
                      <Box sx={{ width: { xs: 120, md: 150 }, height: { xs: 120, md: 150 }, borderRadius: '50%', bgcolor: alpha('#fff', 0.75), display: 'flex', alignItems: 'center', justifyContent: 'center', animation: `${floaty} 4s ease-in-out infinite` }}>
                        <IconifyIcon icon={pr.icon} width={72} />
                      </Box>
                    </Box>
                    <Box sx={{ position: 'relative', maxWidth: { md: '60%' } }}>
                      <Box sx={{ display: 'inline-block', px: 1.2, py: 0.3, borderRadius: 9, bgcolor: pr.color, color: 'common.white', fontSize: 11.5, fontWeight: 700 }}>{pr.tag}</Box>
                      <Typography sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 900, mt: 1.5, lineHeight: 1.3, whiteSpace: 'pre-line', color: '#1B1F3B' }}>{pr.title}</Typography>
                      <Typography fontSize={13.5} color="#4A5070" mt={1}>{pr.desc}</Typography>
                      <Typography fontSize={13} fontWeight={700} color={pr.color} mt={2}>바로가기 ›</Typography>
                    </Box>
                  </Box>
                );
              })()}
            </Reveal>
          </Box>
        )}

        {/* 2줄: 안내 카드 세 개 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mt: 2.5 }}>
          {[
            { title: 'AI 코파일럿', desc: '매장 데이터에 대해 궁금한 걸 물어보세요.', icon: 'mingcute:chat-3-line', color: '#5468C4',
              buttons: [{ label: '대화 시작하기', on: () => window.dispatchEvent(new Event('fg:open-copilot')) }] },
            { title: '에이전트 실행 기록', desc: `최근 7일 동안 ${runs.filter((r) => Date.now() - new Date(r.startedAt).getTime() < 7 * 86400000).length}회 실행됐어요.`, icon: 'mingcute:robot-line', color: '#1D9E75',
              buttons: [{ label: '에이전트 센터', on: () => navigate('/agents') }, { label: '승인함', on: () => navigate('/agent-inbox') }] },
            isHq
              ? { title: '가맹점 발주 관리', desc: '가맹점에서 올라온 발주를 심사해요.', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', buttons: [{ label: '발주 관리', on: () => navigate('/admin/orders') }] }
              : { title: '오늘 판매 기록', desc: 'POS 로 주문을 받거나 판매량을 직접 입력해요.', icon: 'mdi:cash-register', color: '#2F7DD1',
                buttons: [{ label: 'POS 열기', on: () => navigate('/pos') }, { label: '판매 입력', on: () => navigate('/sales') }] },
          ].map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <Stack direction="row" sx={{ ...CARD, boxShadow: 'none', p: 2.5, height: 1, gap: 2, alignItems: 'center' }}>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={800} fontSize={16}>{c.title}</Typography>
                  <Typography fontSize={13} color="text.secondary" mt={0.6}>{c.desc}</Typography>
                  <Stack direction="row" gap={1} mt={2} flexWrap="wrap">
                    {c.buttons.map((b) => (
                      <Stack key={b.label} direction="row" alignItems="center" gap={0.5} onClick={b.on} sx={{
                        px: 1.6, py: 0.7, borderRadius: '6px', border: '1px solid', borderColor: alpha(c.color, 0.5), color: c.color,
                        fontSize: 12.5, fontWeight: 700, cursor: 'pointer', '&:hover': { bgcolor: alpha(c.color, 0.08) },
                      }}>
                        {b.label} <IconifyIcon icon="mingcute:right-line" width={13} />
                      </Stack>
                    ))}
                  </Stack>
                </Box>
                <Box sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: '50%', bgcolor: alpha(c.color, 0.1), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconifyIcon icon={c.icon} width={38} />
                </Box>
              </Stack>
            </Reveal>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
