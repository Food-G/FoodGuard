import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Paper, Popper, Stack, Typography, alpha, keyframes,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { agentService, AgentProposal, AgentRun } from '../services/agentService';
import { useMyStore } from '../hooks/useMyStore';

// AI 에이전트 센터: 에이전트를 잘 모르는 사람도 "누가, 언제, 무엇을" 하는지 알 수 있게 조직도로 보여준다
interface AgentMeta { code: string; name: string; icon: string; color: string; desc: string; schedule: string; scope: '매장' | '본사' }

export const AGENTS: Record<string, AgentMeta> = {
  order_advisor: { code: 'AG-1', name: '발주 참모', icon: 'mingcute:refresh-2-line', color: '#2F7DD1', desc: '수요 예측과 재고를 보고 발주안을 만들어 승인함에 올립니다.', schedule: '매일 08:00', scope: '매장' },
  waste: { code: 'AG-2', name: '폐기 위험', icon: 'mingcute:delete-2-line', color: '#E0533D', desc: '버려질 위험이 있는 식자재를 찾아 대응 후보를 제안합니다.', schedule: '매일 09:00', scope: '매장' },
  donation: { code: 'AG-3', name: '기부 매칭', icon: 'mingcute:gift-line', color: '#C2477E', desc: '폐기 위험 에이전트의 기부 후보를 가까운 기부처와 연결합니다.', schedule: '폐기 위험 후속', scope: '매장' },
  hq_review: { code: 'AG-4', name: '본사 발주 심사', icon: 'mingcute:shield-line', color: '#1D9E75', desc: '승인 대기 발주마다 이상 점수를 매겨 본사 발주 목록에 표시합니다.', schedule: '수시 점검', scope: '본사' },
  mlops: { code: 'AG-5', name: '예측 운영', icon: 'mingcute:brain-fill', color: '#7A4FD6', desc: '예측 성능을 점검하고 나빠지면 새 모델을 학습·비교해 교체를 제안합니다.', schedule: '매일 07:00', scope: '본사' },
  audit: { code: 'AG-6', name: '데이터 감사', icon: 'mingcute:search-line', color: '#B7791F', desc: '매장별 이상 데이터를 찾아 정보 카드와 알림으로 알립니다.', schedule: '매일 06:30', scope: '매장' },
  inbound: { code: 'AG-7', name: '입고 추적', icon: 'mingcute:truck-line', color: '#00897B', desc: '진행 중인 발주의 입고 지연을 찾아 본사와 점주에게 알립니다.', schedule: '매시', scope: '본사' },
  weekly: { code: 'AG-8', name: '주간 브리핑', icon: 'mingcute:calendar-line', color: '#5468C4', desc: '지난주 매출·폐기 위험·발주·예측 오차를 점주에게 요약합니다.', schedule: '매주 월 08:00', scope: '매장' },
  echo: { code: 'AG-0', name: '재고 점검', icon: 'mingcute:robot-line', color: '#607D8B', desc: '런타임 한 바퀴를 검증하는 점검용 에이전트입니다.', schedule: '수동 실행', scope: '매장' },
};

// 비전문가용 설명: 무엇을 하는지 / 언제 일하는지 / 결과는 어디서 보는지
const PLAIN: Record<string, { short: string; does: string; when: string; result: string }> = {
  order_advisor: { short: '무엇을 얼마나 주문할지 정리해요', does: '내일 팔릴 양과 지금 남은 재고를 비교해서, 모자랄 재료의 주문서(발주안)를 미리 써 둡니다.', when: '매일 아침 8시', result: 'AI 승인함에 발주안이 올라와요. 승인하면 실제 발주가 들어갑니다.' },
  waste: { short: '버려질 것 같은 재료를 찾아요', does: '유통기한이 얼마 남지 않은 재료를 찾아서, 버리기 전에 할 수 있는 일(빨리 쓰기, 기부 등)을 알려줍니다.', when: '매일 아침 9시', result: '폐기 예측 & 기부 화면과 AI 승인함에서 볼 수 있어요.' },
  donation: { short: '남는 재료를 기부처와 연결해요', does: '폐기 위험 직원이 찾은 재료를 받아줄 가까운 기부처를 골라 연결을 제안합니다.', when: '폐기 위험 직원이 일을 마치면 이어서 자동으로', result: 'AI 승인함에 기부 제안이 올라오고, 승인하면 기부 이력에 남아요.' },
  weekly: { short: '지난주를 한 장으로 요약해요', does: '지난주 매출, 버려질 뻔한 재료, 진행 중인 발주, 예측이 얼마나 맞았는지를 한 장으로 정리합니다.', when: '매주 월요일 아침 8시', result: '알림으로 요약을 보내드려요.' },
  mlops: { short: '판매 예측이 잘 맞는지 점검해요', does: '수요 예측이 실제 판매와 얼마나 차이 나는지 매일 확인하고, 더 잘 맞는 예측 방법이 있으면 바꾸자고 제안합니다.', when: '매일 아침 7시', result: '예측 방법 교체 제안은 본사 AI 승인함에 올라와요.' },
  audit: { short: '이상한 기록을 찾아내요', does: '판매·재고 기록 중에 빠진 날이나 너무 큰 숫자처럼 이상한 데이터를 찾아 알려줍니다.', when: '매일 새벽 6시 30분', result: 'AI 승인함의 안내 카드와 알림으로 알려드려요.' },
  echo: { short: '시스템이 잘 도는지 확인해요', does: '에이전트들이 제대로 작동하는지 확인하는 점검용 직원입니다. 재고 상태를 한 번 훑어봅니다.', when: '필요할 때 직접 실행', result: '실행 기록에서 결과를 확인할 수 있어요.' },
  hq_review: { short: '평소와 다른 발주를 표시해요', does: '가맹점에서 올라온 발주 중 평소보다 지나치게 많거나 이상한 주문을 찾아 본사에 표시합니다.', when: '새 발주가 들어올 때마다 수시로', result: '본사 발주 관리 화면에 "확인 필요" 표시가 붙어요.' },
  inbound: { short: '늦어지는 배송을 알려줘요', does: '주문한 재료가 예정보다 늦게 오고 있으면 본사와 사장님께 미리 알려줍니다.', when: '매시간', result: '알림으로 지연 소식을 보내드려요.' },
};

// 조직도: 팀별 에이전트 (sub 는 앞 에이전트의 후속으로 이어서 일함)
const TEAMS = [
  { name: '매장 운영팀', desc: '주문·재료·나눔을 챙겨요', color: '#1D9E75', icon: 'mingcute:store-2-line', members: [{ id: 'order_advisor' }, { id: 'waste' }, { id: 'donation', sub: true }, { id: 'weekly' }] },
  { name: '품질 관리팀', desc: '예측과 데이터를 점검해요', color: '#7A4FD6', icon: 'mingcute:check-circle-line', members: [{ id: 'mlops' }, { id: 'audit' }, { id: 'echo' }] },
  { name: '본사 지원팀', desc: '가맹점 발주와 배송을 살펴요', color: '#2F7DD1', icon: 'mingcute:building-2-line', members: [{ id: 'hq_review' }, { id: 'inbound' }] },
];
const ORDER = ['order_advisor', 'waste', 'donation', 'hq_review', 'mlops', 'audit', 'inbound', 'weekly', 'echo'];
const RUNNABLE = ['echo', 'order_advisor', 'waste']; // 점주가 화면에서 직접 돌릴 수 있는 에이전트
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

const STEPS = [
  { icon: 'mingcute:eye-2-line', title: '살펴봐요', text: '매장 판매·재고 기록을 읽어요' },
  { icon: 'mingcute:formula-line', title: '계산해요', text: '필요한 양과 위험을 계산해요' },
  { icon: 'mingcute:inbox-line', title: '제안해요', text: 'AI 승인함에 할 일을 올려요' },
  { icon: 'mingcute:user-follow-line', title: '사장님이 결정', text: '승인해야만 실제로 실행돼요' },
];

const pulse = keyframes`0% { box-shadow: 0 0 0 0 rgba(29,158,117,.6) } 100% { box-shadow: 0 0 0 8px rgba(29,158,117,0) }`;
const pop = keyframes`from { opacity: 0; transform: translateY(6px) scale(.98) } to { opacity: 1; transform: none }`;
const LINE = '#D9DEE8'; // 조직도 연결선 (연한 회색)

const ago = (s?: string | null) => {
  if (!s) return '아직 기록 없음';
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
};
const STATUS: Record<string, { label: string; color: string }> = {
  RUNNING: { label: '일하는 중', color: '#2F7DD1' },
  OK: { label: '완료', color: '#1D9E75' },
  FAILED: { label: '문제 발생', color: '#E53935' },
};
const statusOf = (s?: string) => STATUS[s ?? ''] ?? { label: '대기 중', color: '#9AA1B2' };
const TRIGGER: Record<string, string> = { MANUAL: '직접 실행', SCHEDULE: '정해진 시간에', EVENT: '다른 직원 요청으로' };
const errorMessage = (e: any, fallback: string) => e?.response?.data?.message ?? e?.message ?? fallback;

const CARD = { bgcolor: 'background.paper', borderRadius: '10px', border: '1px solid', borderColor: 'divider' };

const Kpi = ({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub: string }) => (
  <Paper elevation={0} sx={{ ...CARD, p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
    <Stack direction="row" alignItems="center" gap={1.5}>
      <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: '10px', bgcolor: alpha(color, 0.12), color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconifyIcon icon={icon} width={23} />
      </Box>
      <Box minWidth={0}>
        <Typography fontSize={13} color="text.secondary" noWrap>{label}</Typography>
        <Typography sx={{ fontSize: { xs: 22, md: 24 }, fontWeight: 900, lineHeight: 1.15 }}>{value}</Typography>
        <Typography fontSize={12} color="text.disabled" noWrap>{sub}</Typography>
      </Box>
    </Stack>
  </Paper>
);

const AgentCenter = ({ user }: any) => {
  const navigate = useNavigate();
  const isHq = user?.role === 'HQ_ADMIN';
  const { storeId, storeLoading } = useMyStore(isHq ? null : user);
  const scope = isHq ? null : storeId;

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [pending, setPending] = useState<AgentProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [active, setActive] = useState<{ runId: string; agent: string; startedAt: number } | null>(null);

  // 조직도 호버 카드
  const [hover, setHover] = useState<{ id: string; el: HTMLElement } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const openCard = (id: string, el: HTMLElement) => { window.clearTimeout(closeTimer.current); setHover({ id, el }); };
  const closeCardSoon = () => { closeTimer.current = window.setTimeout(() => setHover(null), 180); };
  const keepCard = () => window.clearTimeout(closeTimer.current);

  const load = useCallback(async () => {
    if (!isHq && !storeId) return;
    try {
      const [r, p] = await Promise.all([
        agentService.getRuns(scope),
        agentService.getProposals(scope, 'PENDING'),
      ]);
      setRuns(Array.isArray(r) ? r : []);
      setPending(Array.isArray(p) ? p : []);
    } catch (e) {
      setError(errorMessage(e, '에이전트 기록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [isHq, storeId, scope]);

  useEffect(() => {
    if (!isHq && storeLoading) return;
    if (!isHq && !storeId) { setLoading(false); return; }
    load();
    const t = setInterval(load, 30000); // 스케줄 실행분도 반영되게 30초마다 갱신
    return () => clearInterval(t);
  }, [isHq, storeId, storeLoading, load]);

  const handleRun = async (agent: string) => {
    if (active || !storeId) return;
    setError(''); setSuccess('');
    try {
      const { runId } = await agentService.run(agent, storeId);
      setActive({ runId, agent, startedAt: Date.now() });
    } catch (e) { setError(errorMessage(e, '에이전트 실행에 실패했습니다. 에이전트 서비스(:8100)를 확인하세요.')); }
  };

  // 실행 중이면 1.5초마다 상태를 확인하고, 끝나면 결과를 알리고 목록을 다시 불러온다
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const name = AGENTS[active.agent]?.name ?? active.agent;
    const tick = async () => {
      if (Date.now() - active.startedAt > RUN_TIMEOUT_MS) {
        setActive(null);
        setError(`${name}: 5분 동안 끝나지 않았습니다. 아래 최근 활동에서 상태를 확인하세요.`);
        return;
      }
      let run: AgentRun;
      try { run = await agentService.getRun(active.runId); } catch { return; } // 기록이 생기기 전이면 다음 틱에 다시
      if (!alive || run.status === 'RUNNING') return;
      setActive(null);
      const n = Array.isArray(run.resultJson?.proposals) ? run.resultJson!.proposals.length : 0;
      if (run.status === 'OK') setSuccess(`${name} 직원이 일을 마쳤어요. ${n ? `새 제안 ${n}건이 AI 승인함에 올라왔어요.` : '이번에는 새 제안이 없어요.'}`);
      else setError(`${name} 실행 중 문제가 생겼어요: ${run.error ?? '최근 활동을 확인하세요.'}`);
      load();
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => { alive = false; clearInterval(timer); };
  }, [active, load]);

  const byAgent = useMemo(() => {
    const week = Date.now() - 7 * 86400000;
    return Object.fromEntries(ORDER.map((a) => {
      const mine = runs.filter((r) => r.agent === a).sort((x, y) => y.startedAt.localeCompare(x.startedAt));
      return [a, {
        last: mine[0] as AgentRun | undefined,
        recent: mine.slice(0, 3),
        week: mine.filter((r) => new Date(r.startedAt).getTime() > week).length,
        pending: pending.filter((p) => p.agent === a).length,
      }];
    }));
  }, [runs, pending]);

  const stats = useMemo(() => {
    const day = Date.now() - 86400000;
    const recent = runs.filter((r) => new Date(r.startedAt).getTime() > day);
    return {
      activeAgents: ORDER.filter((a) => byAgent[a]?.week > 0).length,
      runs24: recent.length,
      failed24: recent.filter((r) => r.status === 'FAILED').length,
    };
  }, [runs, byAgent]);

  const recentRuns = useMemo(() => [...runs].sort((x, y) => y.startedAt.localeCompare(x.startedAt)).slice(0, 8), [runs]);

  if (loading || (!isHq && storeLoading)) {
    return <Box display="flex" justifyContent="center" py={10}><CircularProgress /></Box>;
  }
  if (!isHq && !storeId) {
    return <Alert severity="info">등록된 매장이 없어 에이전트 현황을 볼 수 없습니다.</Alert>;
  }

  // 조직도의 에이전트 한 명 (컴포넌트가 아니라 함수로 그려야 호버 때 DOM 이 다시 만들어지지 않아 카드 위치가 유지된다)
  const renderNode = (id: string, sub?: boolean) => {
    const m = AGENTS[id];
    const info = byAgent[id];
    const running = active?.agent === id || info.last?.status === 'RUNNING';
    const st = running ? STATUS.RUNNING : statusOf(info.last?.status);
    const on = hover?.id === id;
    return (
      <Stack key={id} direction="row" alignItems="center" sx={{ position: 'relative', pl: sub ? 5 : 2.5 }}>
        {/* 왼쪽 가지선 */}
        <Box sx={{ position: 'absolute', left: sub ? 22 : 0, top: '50%', width: sub ? 18 : 16, height: 0, borderTop: `2px solid ${LINE}` }} />
        {sub && <Box sx={{ position: 'absolute', left: 22, top: -10, height: 'calc(50% + 10px)', borderLeft: `2px dashed ${LINE}` }} />}
        <Stack
          direction="row" alignItems="center" gap={1.2}
          onMouseEnter={(e) => openCard(id, e.currentTarget)}
          onMouseLeave={closeCardSoon}
          sx={{
            flex: 1, minWidth: 0, p: 1.3, borderRadius: '10px', cursor: 'pointer', bgcolor: on ? alpha(m.color, 0.08) : 'background.paper',
            border: '1px solid', borderColor: on ? alpha(m.color, 0.5) : 'divider', transition: 'all .2s',
            boxShadow: on ? `0 10px 24px ${alpha(m.color, 0.16)}` : 'none',
          }}
        >
          <Box sx={{ position: 'relative', width: 40, height: 40, flexShrink: 0, borderRadius: '10px', bgcolor: alpha(m.color, 0.12), color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconifyIcon icon={m.icon} width={21} />
            <Box sx={{ position: 'absolute', right: -3, bottom: -3, width: 12, height: 12, borderRadius: '50%', bgcolor: st.color, border: '2px solid #fff', animation: running ? `${pulse} 1.2s infinite` : 'none' }} />
          </Box>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" gap={0.8}>
              <Typography fontWeight={800} fontSize={14.5} noWrap>{m.name}</Typography>
              {info.pending > 0 && <Box sx={{ px: 0.8, borderRadius: 9, bgcolor: '#FDF0E4', color: '#C26A1F', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>제안 {info.pending}</Box>}
            </Stack>
            <Typography fontSize={12.5} color="text.secondary" noWrap>{PLAIN[id].short}</Typography>
            {sub && <Typography fontSize={11} color="text.disabled" noWrap>폐기 위험 다음에 이어서 일해요</Typography>}
          </Box>
          <IconifyIcon icon="mingcute:right-line" width={16} sx={{ color: 'text.disabled', flexShrink: 0 }} />
        </Stack>
      </Stack>
    );
  };

  const hm = hover ? AGENTS[hover.id] : null;
  const hp = hover ? PLAIN[hover.id] : null;
  const hi = hover ? byAgent[hover.id] : null;
  const hRunning = hover && (active?.agent === hover.id || hi?.last?.status === 'RUNNING');

  return (
    <Stack gap={{ xs: 3, md: 4 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* ── AI 에이전트란? ── */}
      <Box sx={{ borderRadius: '10px', p: { xs: 2.5, md: 3.5 }, background: 'linear-gradient(120deg, #E7F6EF 0%, #EEEBFD 60%, #FBEFF4 100%)' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={{ xs: 2.5, lg: 4 }} alignItems={{ lg: 'center' }}>
          <Box sx={{ flex: '0 0 auto', maxWidth: { lg: 400 } }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Box sx={{ width: 38, height: 38, borderRadius: '10px', bgcolor: 'common.white', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon="mingcute:robot-line" width={22} />
              </Box>
              <Typography fontWeight={900} fontSize={{ xs: 19, md: 22 }}>AI 에이전트가 뭔가요?</Typography>
            </Stack>
            <Typography fontSize={{ xs: 14.5, md: 15.5 }} mt={1.5} lineHeight={1.7} sx={{ wordBreak: 'keep-all' }}>
              매장 기록을 대신 살펴보고 <b>해야 할 일을 먼저 찾아 알려주는 디지털 직원</b>이에요.
              에이전트는 제안만 하고, <b>실제 주문이나 기부는 사장님이 승인해야만</b> 진행돼요.
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.2 }}>
            {STEPS.map((st, i) => (
              <Stack key={st.title} sx={{ bgcolor: 'common.white', borderRadius: '10px', p: 1.8, position: 'relative' }} gap={0.6}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: i === 3 ? '#1F2B5B' : 'primary.main', color: 'common.white', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</Box>
                  <IconifyIcon icon={st.icon} width={20} sx={{ color: i === 3 ? '#1F2B5B' : 'primary.main' }} />
                </Stack>
                <Typography fontWeight={800} fontSize={15}>{st.title}</Typography>
                <Typography fontSize={12.5} color="text.secondary" sx={{ wordBreak: 'keep-all' }}>{st.text}</Typography>
              </Stack>
            ))}
          </Box>
        </Stack>
      </Box>

      {/* ── 한눈에 보기 ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: { xs: 1.5, md: 2 } }}>
        <Kpi icon="mingcute:user-3-line" color="#1D9E75" label="이번 주 일한 AI 직원" value={`${stats.activeAgents}명 / ${ORDER.length}명`} sub="최근 7일 기준" />
        <Kpi icon="mingcute:time-line" color="#2F7DD1" label="오늘 처리한 일" value={`${stats.runs24}건`} sub="최근 24시간" />
        <Kpi icon="mingcute:inbox-line" color="#E0803D" label="확인을 기다리는 제안" value={`${pending.length}건`} sub="AI 승인함에서 결정해요" />
        <Kpi icon="mingcute:warning-line" color="#E53935" label="문제가 생긴 일" value={`${stats.failed24}건`} sub={stats.failed24 ? '최근 활동을 확인해 주세요' : '오늘은 문제 없어요'} />
      </Box>

      {/* ── 에이전트 조직도 ── */}
      <Box sx={{ ...CARD, p: { xs: 2, md: 3.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={1} mb={3}>
          <Box>
            <Typography fontWeight={900} fontSize={{ xs: 19, md: 21 }}>AI 직원 조직도</Typography>
            <Typography fontSize={13.5} color="text.secondary" mt={0.5}>직원 카드에 마우스를 올리면 하는 일과 최근 기록을 볼 수 있어요.</Typography>
          </Box>
          <Stack direction="row" gap={1.5} flexWrap="wrap">
            {[STATUS.OK, STATUS.RUNNING, STATUS.FAILED].map((s) => (
              <Stack key={s.label} direction="row" alignItems="center" gap={0.6} fontSize={12.5} color="text.secondary">
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: s.color }} />{s.label}
              </Stack>
            ))}
          </Stack>
        </Stack>

        {/* 최상단: 사장님 → AI 승인함 */}
        <Stack alignItems="center">
          <Stack direction="row" alignItems="center" gap={1.2} sx={{ px: 2.5, py: 1.4, borderRadius: '10px', bgcolor: '#1F2B5B', color: 'common.white' }}>
            <IconifyIcon icon="mingcute:user-star-line" width={22} />
            <Box>
              <Typography fontWeight={800} fontSize={15}>{isHq ? '본사 관리자' : '사장님'}</Typography>
              <Typography fontSize={12} sx={{ opacity: 0.8 }}>최종 결정</Typography>
            </Box>
          </Stack>
          <Box sx={{ height: 22, borderLeft: `2px solid ${LINE}` }} />
          <Stack direction="row" alignItems="center" gap={1.2} onClick={() => navigate('/agent-inbox')} sx={{
            px: 2.5, py: 1.3, borderRadius: '10px', bgcolor: '#FFF7EE', border: '1px solid #F6D9B8', cursor: 'pointer',
            '&:hover': { boxShadow: '0 8px 20px rgba(224,128,61,.18)' },
          }}>
            <IconifyIcon icon="mingcute:inbox-line" width={21} sx={{ color: '#E0803D' }} />
            <Box>
              <Typography fontWeight={800} fontSize={14.5}>AI 승인함 <Box component="span" sx={{ color: '#C26A1F' }}>{pending.length}건 대기</Box></Typography>
              <Typography fontSize={12} color="text.secondary">직원들의 모든 제안이 모이는 곳</Typography>
            </Box>
          </Stack>
          <Box sx={{ height: 22, borderLeft: `2px solid ${LINE}` }} />
        </Stack>

        {/* 팀 가로선 (넓은 화면) */}
        <Box sx={{ display: { xs: 'none', lg: 'block' }, mx: '16.66%', borderTop: `2px solid ${LINE}` }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: { xs: 3, lg: 3 } }}>
          {TEAMS.map((t) => (
            <Box key={t.name}>
              <Box sx={{ display: { xs: 'none', lg: 'block' }, height: 20, width: 0, mx: 'auto', borderLeft: `2px solid ${LINE}` }} />
              <Stack direction="row" alignItems="center" gap={1.2} sx={{ p: 1.5, borderRadius: '10px', bgcolor: alpha(t.color, 0.08), mb: 1.5 }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: 'common.white', color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconifyIcon icon={t.icon} width={19} />
                </Box>
                <Box>
                  <Typography fontWeight={800} fontSize={15.5} color={t.color}>{t.name}</Typography>
                  <Typography fontSize={12.5} color="text.secondary">{t.desc}</Typography>
                </Box>
              </Stack>
              {/* 팀원: 왼쪽 세로 줄기 + 가지 */}
              <Stack gap={1.2} sx={{ position: 'relative', ml: 2.5, '&::before': { content: '""', position: 'absolute', left: 0, top: -12, bottom: 28, borderLeft: `2px solid ${LINE}` } }}>
                {t.members.map((mb) => renderNode(mb.id, mb.sub))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── 호버 카드: 하는 일 + 기록 + 버튼 ── */}
      <Popper
        open={!!hover}
        anchorEl={hover?.el}
        placement="right-start"
        modifiers={[{ name: 'offset', options: { offset: [0, 12] } }, { name: 'flip', options: { fallbackPlacements: ['left-start', 'bottom'] } }, { name: 'preventOverflow', options: { padding: 12 } }]}
        sx={{ zIndex: 1050 }}
      >
        {hover && hm && hp && hi && (
          <Paper elevation={0} onMouseEnter={keepCard} onMouseLeave={closeCardSoon} sx={{
            width: 340, maxWidth: 'calc(100vw - 24px)', p: 2.5, borderRadius: '10px', border: '1px solid', borderColor: alpha(hm.color, 0.35),
            boxShadow: '0 20px 48px rgba(30,40,90,.18)', animation: `${pop} .2s ease both`,
          }}>
            <Stack direction="row" alignItems="center" gap={1.2}>
              <Box sx={{ width: 42, height: 42, borderRadius: '10px', bgcolor: alpha(hm.color, 0.12), color: hm.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon={hm.icon} width={23} />
              </Box>
              <Box flex={1}>
                <Typography fontWeight={900} fontSize={17}>{hm.name}</Typography>
                <Typography fontSize={12} color="text.secondary">{hm.scope === '본사' ? '본사용 AI 직원' : '매장용 AI 직원'} · {hm.code}</Typography>
              </Box>
            </Stack>

            <Typography fontSize={14} mt={2} lineHeight={1.65} sx={{ wordBreak: 'keep-all' }}>{hp.does}</Typography>

            <Stack gap={0.8} mt={1.8} sx={{ p: 1.5, borderRadius: '8px', bgcolor: '#F6F8FB' }}>
              {[
                { icon: 'mingcute:time-line', k: '언제 일하나요?', v: hp.when },
                { icon: 'mingcute:eye-2-line', k: '결과는 어디서?', v: hp.result },
              ].map((r) => (
                <Stack key={r.k} direction="row" gap={1} alignItems="flex-start">
                  <IconifyIcon icon={r.icon} width={16} sx={{ color: hm.color, mt: '2px', flexShrink: 0 }} />
                  <Box>
                    <Typography fontSize={12} fontWeight={700} color="text.secondary">{r.k}</Typography>
                    <Typography fontSize={13} sx={{ wordBreak: 'keep-all' }}>{r.v}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mt: 1.8, textAlign: 'center' }}>
              {[
                { k: '최근 상태', v: hRunning ? '일하는 중' : hi.last ? statusOf(hi.last.status).label : '기록 없음', c: hRunning ? STATUS.RUNNING.color : statusOf(hi.last?.status).color },
                { k: '이번 주', v: `${hi.week}번 일함`, c: 'text.primary' },
                { k: '승인 대기', v: `${hi.pending}건`, c: hi.pending ? '#C26A1F' : 'text.primary' },
              ].map((x, i) => (
                <Box key={x.k} sx={{ borderLeft: i ? '1px solid' : 'none', borderColor: 'divider' }}>
                  <Typography fontSize={11.5} color="text.secondary">{x.k}</Typography>
                  <Typography fontSize={14} fontWeight={800} color={x.c}>{x.v}</Typography>
                </Box>
              ))}
            </Box>

            <Typography fontSize={12.5} fontWeight={700} color="text.secondary" mt={2} mb={0.6}>최근 기록</Typography>
            {hi.recent.length === 0 ? (
              <Typography fontSize={12.5} color="text.disabled">아직 일한 기록이 없어요.</Typography>
            ) : hi.recent.map((r) => (
              <Stack key={r.runId} direction="row" alignItems="center" gap={1} sx={{ py: 0.5 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: statusOf(r.status).color, flexShrink: 0 }} />
                <Typography fontSize={12.5} flex={1}>{statusOf(r.status).label} · {TRIGGER[r.triggerType] ?? r.triggerType}</Typography>
                <Typography fontSize={12} color="text.disabled">{ago(r.startedAt)}</Typography>
              </Stack>
            ))}

            <Stack direction="row" gap={1} mt={2}>
              {!isHq && RUNNABLE.includes(hover.id) && (
                <Button fullWidth size="small" variant="contained" disabled={!!active} onClick={() => handleRun(hover.id)}
                  startIcon={hRunning ? <CircularProgress size={13} color="inherit" /> : <IconifyIcon icon="mingcute:play-fill" width={15} />}
                  sx={{ bgcolor: hm.color, '&:hover': { bgcolor: hm.color, filter: 'brightness(.93)' } }}>
                  {hRunning ? '일하는 중' : '지금 일 시키기'}
                </Button>
              )}
              <Button fullWidth size="small" variant="outlined" onClick={() => navigate(`/agent-inbox?agent=${hover.id}`)}
                sx={{ borderColor: 'divider', color: 'text.primary' }}>
                {hi.pending ? `제안 ${hi.pending}건 보기` : '기록 보기'}
              </Button>
            </Stack>
          </Paper>
        )}
      </Popper>

      {/* ── 최근 활동 ── */}
      <Box sx={{ ...CARD, p: { xs: 2, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography fontWeight={900} fontSize={{ xs: 18, md: 20 }}>최근 활동</Typography>
          <Button size="small" variant="text" onClick={() => navigate('/agent-inbox')} endIcon={<IconifyIcon icon="mingcute:right-line" />}>AI 승인함</Button>
        </Stack>
        {recentRuns.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={5}>아직 AI 직원이 일한 기록이 없어요.</Typography>
        ) : recentRuns.map((r, i) => {
          const m = AGENTS[r.agent];
          const st = statusOf(r.status);
          return (
            <Stack key={r.runId} direction="row" alignItems="center" gap={1.5} sx={{ py: 1.4, borderTop: i ? '1px solid' : 'none', borderColor: 'divider' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0, bgcolor: alpha(m?.color ?? '#999', 0.12), color: m?.color ?? 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon={m?.icon ?? 'mingcute:robot-line'} width={19} />
              </Box>
              <Box flex={1} minWidth={0}>
                <Typography fontSize={14} noWrap>
                  <b>{m?.name ?? r.agent}</b> 직원이 {r.status === 'RUNNING' ? '일하고 있어요' : r.status === 'OK' ? '일을 마쳤어요' : '일하다 문제가 생겼어요'}
                </Typography>
                <Typography fontSize={12.5} color="text.secondary" noWrap>
                  {TRIGGER[r.triggerType] ?? r.triggerType}{isHq && r.storeId ? ` · 매장 #${r.storeId}` : ''}
                </Typography>
              </Box>
              <Typography fontSize={12.5} color="text.secondary" sx={{ flexShrink: 0 }}>{ago(r.startedAt)}</Typography>
              <Chip size="small" label={st.label} sx={{ bgcolor: alpha(st.color, 0.12), color: st.color, fontWeight: 700, border: 'none' }} />
            </Stack>
          );
        })}
      </Box>
    </Stack>
  );
};

export default AgentCenter;
