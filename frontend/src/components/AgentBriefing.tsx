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

const CARD_ICON: Record<string, string> = {
  '발주안': 'mingcute:refresh-2-line',
  '폐기 위험': 'mingcute:delete-2-line',
  '예측 건강도': 'mingcute:brain-fill',
  '데이터·입고 이슈': 'mingcute:alert-line',
};

const Card = ({ card }: { card: BriefingCard }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const color: Record<Tone, string> = {
    attention: theme.palette.warning.main, ok: theme.palette.success.main, unknown: theme.palette.text.disabled,
  };
  const label: Record<Tone, string> = { attention: '확인 필요', ok: '양호', unknown: '정보 없음' };
  return (
    <Paper elevation={0} onClick={() => navigate(card.to)} role="link" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') navigate(card.to); }}
      sx={{
        p: 2, borderRadius: 3, minWidth: 0, cursor: 'pointer', border: `1px solid ${theme.palette.divider}`,
        borderLeft: `5px solid ${color[card.tone]}`, '&:hover': { bgcolor: 'action.hover' },
      }}>
      <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
        <IconifyIcon icon={CARD_ICON[card.title]} width={18} color={color[card.tone]} />
        <Typography variant="caption" color="text.secondary" fontWeight={700} flex={1} noWrap>{card.title}</Typography>
        <Typography variant="caption" sx={{ color: color[card.tone], fontWeight: 700, whiteSpace: 'nowrap' }}>{label[card.tone]}</Typography>
      </Stack>
      <Typography variant="h6" fontWeight={800} lineHeight={1.2}>{card.value}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{card.sub}</Typography>
    </Paper>
  );
};

const Heading = ({ children }: { children: string }) => (
  <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
    <IconifyIcon icon="mingcute:robot-line" width={22} />
    <Typography variant="h6" fontWeight={800}>{children}</Typography>
  </Stack>
);

const OwnerBriefing = ({ storeId }: { storeId: number }) => {
  const [cards, setCards] = useState<BriefingCard[] | null>(null);

  useEffect(() => {
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

  return (
    <Box>
      <Heading>오늘의 에이전트 브리핑</Heading>
      {!cards ? <CircularProgress size={24} /> : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' } }}>
          {cards.map((c) => <Card key={c.title} card={c} />)}
        </Box>
      )}
    </Box>
  );
};

const HqBriefing = () => {
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
        <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3, overflowX: 'auto' }}>
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
