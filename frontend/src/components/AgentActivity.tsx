import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, CircularProgress, Paper, Stack, Typography, alpha, keyframes, useTheme } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { agentService, AgentRun } from '../services/agentService';

const AGENT: Record<string, { name: string; icon: string }> = {
  echo: { name: '재고 점검', icon: 'mingcute:robot-line' },
  order_advisor: { name: '발주 참모', icon: 'mingcute:refresh-2-line' },
  waste: { name: '폐기 위험', icon: 'mingcute:delete-2-line' },
  donation: { name: '기부 매칭', icon: 'mingcute:gift-line' },
  hq_review: { name: '본사 발주 심사', icon: 'mingcute:shield-line' },
  mlops: { name: '예측 운영', icon: 'mingcute:brain-fill' },
  audit: { name: '데이터 감사', icon: 'mingcute:search-line' },
  inbound: { name: '입고 추적', icon: 'mingcute:truck-line' },
  weekly: { name: '주간 브리핑', icon: 'mingcute:calendar-line' },
};
const RUNNABLE = ['echo', 'order_advisor', 'waste'];

type StepState = 'done' | 'running' | 'skipped' | 'failed' | 'waiting';
interface Step { label: string; icon: string; state: StepState; detail: string }

const pulse = keyframes`0%,100% { opacity: .35 } 50% { opacity: 1 }`;
const blink = keyframes`0%,100% { opacity: 1 } 50% { opacity: .2 }`;
const spin = keyframes`to { transform: rotate(360deg) }`;

const ago = (s: string) => {
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
};
const duration = (r: AgentRun) => {
  if (!r.finishedAt) return null;
  const s = (new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000;
  return s < 60 ? `${s.toFixed(1)}초` : `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
};
const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);


const PHASES = [
  { key: 'observe', label: '데이터 조회', icon: 'mingcute:database-line', busy: '서버에서 조회 중' },
  { key: 'decide', label: '코드 계산', icon: 'mingcute:calculator-line', busy: '수량 계산 중' },
  { key: 'llm', label: 'LLM 검토', icon: 'mingcute:sparkles-line', busy: '검토·설명 작성 중' },
  { key: 'proposals', label: '제안 제출', icon: 'mingcute:inbox-line', busy: '승인함에 올리는 중' },
  { key: 'notify', label: '알림', icon: 'mingcute:notification-line', busy: '알림 보내는 중' },
] as const;

const secs = (ms: number) => (ms < 1000 ? `${Math.max(0, Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}초`);

/**
 * 런타임이 단계에 들어갈 때마다 resultJson.progress 에 {phase, at} 를 쌓는다 (PUT /agent/runs/{id}/progress).
 * 실행 중이면 마지막 단계가 진행 중, 실패면 마지막 단계에서 멈춘 것이다. progress 가 없는 예전 기록은 결과로만 복원한다.
 */
const stepsOf = (r: AgentRun, now: number): Step[] => {
  const res = r.resultJson ?? {};
  const llm = res.llm as Record<string, any> | null | undefined;
  const props = (Array.isArray(res.proposals) ? res.proposals : []) as any[];
  const notis = (Array.isArray(res.notifications) ? res.notifications : []) as any[];
  const progress = (Array.isArray(res.progress) ? res.progress : []) as { phase: string; at: string }[];
  const at: Record<string, number> = Object.fromEntries(progress.map((p) => [p.phase, new Date(p.at).getTime()]));
  const last = progress.length ? progress[progress.length - 1].phase : null;
  const lastIdx = PHASES.findIndex((p) => p.key === last);
  const end = r.finishedAt ? new Date(r.finishedAt).getTime() : now;
  // 예전 기록(progress 없음): 결과가 있으면 끝까지 갔다고 본다
  const legacy = !progress.length && r.status !== 'RUNNING';
  // 예외 없이 끝났지만 제출이 실패한 경우는 제출 단계 자체를 실패로 표시
  const submitFailed = (xs: any[]) => xs.some((x) => x && x.ok === false);

  return PHASES.map((p, i) => {
    const t = at[p.key];
    const nextT = progress.map((x) => at[x.phase]).filter((x) => x > t).sort((a, b) => a - b)[0] ?? end;
    const took = t ? secs(nextT - t) : '';
    let state: StepState;
    if (legacy) state = r.status === 'FAILED' && !('decision' in res) ? (i === 0 ? 'failed' : 'waiting') : 'done';
    else if (t === undefined) state = i < lastIdx ? 'skipped' : 'waiting';  // 앞 단계인데 기록 없음 = 건너뜀 (예: LLM 불필요)
    else if (p.key === last && r.status === 'RUNNING') state = 'running';
    else if (p.key === last && r.status === 'FAILED' && !('decision' in res)) state = 'failed';
    else state = 'done';
    if (r.status === 'FAILED' && 'decision' in res) {
      if (p.key === 'proposals' && submitFailed(props)) state = 'failed';
      if (p.key === 'notify' && submitFailed(notis)) state = 'failed';
    }

    let detail: string;
    if (state === 'running') detail = `${p.busy} · ${took}`;
    else if (state === 'failed') detail = took ? `실패 · ${took}` : '실패';
    else if (state === 'waiting') detail = '대기';
    else if (state === 'skipped') detail = p.key === 'llm' ? '필요 없음' : '건너뜀';
    else if (p.key === 'llm') detail = llm ? `${r.outputTokens ?? 0} 토큰${took ? ` · ${took}` : ''}` : '사용 안 함';
    else if (p.key === 'proposals') detail = `${props.length ? `${props.length}건 → 승인함` : '제안 없음'}${took ? ` · ${took}` : ''}`;
    else if (p.key === 'notify') detail = `${notis.length ? `${notis.length}건 발송` : '알림 없음'}${took ? ` · ${took}` : ''}`;
    else detail = took ? `완료 · ${took}` : '완료';
    if (legacy && p.key === 'llm' && !llm) state = 'skipped';
    return { label: p.label, icon: p.icon, state, detail };
  });
};

const summaryOf = (r: AgentRun): string | null => {
  const out = (r.resultJson?.llm as any)?.output;
  if (typeof out?.summary === 'string') return out.summary;
  const prop = (r.resultJson?.proposals as any[] | undefined)?.find((p) => p?.rationale);
  return prop?.rationale ?? null;
};

const Pipeline = ({ run }: { run: AgentRun }) => {
  const theme = useTheme();
  const color: Record<StepState, string> = {
    done: theme.palette.success.main, running: theme.palette.info.main, skipped: theme.palette.text.disabled,
    failed: theme.palette.error.main, waiting: theme.palette.text.disabled,
  };
  const mark: Record<StepState, string> = {
    done: 'mingcute:check-line', running: 'mingcute:loading-line', skipped: 'mingcute:minimize-line',
    failed: 'mingcute:close-line', waiting: 'mingcute:time-line',
  };
  // 실행 중에는 진행 중 단계의 경과 시간이 흐르도록 0.5초마다 다시 그린다
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (run.status !== 'RUNNING') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [run.status]);
  const steps = stepsOf(run, now);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' }, gap: 1 }}>
      {steps.map((s, i) => (
        <Box key={s.label} sx={{
          position: 'relative', p: 1.25, borderRadius: 2, minWidth: 0,
          border: `${s.state === 'running' ? 2 : 1}px solid ${alpha(color[s.state], s.state === 'skipped' || s.state === 'waiting' ? 0.25 : 0.6)}`,
          bgcolor: alpha(color[s.state], s.state === 'skipped' || s.state === 'waiting' ? 0.03 : 0.08),
          animation: s.state === 'running' ? `${pulse} 1.4s ease-in-out infinite` : undefined,
        }}>
          <Stack direction="row" alignItems="center" gap={0.8} mb={0.5}>
            <Box sx={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0, bgcolor: color[s.state], color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: s.state === 'running' ? `${spin} 1s linear infinite` : undefined,
            }}>
              <IconifyIcon icon={mark[s.state]} width={14} />
            </Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">{`${i + 1}단계`}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.6}>
            <IconifyIcon icon={s.icon} width={16} color={color[s.state]} />
            <Typography fontWeight={700} fontSize={13} noWrap>{s.label}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" noWrap title={s.detail}>{s.detail}</Typography>
        </Box>
      ))}
    </Box>
  );
};

const STATUS: Record<string, { label: string; color: 'info' | 'success' | 'error' | 'default' }> = {
  RUNNING: { label: '실행 중', color: 'info' }, OK: { label: '완료', color: 'success' }, FAILED: { label: '실패', color: 'error' },
};

const AgentActivity = ({ storeId }: { storeId: number }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kickedAt, setKickedAt] = useState(0);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(() => {
    agentService.getRuns(storeId)
      .then((r) => { setRuns(r ?? []); setFailed(false); })
      .catch(() => setFailed(true));
  }, [storeId]);

  // 실행 중이거나 방금 실행을 눌렀으면 1.5초, 아니면 20초마다 갱신
  const hot = !!runs?.some((r) => r.status === 'RUNNING') || Date.now() - kickedAt < 90_000;
  useEffect(() => {
    load();
    const id = setInterval(load, hot ? 1500 : 20000);
    return () => clearInterval(id);
  }, [load, hot]);

  const recent = useMemo(() => (runs ?? []).slice(0, 6), [runs]);
  const selected = recent.find((r) => r.runId === selectedId) ?? recent[0] ?? null;
  const today = useMemo(() => {
    const d = new Date().toDateString();
    const t = (runs ?? []).filter((r) => new Date(r.startedAt).toDateString() === d);
    return {
      total: t.length, ok: t.filter((r) => r.status === 'OK').length,
      fail: t.filter((r) => r.status === 'FAILED').length, running: t.filter((r) => r.status === 'RUNNING').length,
    };
  }, [runs]);

  // 누른 직후(기록이 아직 안 생김)와 실행 중에는 버튼에 돌아가는 원을 보여준다
  const [starting, setStarting] = useState<{ agent: string; runId: string | null } | null>(null);
  const startedRun = starting?.runId ? runs?.find((r) => r.runId === starting.runId) : undefined;
  const busy = (agent: string) => !!runs?.some((r) => r.agent === agent && r.status === 'RUNNING')
    || (starting?.agent === agent && (!starting.runId || !startedRun) && Date.now() - kickedAt < 30_000);

  const start = async (agent: string) => {
    setStarting({ agent, runId: null });
    setKickedAt(Date.now());
    try {
      const { runId } = await agentService.run(agent, storeId);
      setStarting({ agent, runId });
      setSelectedId(runId);
      setMessage({ text: `${AGENT[agent].name} 에이전트를 시작했습니다.`, error: false });
      load();
    } catch {
      setStarting(null);
      setMessage({ text: '실행하지 못했습니다. 에이전트 서비스(:8100)를 확인하세요.', error: true });
    }
  };

  const meta = (a: string) => AGENT[a] ?? { name: a, icon: 'mingcute:robot-line' };

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1.5}>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="mingcute:robot-line" width={22} />
          <Typography fontWeight={700}>AI 에이전트 실행 현황</Typography>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: hot ? 'info.main' : 'success.main', animation: `${blink} 1.4s infinite` }} />
            <Typography variant="caption" color="text.secondary">{hot ? '1.5초마다 갱신' : '자동 갱신'}</Typography>
          </Stack>
        </Stack>
        <Typography onClick={() => navigate('/agent-inbox')}
          sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
          승인함 →
        </Typography>
      </Stack>

      {/* 오늘 요약 + 실행 버튼 */}
      <Stack direction="row" gap={1} flexWrap="wrap" mb={1.5}>
        <Chip size="small" label={`오늘 ${today.total}회`} />
        <Chip size="small" color="success" variant="outlined" label={`완료 ${today.ok}`} />
        {today.running > 0 && <Chip size="small" color="info" label={`실행 중 ${today.running}`} />}
        {today.fail > 0 && <Chip size="small" color="error" variant="outlined" label={`실패 ${today.fail}`} />}
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
        {RUNNABLE.map((a) => (
          <Button key={a} size="small" variant={busy(a) ? 'contained' : 'outlined'} disabled={busy(a)} onClick={() => start(a)}
            startIcon={busy(a) ? <CircularProgress size={14} color="inherit" /> : <IconifyIcon icon="mingcute:play-fill" width={16} />}>
            {busy(a) ? `${meta(a).name} 생각 중…` : meta(a).name}
          </Button>
        ))}
      </Stack>
      {message && (
        <Typography variant="caption" color={message.error ? 'error' : 'text.secondary'} display="block" mb={1.5}>
          {message.text}
        </Typography>
      )}

      {failed && !runs ? (
        <Typography variant="body2" color="text.secondary">실행 기록을 불러오지 못했습니다.</Typography>
      ) : !runs ? (
        <Typography variant="body2" color="text.secondary">불러오는 중…</Typography>
      ) : !selected ? (
        <Typography variant="body2" color="text.secondary">아직 실행 기록이 없습니다. 위 버튼으로 에이전트를 실행해 보세요.</Typography>
      ) : (
        <Stack gap={2}>
          {/* 선택한 실행의 단계 */}
          <Box>
            <Stack direction="row" alignItems="center" gap={1} mb={1} flexWrap="wrap">
              <IconifyIcon icon={meta(selected.agent).icon} width={18} />
              <Typography fontWeight={700} fontSize={14}>{meta(selected.agent).name}</Typography>
              <Chip size="small" label={STATUS[selected.status]?.label ?? selected.status} color={STATUS[selected.status]?.color ?? 'default'} />
              <Typography variant="caption" color="text.secondary">
                {ago(selected.startedAt)}{duration(selected) ? ` · ${duration(selected)}` : ''} · {selected.triggerType === 'MANUAL' ? '수동' : '스케줄'}
              </Typography>
            </Stack>
            <Pipeline run={selected} />
            {selected.status === 'FAILED' && selected.error && (
              <Typography variant="caption" color="error" display="block" mt={1}>{selected.error}</Typography>
            )}
            {summaryOf(selected) && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.06), borderLeft: `3px solid ${theme.palette.primary.main}` }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>LLM 요약</Typography>
                <Typography variant="body2" sx={{ mt: 0.3 }}>{summaryOf(selected)}</Typography>
              </Box>
            )}
          </Box>

          {/* 최근 실행 타임라인 */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>최근 실행</Typography>
            <Stack mt={0.5}>
              {recent.map((r) => {
                const s = STATUS[r.status];
                const dot = r.status === 'OK' ? theme.palette.success.main : r.status === 'FAILED' ? theme.palette.error.main : theme.palette.info.main;
                const nProp = count(r.resultJson?.proposals);
                return (
                  <Stack key={r.runId} direction="row" alignItems="center" gap={1.2} onClick={() => setSelectedId(r.runId)}
                    sx={{
                      py: 0.9, px: 1, borderRadius: 1.5, cursor: 'pointer',
                      bgcolor: r.runId === selected.runId ? 'action.selected' : undefined, '&:hover': { bgcolor: 'action.hover' },
                    }}>
                    <Box sx={{
                      width: 8, height: 8, borderRadius: '50%', bgcolor: dot, flexShrink: 0,
                      animation: r.status === 'RUNNING' ? `${blink} 1s infinite` : undefined,
                    }} />
                    <IconifyIcon icon={meta(r.agent).icon} width={16} />
                    <Typography fontSize={13} fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>{meta(r.agent).name}</Typography>
                    {nProp > 0 && <Typography variant="caption" color="warning.main" fontWeight={700} noWrap>제안 {nProp}</Typography>}
                    <Typography variant="caption" color="text.secondary" noWrap>{ago(r.startedAt)}</Typography>
                    <Chip size="small" label={s?.label ?? r.status} color={s?.color ?? 'default'} variant={r.status === 'OK' ? 'outlined' : 'filled'} />
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      )}
    </Paper>
  );
};

export default AgentActivity;
