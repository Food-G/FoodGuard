import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Box, Typography, Badge, Paper, Stack, useTheme } from '@mui/material';
import * as echarts from 'echarts';
import IconifyIcon from '../components/base/IconifyIcon';
import ReactEChart from '../components/base/ReactEChart';
import { useMyStore } from '../hooks/useMyStore';
import { notificationService } from '../services/notificationService';
import { predictionService, PredictionResult } from '../services/predictionService';
import { orderService } from '../services/orderService';
import { wastePredictionService } from '../services/wastePredictionService';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { employeeService, attendanceService, Employee, Attendance } from '../services/employeeService';
import { hhmm, localDate, minutesBetween, minutesLabel } from '../helpers/date';

interface Shortcut {
  title: string;
  icon: string;
  path: string;
  badge?: number;
}

interface Recommendation {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  orderQty: number;
  currentStock: number;
  coverageDays: number;
}

interface TodaySummary { quantity: number; revenue: number; prevQuantity: number; prevRevenue: number }

// 업무별 묶음 (hyeon 의 운영·재고·분석 구분을 그대로)
const OWNER_GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: '운영',
    items: [
      { title: 'POS',        icon: 'mingcute:card-pay-line',   path: '/pos' },
      { title: '판매 입력',  icon: 'mingcute:chart-line-line', path: '/sales' },
      { title: '예약',       icon: 'mingcute:calendar-2-line', path: '/reservations' },
      { title: '메뉴',       icon: 'mingcute:fork-spoon-line', path: '/menus' },
      { title: '직원',       icon: 'mingcute:user-2-line',     path: '/staff' },
      { title: '출퇴근',     icon: 'mingcute:time-line',       path: '/clock' },
    ],
  },
  {
    title: '재고',
    items: [
      { title: '재고',       icon: 'mingcute:inventory-line',  path: '/inventory' },
      { title: '발주',       icon: 'mingcute:refresh-2-line',  path: '/orders' },
      { title: '식자재',     icon: 'mingcute:leaf-line',       path: '/ingredients' },
      { title: '폐기·기부',  icon: 'mingcute:heart-line',      path: '/waste-prediction' },
      { title: '기부 이력',  icon: 'mingcute:history-line',    path: '/donations' },
      { title: '가게 정보',  icon: 'mingcute:store-2-line',    path: '/store' },
    ],
  },
  {
    title: '분석·AI',
    items: [
      { title: '매출 통계',  icon: 'mingcute:chart-bar-line',  path: '/sales-stats' },
      { title: '수요 예측',  icon: 'mingcute:brain-line',      path: '/predictions' },
      { title: 'AI 비서',    icon: 'mingcute:chat-3-line',     path: '/assistant' },
    ],
  },
];

const ADMIN_SHORTCUTS: Shortcut[] = [
  { title: '발주 관리',   icon: 'mingcute:truck-line',       path: '/admin/orders' },
  { title: '가맹점 관리', icon: 'mingcute:grid-line',        path: '/admin/stores' },
  { title: '통계 분석',   icon: 'mingcute:chart-bar-line',   path: '/admin/stats' },
];

const QUICK_ACTIONS: Shortcut[] = [
  { title: '오늘 판매 입력하기', icon: 'mingcute:edit-2-line',     path: '/sales' },
  { title: '발주 추천 보기',     icon: 'mingcute:refresh-2-line',  path: '/orders' },
  { title: 'AI 비서에게 묻기',   icon: 'mingcute:chat-3-line',     path: '/assistant' },
];

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
};

// 재고 경고 기준 (hyeon 과 같음): 재고 1 이하, 유통기한 3일 이내(그날 24:00 까지)
const LOW_STOCK_QTY = 1;
const EXPIRY_SOON_DAYS = 3;
const qtyOf = (item: any) => Number(item.currentQty ?? item.quantity ?? 0);
const expiryEnd = (expiryDate: string) => {
  const [y, m, d] = expiryDate.split('-').map(Number);
  return new Date(y, m - 1, d + 1);
};
const isLowStock = (item: any) => qtyOf(item) <= LOW_STOCK_QTY;
const isExpiringSoon = (item: any) => {
  if (!item.expiryDate) return false;
  const soon = new Date(); soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
  return expiryEnd(item.expiryDate) <= soon;
};
const remainingLabel = (expiryDate: string) => {
  const ms = expiryEnd(expiryDate).getTime() - Date.now();
  if (ms <= 0) return '기한 지남';
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}일 ${hours % 24}시간 남음` : `${hours}시간 남음`;
};

// 아이콘 바로가기 (Square 홈 왼쪽 열처럼 한 가지 색으로)
const ShortcutTile = ({ title, icon, path, badge }: Shortcut) => {
  const navigate = useNavigate();
  return (
    <Stack
      alignItems="center" gap={1} onClick={() => navigate(path)}
      sx={{ cursor: 'pointer', userSelect: 'none', '&:hover .tile': { bgcolor: 'primary.main', color: 'common.white' } }}
    >
      <Badge badgeContent={badge || undefined} color="error">
        <Box
          className="tile"
          sx={{
            width: 52, height: 52, borderRadius: 3.5, bgcolor: 'primary.light', color: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
          }}
        >
          <IconifyIcon icon={icon} width={26} height={26} />
        </Box>
      </Badge>
      <Typography variant="body2" color="text.primary" textAlign="center">{title}</Typography>
    </Stack>
  );
};

// 어제와 비교 (어제가 0 이면 % 를 낼 수 없어 표시하지 않음)
const Delta = ({ value, prev }: { value: number; prev?: number | null }) => {
  const theme = useTheme();
  if (prev == null || prev <= 0 || value <= 0) return null;
  const pct = Math.round(((value - prev) / prev) * 100);
  return (
    <Typography variant="body2" fontWeight={600} mt={1}
      sx={{ color: pct >= 0 ? theme.palette.success.main : theme.palette.error.main }}>
      {pct === 0 ? '어제와 같아요' : `어제보다 ${Math.abs(pct)}% ${pct > 0 ? '많아요' : '적어요'}`}
    </Typography>
  );
};

// 작은 회색 라벨 위에 큰 숫자 (토스·Square 카드)
const StatCard = ({ label, value, unit, path, sub, tone }: {
  label: string; value: string; unit: string; path: string; sub?: React.ReactNode; tone?: 'error' | 'warning';
}) => {
  const navigate = useNavigate();
  return (
    <Paper onClick={() => navigate(path)} sx={{ p: 5, cursor: 'pointer', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' } }}>
      <Typography variant="body2" color="text.secondary" mb={1.5}>{label}</Typography>
      <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap">
        <Typography fontSize={26} fontWeight={700} lineHeight={1.2} color={tone ? `${tone}.main` : 'text.primary'}>{value}</Typography>
        <Typography fontSize={16} fontWeight={600} color="text.secondary">{unit}</Typography>
        <IconifyIcon icon="mingcute:right-line" width={20} color="#B0B8C1" />
      </Stack>
      {sub}
    </Paper>
  );
};

// 오른쪽 열 카드: 제목 + 더보기 + 목록 행
const ListCard = ({ title, more, children }: { title: string; more?: { label: string; path: string }; children: React.ReactNode }) => {
  const navigate = useNavigate();
  return (
    <Paper sx={{ p: 5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography fontSize={18} fontWeight={700}>{title}</Typography>
        {more && (
          <Typography variant="body2" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={() => navigate(more.path)}>
            {more.label} ›
          </Typography>
        )}
      </Stack>
      {children}
    </Paper>
  );
};

const ListRow = ({ title, sub, right, rightColor, onClick }: {
  title: string; sub?: string; right?: string; rightColor?: string; onClick?: () => void;
}) => {
  const theme = useTheme();
  return (
    <Stack
      direction="row" alignItems="center" gap={2} onClick={onClick}
      sx={{ py: 2.5, cursor: onClick ? 'pointer' : 'default', borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={600} fontSize={15} noWrap>{title}</Typography>
        {sub && <Typography variant="body2" color="text.secondary" noWrap>{sub}</Typography>}
      </Box>
      {right && <Typography fontWeight={700} fontSize={15} sx={{ whiteSpace: 'nowrap', color: rightColor }}>{right}</Typography>}
      {onClick && <IconifyIcon icon="mingcute:right-line" width={18} color="#B0B8C1" />}
    </Stack>
  );
};

const EmptyText = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{children}</Typography>
);

const Dashboard = ({ user }: any) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const role = user?.role || 'OWNER';
  const { storeId, storeLoading } = useMyStore(user);
  const [orderBadge, setOrderBadge] = useState(0);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [wasteCount, setWasteCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  // undefined: 조회 실패 (null: 불러오는 중)
  const [summary, setSummary] = useState<TodaySummary | null | undefined>(null);
  const [inventory, setInventory] = useState<any[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);

  useEffect(() => {
    if (!storeId) return;
    const fetch_ = () =>
      notificationService.getUnread(storeId)
        .then((data: any[]) => setOrderBadge((data ?? []).filter((n) => n.type === 'ORDER').length))
        .catch(() => {});
    fetch_();
    const t = setInterval(fetch_, 30000);
    return () => clearInterval(t);
  }, [storeId]);

  useEffect(() => {
    if (!storeId || role === 'HQ_ADMIN') return;
    Promise.allSettled([
      predictionService.getByStore(storeId).then((p) => setPredictions(p ?? [])),
      orderService.getRecommend(storeId).then((r: Recommendation[]) => setRecs((r ?? []).filter((i) => i.orderQty > 0))),
      wastePredictionService.summary(storeId).then((s: any) => setWasteCount(s?.wasteCount ?? 0)),
    ]).finally(() => setLoaded(true));
  }, [storeId, role]);

  // 오늘 매출·재고·출퇴근은 영업 중 바뀌므로 주기적으로 다시 읽는다 (실패하면 직전 값 유지)
  useEffect(() => {
    if (!storeId || role === 'HQ_ADMIN') return;
    const load = () => {
      salesService.getTodaySummary(storeId)
        .then((s: TodaySummary) => setSummary(s))
        .catch(() => setSummary((s) => (s ? s : undefined)));
      inventoryService.getByStore(storeId).then((items: any[]) => setInventory(items ?? [])).catch(() => {});
      const today = localDate(new Date());
      employeeService.getByStore(storeId).then(setEmployees).catch(() => {});
      attendanceService.getByStore(storeId, today, today).then(setRecords).catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [storeId, role]);

  if (role === 'HQ_ADMIN') {
    return (
      <Stack gap={5}>
        <Typography fontSize={28} fontWeight={700}>본사 관리</Typography>
        <Paper sx={{ p: 5 }}>
          <Stack direction="row" gap={6}>
            {ADMIN_SHORTCUTS.map((s) => <ShortcutTile key={s.path} {...s} />)}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  // 날짜별 전체 메뉴 예측 합계 (가장 가까운 날을 강조)
  const byDate = new Map<string, number>();
  predictions.forEach((p) => byDate.set(p.predictionDate, (byDate.get(p.predictionDate) ?? 0) + p.predictedQty));
  const dates = [...byDate.keys()].sort();
  const totals = dates.map((d) => Math.round(byDate.get(d) ?? 0));

  const chartOption = {
    grid: { left: 8, right: 8, top: 32, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v.toLocaleString()}개` },
    xAxis: {
      type: 'category', data: dates.map(dayLabel),
      axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', barWidth: '46%',
      data: totals.map((v, i) => ({
        value: v,
        itemStyle: { color: i === 0 ? theme.palette.primary.main : theme.palette.divider, borderRadius: 8 },
        label: { show: i === 0, position: 'top', color: theme.palette.primary.main, fontWeight: 700, formatter: `${v.toLocaleString()}개` },
      })),
    }],
  };

  // 재고 경고: 유통기한 가까운 순, 기한 없는 재고 부족은 뒤로
  const alerts = (inventory ?? []).filter((i) => isLowStock(i) || isExpiringSoon(i))
    .sort((a, b) =>
      (a.expiryDate ? expiryEnd(a.expiryDate).getTime() : Infinity) -
      (b.expiryDate ? expiryEnd(b.expiryDate).getTime() : Infinity));
  const lowStockCount = (inventory ?? []).filter(isLowStock).length;

  // 재직 직원의 오늘 출퇴근 (근무중 먼저)
  const staff = (employees ?? []).filter((e) => e.active).map((e) => {
    const mine = records.filter((r) => r.employeeId === e.id);
    const working = mine.some((r) => !r.clockOut);
    const minutes = mine.reduce((s, r) => s + minutesBetween(r.clockIn, r.clockOut ?? new Date()), 0);
    return { e, mine, working, minutes };
  }).sort((a, b) => Number(b.working) - Number(a.working) || b.mine.length - a.mine.length);

  const headline = !storeId && !storeLoading
    ? '가게를 먼저 등록해 주세요.'
    : !loaded ? '매장 현황을 불러오고 있어요.'
    : recs.length ? null : '지금은 발주할 식자재가 없어요.';

  return (
    <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '240px minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
      {/* 왼쪽: 업무별 바로가기 (휴대폰에서는 요약 다음) */}
      <Paper sx={{ p: 4, order: { xs: 1, lg: 0 } }}>
        <Stack gap={4}>
          {OWNER_GROUPS.map((g) => (
            <Box key={g.title}>
              <Typography variant="body2" color="text.secondary" fontWeight={600} mb={2}>{g.title}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 3, columnGap: 1 }}>
                {g.items.map((s) => (
                  <ShortcutTile key={s.path} {...s} badge={s.path === '/orders' ? orderBadge : undefined} />
                ))}
              </Box>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* 가운데: 한 줄 요약, 핵심 숫자, 7일 예측 */}
      <Stack gap={5}>
        <Box>
          <Typography fontSize={{ xs: 24, md: 30 }} fontWeight={700} lineHeight={1.35}>안녕하세요, 사장님.</Typography>
          <Typography fontSize={{ xs: 24, md: 30 }} fontWeight={700} lineHeight={1.35}>
            {headline ?? (
              <>발주가 필요한 식자재가 <Box component="span" color="primary.main">{recs.length}개</Box> 있어요.</>
            )}
          </Typography>
        </Box>

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
          <StatCard label="오늘 매출" path="/sales-stats" unit="원"
            value={summary == null ? '-' : summary.revenue.toLocaleString()}
            sub={summary ? <Delta value={summary.revenue} prev={summary.prevRevenue} /> : undefined} />
          <StatCard label="오늘 판매" path="/sales" unit="건"
            value={summary == null ? '-' : summary.quantity.toLocaleString()}
            sub={summary ? <Delta value={summary.quantity} prev={summary.prevQuantity} /> : undefined} />
          <StatCard label="폐기 위험 식자재" path="/waste-prediction" unit="개"
            value={wasteCount == null ? '-' : String(wasteCount)} tone={wasteCount ? 'error' : undefined} />
          <StatCard label="재고 부족 품목" path="/inventory" unit="개"
            value={inventory == null ? '-' : String(lowStockCount)} tone={lowStockCount ? 'warning' : undefined} />
        </Box>

        <Paper sx={{ p: 5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography fontSize={18} fontWeight={700}>다음 7일 판매 예측</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ cursor: 'pointer' }} onClick={() => navigate('/predictions')}>
              자세히 보기 ›
            </Typography>
          </Stack>
          {dates.length ? (
            <ReactEChart echarts={echarts} option={chartOption} sx={{ height: 260 }} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
              아직 예측이 없어요. 수요 예측 화면에서 AI 예측을 실행해 주세요.
            </Typography>
          )}
        </Paper>
      </Stack>

      {/* 오른쪽: 바로 할 일, 발주 추천, 재고 경고, 직원 출퇴근 */}
      <Stack gap={5} sx={{ order: { xs: 2, lg: 0 } }}>
        <Stack gap={2}>
          {QUICK_ACTIONS.map((a) => (
            <Paper
              key={a.title} onClick={() => navigate(a.path)}
              sx={{ px: 4, py: 3.5, cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 2.5, '&:hover': { bgcolor: 'primary.light' } }}
            >
              <IconifyIcon icon={a.icon} width={20} color={theme.palette.primary.main} />
              <Typography fontWeight={600} color="primary.main" fontSize={15}>{a.title}</Typography>
            </Paper>
          ))}
        </Stack>

        <ListCard title="발주 추천" more={recs.length > 5 ? { label: `${recs.length - 5}개 더`, path: '/orders' } : undefined}>
          {recs.length === 0
            ? <EmptyText>{loaded ? '발주가 필요한 식자재가 없어요.' : '불러오는 중…'}</EmptyText>
            : recs.slice(0, 5).map((r) => (
              <ListRow key={r.ingredientId} title={r.ingredientName} onClick={() => navigate('/orders')}
                sub={`${r.coverageDays}일분 · 재고 ${r.currentStock}${r.unit}`} right={`${r.orderQty}${r.unit}`} />
            ))}
        </ListCard>

        <ListCard title="재고 경고" more={{ label: '재고 보기', path: '/inventory' }}>
          {inventory == null ? <EmptyText>불러오는 중…</EmptyText>
            : alerts.length === 0 ? <EmptyText>부족하거나 기한이 임박한 재고가 없어요.</EmptyText>
            : alerts.slice(0, 5).map((i, idx) => (
              <ListRow key={i.id ?? idx} title={i.ingredient?.name ?? '식자재'} onClick={() => navigate('/orders')}
                sub={`재고 ${qtyOf(i)}${i.ingredient?.unit ?? i.unit ?? ''}${isLowStock(i) ? ' · 부족' : ''}`}
                right={i.expiryDate && isExpiringSoon(i) ? remainingLabel(i.expiryDate) : '발주 필요'}
                rightColor={i.expiryDate && isExpiringSoon(i) ? theme.palette.warning.main : theme.palette.error.main} />
            ))}
        </ListCard>

        <ListCard title="직원 출퇴근" more={{ label: '직원 관리', path: '/staff' }}>
          {employees == null ? <EmptyText>불러오는 중…</EmptyText>
            : staff.length === 0 ? <EmptyText>등록된 직원이 없어요.</EmptyText>
            : staff.map(({ e, mine, working, minutes }) => (
              <ListRow key={e.id} title={e.name}
                sub={mine.length === 0 ? '출근 기록 없음'
                  : `${hhmm(mine[0].clockIn)} ~ ${working ? '근무중' : hhmm(mine[mine.length - 1].clockOut)} · ${minutesLabel(minutes)}`}
                right={working ? '근무중' : mine.length ? '퇴근' : '미출근'}
                rightColor={working ? theme.palette.success.main : theme.palette.text.secondary} />
            ))}
        </ListCard>
      </Stack>
    </Box>
  );
};

export default Dashboard;
