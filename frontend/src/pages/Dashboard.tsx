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

const OWNER_SHORTCUTS: Shortcut[] = [
  { title: 'POS',         icon: 'mingcute:card-pay-line',   path: '/pos' },
  { title: '발주',        icon: 'mingcute:refresh-2-line',   path: '/orders' },
  { title: '수요 예측',   icon: 'mingcute:brain-line',       path: '/predictions' },
  { title: '재고',        icon: 'mingcute:inventory-line',   path: '/inventory' },
  { title: '식자재',      icon: 'mingcute:leaf-line',        path: '/ingredients' },
  { title: '메뉴',        icon: 'mingcute:fork-spoon-line',  path: '/menus' },
  { title: '판매 입력',   icon: 'mingcute:chart-line-line',  path: '/sales' },
  { title: '폐기·기부',   icon: 'mingcute:heart-line',       path: '/waste-prediction' },
  { title: '기부 이력',   icon: 'mingcute:history-line',     path: '/donations' },
  { title: '가게 정보',   icon: 'mingcute:store-2-line',     path: '/store' },
  { title: 'AI 비서',     icon: 'mingcute:chat-3-line',      path: '/assistant' },
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
            width: 56, height: 56, borderRadius: 3.5, bgcolor: 'primary.light', color: 'primary.main',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
          }}
        >
          <IconifyIcon icon={icon} width={28} height={28} />
        </Box>
      </Badge>
      <Typography variant="body2" color="text.primary" textAlign="center">{title}</Typography>
    </Stack>
  );
};

// 작은 회색 라벨 위에 큰 숫자 (토스·Square 카드)
const StatCard = ({ label, value, unit, path }: { label: string; value: string; unit: string; path: string }) => {
  const navigate = useNavigate();
  return (
    <Paper onClick={() => navigate(path)} sx={{ p: 5, cursor: 'pointer', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.06)' } }}>
      <Typography variant="body2" color="text.secondary" mb={1.5}>{label}</Typography>
      <Stack direction="row" alignItems="center" gap={0.5}>
        <Typography fontSize={28} fontWeight={700} lineHeight={1.2}>{value}</Typography>
        <Typography fontSize={18} fontWeight={600} color="text.secondary">{unit}</Typography>
        <IconifyIcon icon="mingcute:right-line" width={20} color="#B0B8C1" />
      </Stack>
    </Paper>
  );
};

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
  const weekTotal = totals.reduce((a, b) => a + b, 0);
  const avgConfidence = predictions.length
    ? Math.round(predictions.reduce((a, p) => a + (p.confidence ?? 0), 0) / predictions.length) : null;

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

  const headline = !storeId && !storeLoading
    ? '가게를 먼저 등록해 주세요.'
    : !loaded ? '매장 현황을 불러오고 있어요.'
    : recs.length ? null : '지금은 발주할 식자재가 없어요.';

  return (
    <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '232px minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
      {/* 왼쪽: 바로가기 (휴대폰에서는 요약 다음) */}
      <Paper sx={{ p: 4, order: { xs: 1, lg: 0 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: 4, columnGap: 1 }}>
          {OWNER_SHORTCUTS.map((s) => (
            <ShortcutTile key={s.path} {...s} badge={s.path === '/orders' ? orderBadge : undefined} />
          ))}
        </Box>
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

        <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <StatCard label="다음 7일 예상 판매" value={predictions.length ? weekTotal.toLocaleString() : '-'} unit="개" path="/predictions" />
          <StatCard label="폐기 위험 식자재" value={wasteCount == null ? '-' : String(wasteCount)} unit="개" path="/waste-prediction" />
          <StatCard label="예측 신뢰도 평균" value={avgConfidence == null ? '-' : String(avgConfidence)} unit="%" path="/predictions" />
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

      {/* 오른쪽: 바로 할 일, 발주 추천 목록 */}
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

        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>발주 추천</Typography>
          {recs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
              {loaded ? '발주가 필요한 식자재가 없어요.' : '불러오는 중…'}
            </Typography>
          ) : (
            recs.slice(0, 6).map((r) => (
              <Stack
                key={r.ingredientId} direction="row" alignItems="center" gap={2} onClick={() => navigate('/orders')}
                sx={{ py: 2.5, cursor: 'pointer', borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap>{r.ingredientName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {r.coverageDays}일분 · 재고 {r.currentStock}{r.unit}
                  </Typography>
                </Box>
                <Typography fontWeight={700} fontSize={15} sx={{ whiteSpace: 'nowrap' }}>{r.orderQty}{r.unit}</Typography>
                <IconifyIcon icon="mingcute:right-line" width={18} color="#B0B8C1" />
              </Stack>
            ))
          )}
          {recs.length > 6 && (
            <Typography variant="body2" color="text.secondary" mt={1} sx={{ cursor: 'pointer' }} onClick={() => navigate('/orders')}>
              {recs.length - 6}개 더 보기 ›
            </Typography>
          )}
        </Paper>
      </Stack>
    </Box>
  );
};

export default Dashboard;
