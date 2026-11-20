import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, alpha, useTheme,
} from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { agentService } from '../services/agentService';
import { orderService } from '../services/orderService';
import { predictionService } from '../services/predictionService';
import { storeService } from '../services/storeService';
import { wastePredictionService } from '../services/wastePredictionService';
import {
  BriefingCard, RiskLevel, StoreRisk, Tone, forecastCard, issuesCard, orderPlanCard, storeRisks, wasteCard,
} from '../utils/briefing';

// 실패를 null 로 바꾼다. 카드는 null 을 "확인 불가"로 보여준다
const orNull = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export const CARD_ICON: Record<string, string> = {
  '발주안': 'mingcute:refresh-2-line',
  '폐기 위험': 'mingcute:delete-2-line',
  '예측 건강도': 'mingcute:brain-fill',
  '데이터·입고 이슈': 'mingcute:alert-line',
};

// 상태별 파스텔 배너 카드 (메인 화면 배너 카드와 같은 형태)
export const TONE: Record<Tone, { label: string; color: string; bg: string }> = {
  attention: { label: '확인 필요', color: '#E0803D', bg: '#FDF3EA' },
  ok: { label: '양호', color: '#1D9E75', bg: '#E9F6F1' },
  unknown: { label: '정보 없음', color: '#8A90A6', bg: '#F4F6F9' },
};

const Card = ({ card }: { card: BriefingCard }) => {
  const navigate = useNavigate();
  const t = TONE[card.tone];
  return (
    <Stack direction="row" gap={1.5} onClick={() => navigate(card.to)} role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(card.to); }}
      sx={{
        p: 2.5, borderRadius: '10px', minWidth: 0, height: 1, cursor: 'pointer', bgcolor: t.bg, position: 'relative',
        transition: 'transform .2s, box-shadow .2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 14px 28px ${alpha(t.color, 0.18)}` },
      }}>
      <Box flex={1} minWidth={0} display="flex" flexDirection="column">
        <Stack direction="row" alignItems="center" gap={0.8}>
          <Typography fontWeight={800} fontSize={15} noWrap>{card.title}</Typography>
          <Box sx={{ px: 0.9, py: 0.15, borderRadius: 9, bgcolor: 'common.white', color: t.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {t.label}
          </Box>
        </Stack>
        <Typography fontWeight={900} fontSize={20} lineHeight={1.25} mt={1}>{card.value}</Typography>
        <Typography fontSize={12.5} color="text.secondary" mt={0.6} sx={{ wordBreak: 'keep-all' }}>{card.sub}</Typography>
        <Stack direction="row" alignItems="center" gap={0.5} sx={{
          mt: 'auto', pt: 2, width: 'fit-content', fontSize: 12, fontWeight: 700, color: t.color,
        }}>
          자세히 보기 <IconifyIcon icon="mingcute:right-line" width={13} />
        </Stack>
      </Box>
      <Box sx={{
        width: 46, height: 46, flexShrink: 0, borderRadius: '10px', bgcolor: 'common.white', color: t.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 18px ${alpha(t.color, 0.2)}`,
      }}>
        <IconifyIcon icon={CARD_ICON[card.title]} width={26} />
      </Box>
    </Stack>
  );
};

const Heading = ({ children }: { children: string }) => (
  <Stack direction="row" alignItems="center" gap={1} mb={2}>
    <Box sx={{ width: 32, height: 32, borderRadius: '30%', bgcolor: alpha('#1D9E75', 0.1), color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconifyIcon icon="mingcute:robot-line" width={20} />
    </Box>
    <Typography fontWeight={800} fontSize={18}>{children}</Typography>
  </Stack>
);

/** 점주 매장의 브리핑 카드 4장 (발주안·폐기 위험·예측 건강도·데이터/입고 이슈). 불러오는 중이면 null */
export const useOwnerBriefing = (storeId: number | null) => {
  const [cards, setCards] = useState<BriefingCard[] | null>(null);

  useEffect(() => {
    if (!storeId) return;
    let alive = true;
    Promise.all([
      orNull(agentService.getProposals(storeId, 'PENDING')),
      orNull(wastePredictionService.summary(storeId)),
      orNull(predictionService.getAccuracy('live', storeId, 7)),
      orNull(agentService.getRuns(storeId, 'audit')),
      orNull(agentService.getRuns(storeId, 'inbound')),
    ]).then(([proposals, waste, accuracy, audit, inbound]) => {
      if (!alive) return;
      setCards([orderPlanCard(proposals), wasteCard(waste, proposals), forecastCard(accuracy, proposals), issuesCard(audit, inbound)]);
    });
    return () => { alive = false; };
  }, [storeId]);

  return cards;
};

const OwnerBriefing = ({ storeId }: { storeId: number }) => {
  const cards = useOwnerBriefing(storeId);

  return (
    <Box>
      <Heading>오늘의 에이전트 브리핑</Heading>
      {!cards ? <CircularProgress size={24} /> : (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {cards.map((c) => <Card key={c.title} card={c} />)}
        </Box>
      )}
    </Box>
  );
};

export const HqBriefing = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [rows, setRows] = useState<StoreRisk[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [promotes, setPromotes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stores = await orNull(storeService.getAll());
      if (!stores) { if (alive) setFailed(true); return; }
      const [orders, flags, pending] = await Promise.all([
        orNull(orderService.getAll()), orNull(agentService.getOrderFlags()), orNull(agentService.getProposals(null, 'PENDING')),
      ]);
      const wastes = await Promise.all((stores as any[]).map((s) => orNull(wastePredictionService.summary(s.id))));
      if (!alive) return;
      const wasteByStore = Object.fromEntries((stores as any[]).map((s, i) => [s.id, wastes[i]]));
      setRows(storeRisks(stores as any[], orders as any[] | null, flags, wasteByStore));
      setPromotes(pending ? pending.filter((p) => p.type === 'MODEL_PROMOTE').length : null);
    })();
    return () => { alive = false; };
  }, []);

  const levelColor: Record<RiskLevel, string> = {
    high: theme.palette.error.main, medium: theme.palette.warning.main, low: theme.palette.success.main, unknown: theme.palette.text.disabled,
  };
  const levelLabel: Record<RiskLevel, string> = { high: '높음', medium: '보통', low: '낮음', unknown: '확인 불가' };
  const cell = (v: number | null, color: string) => (
    <TableCell align="center" sx={{ bgcolor: v ? alpha(color, 0.18) : undefined, fontWeight: v ? 800 : 400 }}>
      {v === null ? '확인 불가' : v}
    </TableCell>
  );

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Heading>매장별 위험 현황</Heading>
        {!!promotes && (
          <Button size="small" variant="outlined" color="warning" onClick={() => navigate('/agent-inbox?agent=mlops')}>
            모델 교체 제안 {promotes}건 검토
          </Button>
        )}
      </Stack>
      {failed ? (
        <Typography variant="body2" color="text.secondary">매장 목록을 불러오지 못했습니다.</Typography>
      ) : !rows ? <CircularProgress size={24} /> : (
        <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '10px', overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>매장</TableCell><TableCell align="center">위험도</TableCell>
                <TableCell align="center">거절 검토 발주</TableCell><TableCell align="center">확인 필요 발주</TableCell>
                <TableCell align="center">폐기 위험 높음</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.storeId} hover sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/orders?storeId=${r.storeId}&storeName=${encodeURIComponent(r.storeName ?? '')}`)}>
                  <TableCell>{r.storeName}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={levelLabel[r.level]} sx={{ color: '#fff', fontWeight: 700, bgcolor: levelColor[r.level] }} />
                  </TableCell>
                  {cell(r.rejectOrders, theme.palette.error.main)}
                  {cell(r.reviewOrders, theme.palette.warning.main)}
                  {cell(r.wasteHigh, theme.palette.error.main)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
};

/** 점주는 storeId 를 넘긴다. 매장이 아직 없으면 아무것도 그리지 않는다. */
const AgentBriefing = ({ hq, storeId }: { hq: boolean; storeId: number | null }) => {
  if (hq) return <HqBriefing />;
  return storeId ? <OwnerBriefing storeId={storeId} /> : null;
};

export default AgentBriefing;
