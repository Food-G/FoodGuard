import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Stack, useTheme, alpha, CircularProgress, InputBase, IconButton, keyframes,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import heroBg from '../assets/hero-slide.jpg';
import { menuFor, MenuLink } from '../layouts/main-layout/menu';
import { storeService } from '../services/storeService';
import { salesService } from '../services/salesService';
import { inventoryService } from '../services/inventoryService';
import { orderService } from '../services/orderService';
import { predictionService } from '../services/predictionService';
import { wastePredictionService } from '../services/wastePredictionService';
import { employeeService, attendanceService, Employee, Attendance } from '../services/employeeService';
import { hhmm, localDate } from '../helpers/date';

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
// 원화 축약 (소수점 생략): 45,000 → ₩4만, 8,000 → ₩8천, 500 → ₩500
const wonShort = (n: number) => {
  if (n >= 10000) return `₩${Math.floor(n / 10000)}만`;
  if (n >= 1000) return `₩${Math.floor(n / 1000)}천`;
  return `₩${Math.round(n)}`;
};
const mmdd = (s: string) => {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 재고 경고 기준: 재고 1 이하, 유통기한 3일 이내(그날 24:00 까지)
const LOW_STOCK_QTY = 1;
const EXPIRY_SOON_DAYS = 3;
const qtyOf = (item: any) => Number(item.currentQty ?? item.quantity ?? 0);
const expiryEnd = (expiryDate: string) => {
  const [y, m, d] = expiryDate.split('-').map(Number);
  return new Date(y, m - 1, d + 1);
};
const isAlert = (item: any) => {
  if (qtyOf(item) <= LOW_STOCK_QTY) return true;
  if (!item.expiryDate) return false;
  const soon = new Date(); soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
  return expiryEnd(item.expiryDate) <= soon;
};

// 오늘의 브리핑 카드 (매장 데이터로 만든다)
type Tone = 'attention' | 'ok' | 'unknown';
const TONE: Record<Tone, { label: string; color: string; bg: string }> = {
  attention: { label: '확인 필요', color: '#E0803D', bg: '#FDF3EA' },
  ok: { label: '양호', color: '#1D9E75', bg: '#E9F6F1' },
  unknown: { label: '정보 없음', color: '#8A90A6', bg: '#F4F6F9' },
};
interface BriefingCard { title: string; icon: string; value: string; sub: string; tone: Tone; to: string }
interface Recommendation { ingredientId: number; ingredientName: string; orderQty: number }
interface TodaySummary { quantity: number; revenue: number }

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
  { eyebrow: 'AI 수요 예측', title: '내일 판매량 미리 보기', desc: ['메뉴별 판매량을 예측하고, ', '재고·보관기한에 맞춘 발주량', '을 추천합니다.'], to: '/predictions', color: '#6A4BD1' },
  { eyebrow: '폐기 예측 & 기부', title: '남는 식자재는 이웃에게', desc: ['폐기 위험을 미리 감지해 ', '가까운 기부처', '와 연결합니다.'], to: '/waste-prediction', color: '#D0457F' },
];
const HQ_SLIDES: Slide[] = [
  { eyebrow: '가맹점 네트워크', title: '전 매장의 운영을 한눈에', desc: ['매장별 발주와 ', '환경 지표', '를 한곳에서 살핍니다.'], to: '/admin/stores', color: '#1D9E75' },
  { eyebrow: '발주 관리', title: '발주 진행을 단계별로', desc: ['승인부터 배송·검수까지 ', '발주 단계', '를 한곳에서 처리합니다.'], to: '/admin/orders', color: '#2F7DD1' },
];

// ── 본사: 발주 진행 단계 (발주 관리 화면의 상태 이름과 같게) ──
const HQ_STAGES = [
  { key: 'REQUESTED', label: '승인 대기', short: '승인 대기', color: '#E0803D' },
  { key: 'APPROVED', label: '발송 필요', short: '발송 필요', color: '#2F7DD1' },
  { key: 'HQ_SENT', label: '배달기사 수령 대기', short: '기사 수령', color: '#6A4BD1' },
  { key: 'DRIVER_RECEIVED', label: '가맹점주 검수 대기', short: '점주 검수', color: '#1D9E75' },
];
// ── 자주 쓰는 메뉴 카드 ──
interface Helper { cat: string; icon: string; color: string; q: string; links: MenuLink[] }
const L = (title: string, path: string): MenuLink => ({ title, path, icon: '' });
const OWNER_HELPERS: Helper[] = [
  { cat: '매출', icon: 'mingcute:chart-line-line', color: '#2F7DD1', q: '오늘 얼마나 팔았는지 궁금해요!', links: [L('판매 입력', '/sales'), L('POS 시스템', '/pos')] },
  { cat: '발주', icon: 'mingcute:refresh-2-line', color: '#1D9E75', q: '부족한 식자재를 주문하고 싶어요!', links: [L('식자재 발주', '/orders'), L('재고 현황', '/inventory')] },
  { cat: '예측', icon: 'mingcute:brain-fill', color: '#6A4BD1', q: '내일 얼마나 팔릴지 알고 싶어요!', links: [L('AI 수요 예측', '/predictions'), L('발주 추천 보기', '/orders')] },
  { cat: '폐기·기부', icon: 'mingcute:heart-line', color: '#D0457F', q: '버려질 재료를 줄이고 싶어요!', links: [L('폐기 예측 & 기부', '/waste-prediction'), L('기부 이력', '/donations')] },
  { cat: '메뉴', icon: 'mingcute:fork-spoon-line', color: '#E0803D', q: '메뉴와 레시피를 바꾸고 싶어요!', links: [L('메뉴 관리', '/menus'), L('식자재 목록', '/ingredients')] },
  { cat: '직원', icon: 'mingcute:user-3-line', color: '#5468C4', q: '오늘 누가 일하는지 보고 싶어요!', links: [L('직원 목록', '/staff'), L('출퇴근', '/clock')] },
  { cat: 'AI 비서', icon: 'mingcute:chat-3-line', color: '#7A4FD6', q: '매장 상황을 물어보고 싶어요!', links: [L('AI 운영 비서', '/assistant'), L('매출 통계', '/sales-stats')] },
];
const HQ_HELPERS: Helper[] = [
  { cat: '가맹점', icon: 'mingcute:grid-fill', color: '#1D9E75', q: '매장들을 한눈에 보고 싶어요!', links: [L('가맹점 네트워크', '/admin/stores'), L('환경 통계 분석', '/admin/stats')] },
  { cat: '발주', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', q: '들어온 발주를 처리하고 싶어요!', links: [L('발주 관리', '/admin/orders')] },
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

// 남색 띠 섹션: 반짝이는 별 + 가운데 제목
const NavyBand = ({ title, children }: { title: string; children: ReactNode }) => (
  <Box sx={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg, #172457 0%, #24366F 60%, #2C3F78 100%)', py: { xs: 7, md: 10 } }}>
    {Array.from({ length: 28 }).map((_, i) => (
      <Box key={i} sx={{
        position: 'absolute', width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, borderRadius: '50%', bgcolor: 'common.white',
        top: `${(i * 37) % 60}%`, left: `${(i * 53) % 100}%`, animation: `${twinkle} ${2 + (i % 4)}s ease-in-out ${i * 0.3}s infinite`,
      }} />
    ))}
    <Box sx={{ ...PAGE, position: 'relative' }}>
      <Reveal>
        <Typography textAlign="center" sx={{ color: 'common.white', fontSize: { xs: 22, md: 30 }, fontWeight: 900, letterSpacing: '-0.5px', mb: { xs: 3, md: 5 } }}>
          {title}
        </Typography>
      </Reveal>
      {children}
    </Box>
  </Box>
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
  const linksOf = (paths: string[]) => paths.map((p) => allLinks.find((l) => l.path === p)).filter((l): l is MenuLink & { group: string } => !!l);
  const quickTabs = [
    { label: isHq ? '본사 업무' : '매장 업무', items: menu.filter((g) => g !== aiGroup).flatMap((g) => g.items) },
    { label: 'AI 서비스', items: aiGroup?.items ?? [] },
  ].filter((t) => t.items.length);

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
  const [lowStock, setLowStock] = useState<{ low: number; total: number }>({ low: 0, total: 0 });
  const [week, setWeek] = useState<{ date: string; revenue: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState<BriefingCard[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  // 본사 데이터 (전 가맹점·전 발주)
  const [hqStores, setHqStores] = useState<any[]>([]);
  const [hqOrders, setHqOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!isHq) return;
    Promise.all([storeService.getAll().catch(() => []), orderService.getAll().catch(() => [])])
      .then(([stores, orders]) => {
        setHqStores(Array.isArray(stores) ? stores : []);
        setHqOrders(Array.isArray(orders) ? orders : []);
      })
      .finally(() => setLoading(false));
  }, [isHq]);

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

        const [summary, inv, range] = await Promise.all([
          salesService.getTodaySummary(sid).catch(() => null) as Promise<TodaySummary | null>,
          inventoryService.getByStore(sid).catch(() => []),
          salesService.getByDateRange(sid, fmt(start), fmt(end)).catch(() => []),
        ]);

        if (summary) setToday({ revenue: summary.revenue ?? 0, qty: summary.quantity ?? 0 });

        const invArr = Array.isArray(inv) ? inv : [];
        const low = invArr.filter(isAlert).length;
        setLowStock({ low, total: invArr.length });

        // 최근 7일 일별 매출 (수량 × 메뉴가격)
        const byDate: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(end.getDate() - i);
          byDate[fmt(d)] = 0;
        }
        (Array.isArray(range) ? range : []).forEach((s: any) => {
          const key = s.saleDate;
          // 할인 판매는 기록된 판매가 (매출 = COALESCE(unit_price, 메뉴 가격))
          const rev = (s.quantity ?? 0) * (s.unitPrice ?? s.menu?.price ?? 0);
          if (key in byDate) byDate[key] += rev;
        });
        setWeek(Object.entries(byDate).map(([date, revenue]) => ({ date, revenue })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, isHq]);

  // 오늘의 브리핑: 발주 추천·폐기 위험·내일 판매 예측·재고 경고 (실패한 항목은 '정보 없음')
  useEffect(() => {
    if (!storeId) return;
    let alive = true;
    const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    Promise.all([
      orNull(orderService.getRecommend(storeId) as Promise<Recommendation[]>),
      orNull(wastePredictionService.summary(storeId) as Promise<any>),
      orNull(predictionService.getByStore(storeId)),
      orNull(inventoryService.getByStore(storeId) as Promise<any[]>),
    ]).then(([recs, waste, preds, inv]) => {
      if (!alive) return;
      const need = recs ? recs.filter((r) => r.orderQty > 0) : null;
      const wasteCount = waste ? Number(waste.wasteCount ?? 0) : null;
      const first = preds?.length ? [...preds].map((p) => p.predictionDate).sort()[0] : null;
      const firstTotal = first ? Math.round(preds!.filter((p) => p.predictionDate === first).reduce((s, p) => s + p.predictedQty, 0)) : 0;
      const alerts = inv ? inv.filter(isAlert).length : null;
      setBriefing([
        need == null ? { title: '발주 추천', icon: 'mingcute:refresh-2-line', value: '확인 불가', sub: '발주 추천을 불러오지 못했어요', tone: 'unknown', to: '/orders' }
          : { title: '발주 추천', icon: 'mingcute:refresh-2-line', value: `${need.length}종`, sub: need.length ? `${need.slice(0, 2).map((r) => r.ingredientName).join('·')} 등 발주가 필요해요` : '지금은 발주할 식자재가 없어요', tone: need.length ? 'attention' : 'ok', to: '/orders' },
        wasteCount == null ? { title: '폐기 위험', icon: 'mingcute:delete-2-line', value: '확인 불가', sub: '폐기 예측을 불러오지 못했어요', tone: 'unknown', to: '/waste-prediction' }
          : { title: '폐기 위험', icon: 'mingcute:delete-2-line', value: `${wasteCount}건`, sub: wasteCount ? '할인 판매나 기부로 줄일 수 있어요' : '폐기 위험 식자재가 없어요', tone: wasteCount ? 'attention' : 'ok', to: '/waste-prediction' },
        !first ? { title: '판매 예측', icon: 'mingcute:brain-fill', value: '예측 없음', sub: 'AI 수요 예측을 실행해 주세요', tone: 'unknown', to: '/predictions' }
          : { title: '판매 예측', icon: 'mingcute:brain-fill', value: `${firstTotal.toLocaleString()}개`, sub: `${mmdd(first)} 전체 메뉴 예상 판매량`, tone: 'ok', to: '/predictions' },
        alerts == null ? { title: '재고 경고', icon: 'mingcute:box-3-line', value: '확인 불가', sub: '재고를 불러오지 못했어요', tone: 'unknown', to: '/inventory' }
          : { title: '재고 경고', icon: 'mingcute:box-3-line', value: `${alerts}종`, sub: alerts ? '재고가 적거나 유통기한이 3일 안에 끝나요' : '재고가 모두 넉넉해요', tone: alerts ? 'attention' : 'ok', to: '/inventory' },
      ]);
    });
    const today = localDate(new Date());
    employeeService.getByStore(storeId).then((e) => alive && setEmployees(e ?? [])).catch(() => {});
    attendanceService.getByStore(storeId, today, today).then((r) => alive && setRecords(r ?? [])).catch(() => {});
    return () => { alive = false; };
  }, [storeId]);

  const maxRev = useMemo(() => Math.max(...week.map((w) => w.revenue), 1), [week]);
  const weekTotal = useMemo(() => week.reduce((s, w) => s + w.revenue, 0), [week]);
  // 재직 직원의 오늘 출퇴근 (근무 중 먼저)
  const staffToday = useMemo(() => employees.filter((e) => e.active).map((e) => {
    const mine = records.filter((r) => r.employeeId === e.id);
    return { e, mine, working: mine.some((r) => !r.clockOut) };
  }).sort((a, b) => Number(b.working) - Number(a.working) || b.mine.length - a.mine.length), [employees, records]);
  // 본사: 단계별 발주 수, 승인 대기 발주가 있는 가맹점 (오래 기다린 순)
  const stageCounts = HQ_STAGES.map((s) => ({ ...s, count: hqOrders.filter((o) => o.status === s.key).length }));
  const maxStage = Math.max(...stageCounts.map((s) => s.count), 1);
  const inProgress = stageCounts.reduce((sum, s) => sum + s.count, 0);
  const pendingStores = useMemo(() => {
    const by: Record<number, { id: number; name: string; count: number; oldest: string }> = {};
    hqOrders.filter((o) => o.status === 'REQUESTED' && o.store?.id).forEach((o) => {
      const cur = by[o.store.id] ?? { id: o.store.id, name: o.store.storeName ?? '-', count: 0, oldest: o.orderedAt ?? '' };
      cur.count += 1;
      if (o.orderedAt && (!cur.oldest || o.orderedAt < cur.oldest)) cur.oldest = o.orderedAt;
      by[o.store.id] = cur;
    });
    return Object.values(by).sort((a, b) => a.oldest.localeCompare(b.oldest));
  }, [hqOrders]);

  return (
    <Box sx={{ bgcolor: '#FFFFFF' }}>
      {/* ════════ HERO (파스텔) ════════ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden', pb: { xs: 10, md: 9 },
        // 배경 사진(글자 없는 숲·채소 그림) + 왼쪽 글씨가 잘 읽히도록 흰빛 그라데이션
        background: `linear-gradient(90deg, rgba(238,242,233,.94) 0%, rgba(238,242,233,.8) 22%, rgba(238,242,233,0) 32%), url(${heroBg}) 78% center / auto 100% no-repeat, #EEF2E9`,
        borderBottom: '1px solid rgba(80,70,140,.10)',
      }}>
        <Box sx={{ height: { xs: 64, lg: 112 } }} />
        <Box sx={{ ...PAGE, pt: { xs: 3, md: 5 } }}>
          {/* 매장명 (본사는 '본사') */}
          {(isHq || storeName) && (
            <Typography sx={{ position: 'relative', zIndex: 1, fontSize: { xs: 26, md: 34 }, fontWeight: 900, letterSpacing: '-0.8px', color: '#1B1F3B', mb: { xs: 1, md: 2 } }}>
              {isHq ? '본사' : storeName}
            </Typography>
          )}
          {/* 슬라이드 */}
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
                {(aiGroup?.items ?? []).slice(0, 2).map((it) => (
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
          {/* 카드 슬라이드: 왼쪽·오른쪽 여백(44px)에 각각 마우스를 올리면 그쪽 화살표만 나타난다 (키보드 포커스 때도) */}
          <Box sx={{ position: 'relative', minWidth: 0 }}>
            {[-1, 1].map((d) => (
              <Box key={d} sx={{
                display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center',
                position: 'absolute', top: 0, bottom: 0, [d < 0 ? 'left' : 'right']: 0, width: 44, zIndex: 2,
                '&:hover .slide-arrow, &:focus-within .slide-arrow': { opacity: 1 },
              }}>
                <IconButton className="slide-arrow" onClick={() => scrollBy(d)} aria-label={d < 0 ? '이전 카드' : '다음 카드'} sx={{
                  width: 34, height: 34, bgcolor: '#1B1F3B', color: 'common.white',
                  opacity: 0.3, transition: 'opacity .25s ease',
                  '&:hover': { bgcolor: '#1B1F3B' },
                }}>
                  <IconifyIcon icon={d < 0 ? 'mingcute:left-line' : 'mingcute:right-line'} width={18} />
                </IconButton>
              </Box>
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
          {(isHq ? [
            { title: '가맹점 네트워크', desc: '전 매장의 운영 현황을 한눈에 살펴요.', icon: 'mingcute:grid-fill', color: '#5468C4', bg: '#EEF1FB', to: '/admin/stores', cta: '바로가기' },
            { title: `발주 승인 대기 ${hqOrders.filter((o) => o.status === 'REQUESTED').length}건`, desc: '가맹점에서 올라온 발주를 심사해요.', icon: 'mingcute:inbox-line', color: '#E0803D', bg: '#FDF3EA', to: '/admin/orders', cta: '확인하기' },
            { title: '환경 통계 분석', desc: '가맹점 전체의 폐기·기부 지표를 확인해요.', icon: 'mingcute:chart-bar-fill', color: '#1D9E75', bg: '#E9F6F1', to: '/admin/stats', cta: '통계 보기' },
            { title: '발주 관리', desc: '승인·발송·검수 단계를 한곳에서 처리해요.', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', bg: '#EAF2FB', to: '/admin/orders', cta: '바로가기' },
          ] : [
            { title: 'AI 운영 비서', desc: '매장 상황을 물어보면 데이터로 답해 드려요.', icon: 'mingcute:chat-3-line', color: '#5468C4', bg: '#EEF1FB', to: '/assistant', cta: '물어보기' },
            { title: '오늘 예약', desc: '예약을 확인하고 테이블을 준비해요.', icon: 'mingcute:calendar-line', color: '#E0803D', bg: '#FDF3EA', to: '/reservations', cta: '확인하기' },
            { title: '폐기 예측 & 기부', desc: '버려질 식자재를 미리 찾아 이웃과 나눠요.', icon: 'mingcute:heart-line', color: '#D0457F', bg: '#FCEEF4', to: '/waste-prediction', cta: '바로가기' },
            { title: 'AI 수요 예측', desc: '메뉴별 내일 판매량을 미리 확인해요.', icon: 'mingcute:brain-fill', color: '#6A4BD1', bg: '#F1EDFC', to: '/predictions', cta: '예측 보기' },
          ]).map((b, i) => (
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
        <NavyBand title="우리 매장 현황을 자세히 알려드려요">
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
                        {linksOf(['/orders', '/ingredients', '/inventory', '/waste-prediction'])
                          .map((it) => <IconTile key={it.path} item={it} size={40} onClick={() => navigate(it.path)} />)}
                      </Box>
                    </Paper>
                  </Reveal>
                  <Reveal delay={0.2}>
                    <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 } }}>
                      <CardHead title="AI 비서" more={() => navigate('/assistant')} />
                      <Typography fontSize={13} color="text.secondary" mb={2}>
                        수요 예측부터 발주 추천·폐기 대응까지, AI가 먼저 짚고 사장님이 결정해요.
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        {linksOf(['/predictions', '/assistant', '/sales-stats', '/donations'])
                          .map((it) => <IconTile key={it.path} item={it} size={40} onClick={() => navigate(it.path)} />)}
                      </Box>
                    </Paper>
                  </Reveal>
                </Stack>
              </Box>
            )}
        </NavyBand>
      )}

      {/* ════════ 가맹점 네트워크 현황 (본사, 남색 띠) ════════ */}
      {isHq && (
        <NavyBand title="가맹점 네트워크 현황을 알려드려요">
          {loading ? <Box display="flex" justifyContent="center" py={6}><CircularProgress sx={{ color: 'common.white' }} /></Box> : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.15fr 1fr' }, gap: 2 }}>
              <Reveal>
                <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 }, height: 1 }}>
                  <CardHead title="발주 진행 현황" more={() => navigate('/admin/orders')} />
                  <Typography fontSize={12.5} color="primary.main" fontWeight={700} sx={{ textDecoration: 'underline', textUnderlineOffset: 4 }}>전 가맹점 · 단계별</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1.5, sm: 3 }, height: { xs: 170, md: 210 }, mt: 2, px: { sm: 2 } }}>
                    {stageCounts.map((st) => (
                      <Stack key={st.key} flex={1} alignItems="center" gap={0.8} sx={{ height: '100%', justifyContent: 'flex-end', minWidth: 0 }}>
                        <Typography fontSize={12} fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>{st.count}건</Typography>
                        <Box sx={{
                          width: '100%', maxWidth: 48, height: `${Math.max(Math.round((st.count / maxStage) * 100), 2)}%`,
                          borderRadius: '6px 6px 0 0', bgcolor: st.color, transition: 'height .5s ease',
                        }} />
                        <Typography fontSize={11.5} color="text.secondary" textAlign="center" sx={{ wordBreak: 'keep-all', lineHeight: 1.3 }}>{st.label}</Typography>
                      </Stack>
                    ))}
                  </Box>
                  <Stack direction="row" justifyContent="center" gap={{ xs: 2, sm: 4 }} mt={2.5} flexWrap="wrap">
                    {[
                      { k: '진행 중', v: `${inProgress}건` },
                      { k: '전체 가맹점', v: `${hqStores.length}곳` },
                      { k: '승인 대기', v: `${stageCounts[0].count}건`, hl: true },
                    ].map((x) => (
                      <Stack key={x.k} direction="row" alignItems="baseline" gap={0.8}>
                        <Typography fontSize={12} color="text.secondary">{x.k}</Typography>
                        <Typography fontWeight={800} fontSize={x.hl ? 20 : 17} color={x.hl ? '#E0803D' : 'text.primary'}>{x.v}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              </Reveal>
              <Stack gap={2}>
                <Reveal delay={0.1}>
                  <Paper elevation={0} sx={{ ...CARD, p: { xs: 2.5, md: 3 } }}>
                    <CardHead title="가맹점 관리" more={() => navigate('/admin/stores')} />
                    <Typography fontSize={13} color="text.secondary" mb={2}>
                      {pendingStores.length > 0 ? `${pendingStores.length}개 매장이 발주 승인을 기다리고 있어요.` : '모든 매장의 발주가 처리됐어요.'}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                      {(menu.find((g) => g.title === '가맹점 관리')?.items ?? [])
                        .map((it) => <IconTile key={it.path} item={it} size={40} onClick={() => navigate(it.path)} />)}
                    </Box>
                  </Paper>
                </Reveal>
              </Stack>
            </Box>
          )}
        </NavyBand>
      )}

      {/* ════════ 매장 소식 (첨부 시안의 '다양한 소식' 섹션 형태) ════════ */}
      <Box sx={{ ...PAGE, py: { xs: 7, md: 10 } }}>
        <Reveal>
          <Stack direction="row" alignItems="center" justifyContent="center" gap={1.5} mb={{ xs: 3, md: 5 }}>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, width: 52, height: 52, borderRadius: '50%', bgcolor: alpha('#1D9E75', 0.1), color: 'primary.main', alignItems: 'center', justifyContent: 'center', animation: `${floaty} 3s ease-in-out infinite` }}>
              <IconifyIcon icon="mingcute:news-line" width={28} />
            </Box>
            <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 900, letterSpacing: '-0.5px', textAlign: 'center' }}>
              {isHq ? '가맹점 소식을 확인해 보세요!' : '우리 매장 소식을 확인해 보세요!'}
            </Typography>
          </Stack>
        </Reveal>

        {/* 1줄: 브리핑 · 승인 대기 · 바로가기 존 */}
        {isHq ? (
          <Reveal>
            <NewsHead label="발주 승인을 기다리는 매장" count={`${pendingStores.length}곳`} />
            <Box sx={{ ...NEWS_BOX, height: 'auto', minHeight: 160, p: 2 }}>
              {pendingStores.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" gap={1.2} sx={{ py: 3, textAlign: 'center' }}>
                  <IconifyIcon icon="mingcute:check-circle-line" width={30} sx={{ color: 'primary.main' }} />
                  <Typography fontWeight={800} fontSize={15}>모든 매장의 발주를 처리했어요</Typography>
                </Stack>
              ) : pendingStores.slice(0, 6).map((s, i) => (
                <Stack key={s.id} direction="row" alignItems="center" gap={1.5} onClick={() => navigate('/admin/orders')} sx={{
                  py: 1.2, px: 0.5, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider', cursor: 'pointer', '&:hover .t': { color: 'primary.main' },
                }}>
                  <Typography className="t" fontSize={14} fontWeight={700} flex={1} noWrap>{s.name}</Typography>
                  <Typography fontSize={12.5} color="warning.dark" fontWeight={700}>승인 대기 {s.count}건</Typography>
                  <Typography fontSize={12} color="text.disabled">{s.oldest ? `${mmdd(s.oldest)} 부터` : ''}</Typography>
                </Stack>
              ))}
            </Box>
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
                        <IconifyIcon icon={c.icon} width={30} />
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
              <NewsHead label="오늘 출퇴근" count={`근무 중 ${staffToday.filter((s) => s.working).length}명`} />
              <Box sx={{ ...NEWS_BOX, p: 2, display: 'flex', flexDirection: 'column' }}>
                {staffToday.length === 0 ? (
                  <Stack alignItems="center" justifyContent="center" gap={1.2} sx={{ flex: 1, textAlign: 'center' }}>
                    <Box sx={{ width: 60, height: 60, borderRadius: '50%', bgcolor: alpha('#5468C4', 0.1), color: '#5468C4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconifyIcon icon="mingcute:user-3-line" width={30} />
                    </Box>
                    <Typography fontWeight={800} fontSize={15}>등록된 직원이 없어요</Typography>
                    <Typography fontSize={12.5} color="text.secondary">직원을 등록하면 오늘 출퇴근이 여기에 보여요.</Typography>
                  </Stack>
                ) : (
                  <Box sx={{ overflowY: 'auto', flex: 1 }}>
                    {staffToday.slice(0, 5).map(({ e, mine, working }, i) => (
                      <Stack key={e.id} direction="row" alignItems="center" gap={1} sx={{ py: 1.1, borderTop: i ? '1px dashed' : 'none', borderColor: 'divider' }}>
                        <Typography fontSize={13.5} fontWeight={700} flex={1} noWrap>{e.name}</Typography>
                        <Typography fontSize={12} color="text.disabled">{mine.length ? `${hhmm(mine[0].clockIn)} 출근` : ''}</Typography>
                        <Box sx={{
                          px: 0.9, py: 0.1, borderRadius: 9, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                          bgcolor: working ? alpha('#1D9E75', 0.12) : '#F4F6F9', color: working ? 'primary.main' : 'text.secondary',
                        }}>
                          {working ? '근무 중' : mine.length ? '퇴근' : '미출근'}
                        </Box>
                      </Stack>
                    ))}
                  </Box>
                )}
                <Box onClick={() => navigate('/clock')} sx={{
                  mt: 'auto', textAlign: 'center', py: 1, borderRadius: '6px', border: '1px solid', borderColor: 'divider', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}>
                  출퇴근 바로가기
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

        {/* 2줄: 안내 카드 두 개 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, mt: 2.5 }}>
          {(isHq ? [
            { title: '가맹점 발주 관리', desc: '가맹점에서 올라온 발주를 심사해요.', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', buttons: [{ label: '발주 관리', on: () => navigate('/admin/orders') }] },
            { title: '환경 통계 분석', desc: '전 매장의 폐기·기부 지표를 살펴요.', icon: 'mingcute:chart-bar-fill', color: '#1D9E75', buttons: [{ label: '통계 보기', on: () => navigate('/admin/stats') }] },
          ] : [
            { title: 'AI 운영 비서', desc: '“이번 주 장사 어때?”처럼 물어보면 매장 데이터로 답해요.', icon: 'mingcute:chat-3-line', color: '#1D9E75',
              buttons: [{ label: 'AI 운영 비서', on: () => navigate('/assistant') }, { label: 'AI 수요 예측', on: () => navigate('/predictions') }] },
            { title: '오늘 판매 기록', desc: 'POS 로 주문을 받거나 판매량을 직접 입력해요.', icon: 'mdi:cash-register', color: '#2F7DD1',
              buttons: [{ label: 'POS 열기', on: () => navigate('/pos') }, { label: '판매 입력', on: () => navigate('/sales') }] },
          ]).map((c, i) => (
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
