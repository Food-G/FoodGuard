import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, Tabs, Tab, Collapse,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, LinearProgress, alpha, useTheme,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import AlertMessages from '../components/AlertMessages';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import { agentService, AgentProposal, AgentRun } from '../services/agentService';

const AGENT_LABEL: Record<string, { name: string; icon: string }> = {
  echo: { name: '재고 점검(테스트)', icon: 'mingcute:robot-line' },
  order_advisor: { name: '발주 참모', icon: 'mingcute:refresh-2-line' },
  waste: { name: '폐기 위험', icon: 'mingcute:heart-fill' },
  donation: { name: '기부 매칭', icon: 'mingcute:gift-line' },
  hq_review: { name: '본사 발주 심사', icon: 'mingcute:shield-line' },
  mlops: { name: '예측 운영', icon: 'mingcute:brain-fill' },
  audit: { name: '데이터 감사', icon: 'mingcute:search-line' },
  inbound: { name: '입고 추적', icon: 'mingcute:truck-line' },
  weekly: { name: '주간 브리핑', icon: 'mingcute:calendar-line' },
  chat: { name: 'AI 코파일럿', icon: 'mingcute:robot-line' },
};
// 데이터를 바꾸지 않는 정보 카드: 승인·거절 대신 "확인"만 한다
const INFO_TYPES = new Set(['AUDIT_REPORT', 'WEEKLY_BRIEFING']);
const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기', EXECUTED: '실행됨', REJECTED: '거절됨', FAILED: '실행 실패',
  STALE: '상태 변경됨', EXPIRED: '만료', RUNNING: '실행 중', OK: '완료',
};
const STATUS_COLOR: Record<string, any> = {
  PENDING: 'warning', EXECUTED: 'success', REJECTED: 'default', FAILED: 'error',
  STALE: 'secondary', EXPIRED: 'default', RUNNING: 'info', OK: 'success',
};

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : '-');

// 런타임이 resultJson.progress 에 쌓는 단계 (fgagent/runtime/runner.py)
const PHASES: { key: string; short: string; busy: string }[] = [
  { key: 'observe', short: '데이터 조회', busy: '재고·판매 데이터를 조회하고 있습니다' },
  { key: 'decide', short: '수량 계산', busy: '코드가 수량을 계산하고 있습니다' },
  { key: 'llm', short: 'AI 검토', busy: 'AI가 결과를 검토하고 설명을 쓰고 있습니다' },
  { key: 'proposals', short: '제안 제출', busy: '승인함에 제안을 올리고 있습니다' },
  { key: 'notify', short: '알림', busy: '알림을 보내고 있습니다' },
];
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveRun { runId: string; agent: string; startedAt: number; run: AgentRun | null }

/** 실행을 누른 뒤 끝날 때까지 보여주는 진행 배너 */
const RunningBanner = ({ active, now }: { active: ActiveRun; now: number }) => {
  const theme = useTheme();
  const name = AGENT_LABEL[active.agent]?.name ?? active.agent;
  const progress = ((active.run?.resultJson?.progress ?? []) as { phase: string }[]).map((p) => p.phase);
  const current = progress[progress.length - 1];
  const currentIdx = PHASES.findIndex((p) => p.key === current);
  const sec = Math.max(0, Math.floor((now - active.startedAt) / 1000));
  return (
    <Paper elevation={0} role="status" aria-live="polite" sx={{
      p: { xs: 2, sm: 2.5 }, borderRadius: 3,
      border: `2px solid ${theme.palette.primary.main}`, bgcolor: alpha(theme.palette.primary.main, 0.04),
    }}>
      <Stack direction="row" alignItems="center" gap={2}>
        <CircularProgress size={40} thickness={4.5} />
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={800}>{name} · 생각 중…</Typography>
          <Typography variant="body2" color="text.secondary">
            {PHASES[currentIdx]?.busy ?? '에이전트를 시작하고 있습니다'} · {sec}초 경과
          </Typography>
        </Box>
      </Stack>
      <LinearProgress sx={{ mt: 2, height: 6, borderRadius: 3 }} />
      <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
        {PHASES.map((p, i) => {
          const isCurrent = i === currentIdx;
          const done = i < currentIdx && progress.includes(p.key);
          return (
            <Chip key={p.key} size="small" label={p.short}
              color={isCurrent ? 'primary' : done ? 'success' : 'default'}
              variant={isCurrent ? 'filled' : 'outlined'}
              icon={isCurrent ? <CircularProgress size={12} color="inherit" />
                : done ? <IconifyIcon icon="mingcute:check-line" width={14} /> : undefined}
              sx={{ opacity: !isCurrent && !done ? 0.5 : 1 }} />
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.disabled" display="block" mt={1}>
        다른 화면으로 가도 실행은 계속됩니다. 끝나면 아래 제안 목록이 자동으로 갱신됩니다.
      </Typography>
    </Paper>
  );
};
const errorMessage = (e: unknown, fallback: string) => {
  try { return JSON.parse((e as Error).message)?.message ?? fallback; } catch { return (e as Error)?.message || fallback; }
};

/** payload 의 객체 배열(items 등)은 표로, 나머지는 키-값으로 보여준다. */
const PayloadView = ({ payload }: { payload: Record<string, any> }) => (
  <Stack gap={1.5}>
    {Object.entries(payload).map(([key, value]) => {
      if (Array.isArray(value) && value.length && typeof value[0] === 'object') {
        const cols = Object.keys(value[0]);
        return (
          <Table key={key} size="small">
            <TableHead><TableRow>{cols.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {value.map((row, i) => (
                <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(row[c] ?? '-')}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        );
      }
      return (
        <Typography key={key} variant="body2"><b>{key}</b>: {typeof value === 'object' ? JSON.stringify(value) : String(value)}</Typography>
      );
    })}
  </Stack>
);

const RISK_LABEL: Record<string, { label: string; color: any }> = {
  stockout: { label: '품절 위험', color: 'error' },
  below_threshold: { label: '임계치 미만', color: 'warning' },
  awaiting_delivery: { label: '입고 대기 의존', color: 'info' },
  waste: { label: '폐기 위험', color: 'secondary' },
  no_demand: { label: '수요 없음', color: 'default' },
};
const VERDICT_LABEL: Record<string, string> = { approve: '그대로', reduce: '감축', hold: '보류' };

/** 발주 참모(AG-1) 발주안: 품목 표 + 위험 배지 + 경고·우려 */
const OrderPlanView = ({ payload }: { payload: Record<string, any> }) => (
  <Stack gap={1.5} mt={1.5}>
    {payload.risks?.length > 0 && (
      <Stack direction="row" gap={0.5} flexWrap="wrap">
        {payload.risks.map((r: any, i: number) => (
          <Chip key={i} size="small" color={RISK_LABEL[r.risk]?.color ?? 'default'}
            label={`${RISK_LABEL[r.risk]?.label ?? r.risk} · ${r.ingredientName}`} />
        ))}
      </Stack>
    )}
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>식자재</TableCell><TableCell align="right">필요량</TableCell>
          <TableCell align="right">재고</TableCell><TableCell align="right">대기발주</TableCell>
          <TableCell align="right">계획량</TableCell><TableCell align="right">발주량</TableCell>
          <TableCell>참모 판정</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {(payload.items ?? []).map((it: any) => (
          <TableRow key={it.ingredientId}>
            <TableCell>{it.ingredientName}</TableCell>
            <TableCell align="right">{it.requiredQty}{it.unit}</TableCell>
            <TableCell align="right">{it.currentStock}{it.unit}</TableCell>
            <TableCell align="right">{it.pendingQty}{it.unit}</TableCell>
            <TableCell align="right">{it.planQty}{it.unit}</TableCell>
            <TableCell align="right"><b>{it.orderQty}{it.unit}</b></TableCell>
            <TableCell title={it.reason}>{VERDICT_LABEL[it.verdict] ?? it.verdict}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    {payload.held?.length > 0 && (
      <Typography variant="body2" color="text.secondary">보류(발주 안 함): {payload.held.join(', ')}</Typography>
    )}
    {[...(payload.warnings ?? []), ...(payload.concerns ?? [])].map((c: string, i: number) => (
      <Typography key={i} variant="body2" color="warning.main">⚠ {c}</Typography>
    ))}
  </Stack>
);

/** 기부 매칭(AG-3): 기관·수량 + 콜드체인 등 우려 + 점주가 직접 보낼 메시지 초안 */
const DonationView = ({ payload }: { payload: Record<string, any> }) => (
  <Stack gap={1} mt={1.5}>
    <Typography variant="body2" fontWeight={700}>
      {payload.ingredientName} {payload.quantity}{payload.unit} → {payload.orgName} (기한 D-{payload.daysUntilExpiry})
    </Typography>
    {(payload.concerns ?? []).map((c: string, i: number) => (
      <Typography key={i} variant="body2" color="warning.main">⚠ {c}</Typography>
    ))}
    <TextField label="요청 메시지 초안 (자동 발송되지 않습니다. 복사해서 직접 보내세요)" value={payload.draftMessage ?? ''}
      size="small" fullWidth multiline minRows={3} InputProps={{ readOnly: true }} />
    <Box>
      <Button size="small" variant="outlined" onClick={() => navigator.clipboard.writeText(payload.draftMessage ?? '')}>
        메시지 복사
      </Button>
    </Box>
  </Stack>
);

const ProposalCard = ({ p, isHq, onApprove, onReject, onReplan, onRollback }: {
  p: AgentProposal; isHq: boolean; onApprove: () => void; onReject: () => void; onReplan: () => void; onRollback: () => void;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  // 모델 교체는 전사 운영 판단이라 본사만 승인한다 (서버도 막는다)
  const canDecide = p.type !== 'MODEL_PROMOTE' || isHq;
  const agent = AGENT_LABEL[p.agent] ?? { name: p.agent, icon: 'mingcute:robot-line' };
  return (
    <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" gap={1.5} mb={1}>
        <IconifyIcon icon={agent.icon} width={22} />
        <Typography fontWeight={700}>{agent.name}</Typography>
        <Chip label={p.type} size="small" variant="outlined" />
        <Chip label={STATUS_LABEL[p.status] ?? p.status} color={STATUS_COLOR[p.status] ?? 'default'} size="small" />
        <Box flex={1} />
        <Typography variant="caption" color="text.secondary">
          매장 {p.storeId} · {fmt(p.createdAt)} · 만료 {fmt(p.expiresAt)}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{p.rationale}</Typography>
      {p.type === 'ORDER_CREATE' && <OrderPlanView payload={p.payload} />}
      {p.type === 'DONATION_CREATE' && <DonationView payload={p.payload} />}
      <Collapse in={open}>
        {p.type !== 'ORDER_CREATE' && <Box mt={2}><PayloadView payload={p.payload} /></Box>}
        {p.execResult && (
          <Typography variant="caption" color="text.secondary" component="pre" mt={1}>
            실행 결과: {JSON.stringify(p.execResult, null, 2)}
          </Typography>
        )}
      </Collapse>
      <Stack direction="row" gap={1} mt={2}>
        <Button size="small" onClick={() => setOpen(!open)}>
          {open ? '접기' : p.type === 'ORDER_CREATE' ? '실행 결과 보기' : '근거 보기'}
        </Button>
        <Box flex={1} />
        {p.status === 'PENDING' && canDecide && (
          <>
            {!INFO_TYPES.has(p.type) && <Button size="small" variant="outlined" color="error" onClick={onReject}>거절</Button>}
            <Button size="small" variant="contained" onClick={onApprove}>{INFO_TYPES.has(p.type) ? '확인' : '승인'}</Button>
          </>
        )}
        {p.status === 'PENDING' && !canDecide && (
          <Typography variant="caption" color="text.secondary">본사 승인 대상입니다</Typography>
        )}
        {p.type === 'MODEL_PROMOTE' && p.status === 'EXECUTED' && isHq && p.execResult?.archived && (
          <Button size="small" variant="outlined" color="warning" onClick={onRollback}>교체 되돌리기</Button>
        )}
        {p.status === 'STALE' && (
          <Button size="small" variant="contained" color="secondary" onClick={onReplan}>다시 계획</Button>
        )}
      </Stack>
    </Paper>
  );
};

const AgentInbox = ({ user }: any) => {
  const theme = useTheme();
  const isHq = user?.role === 'HQ_ADMIN';
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const replayId = searchParams.get('replay');
  const agentFilter = searchParams.get('agent');  // 쉼표로 여러 에이전트 (브리핑 카드에서 이동)

  const [tab, setTab] = useState(replayId ? 1 : 0);
  const [showDone, setShowDone] = useState(false);
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectTarget, setRejectTarget] = useState<AgentProposal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // 점주는 자기 매장, 본사는 전 매장
  const scope = isHq ? null : storeId;

  const load = useCallback(async () => {
    try {
      const [ps, rs] = await Promise.all([
        agentService.getProposals(scope, showDone ? undefined : 'PENDING'),
        agentService.getRuns(scope),
      ]);
      // 본사 발주 심사 결과는 승인 대상이 아니라 발주 관리 화면에 표시한다
      setProposals((ps ?? []).filter((p) => p.agent !== 'hq_review' && (!agentFilter || agentFilter.split(',').includes(p.agent))));
      setRuns(rs ?? []);
    } catch (e) {
      setError(errorMessage(e, '에이전트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [scope, showDone, agentFilter]);

  useEffect(() => {
    if (!isHq && (storeLoading || !storeId)) { if (!storeLoading) setLoading(false); return; }
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [isHq, storeId, storeLoading, load]);

  // ?replay=<runId> : 실행 기록 탭에서 그 실행 결과를 연다 (시연 백업, DEV_ROADMAP P0-5)
  useEffect(() => {
    if (!replayId) return;
    agentService.getRun(replayId).then(setSelectedRun)
      .catch((e) => setError(errorMessage(e, '실행 기록을 찾을 수 없습니다.')));
  }, [replayId]);

  const handleApprove = async (p: AgentProposal) => {
    if (!await confirm(INFO_TYPES.has(p.type) ? '이 리포트를 확인 처리하시겠습니까? 데이터는 바뀌지 않습니다.' : '이 제안을 승인하고 실행하시겠습니까?')) return;
    try {
      const r = await agentService.approve(p.id);
      if (r.status === 'EXECUTED') setSuccess('승인했습니다. 제안이 실행되었습니다.');
      else setError(`승인했지만 실행되지 않았습니다 (${STATUS_LABEL[r.status] ?? r.status}): ${r.execResult?.error ?? ''}`);
      await load();
    } catch (e) { setError(errorMessage(e, '승인에 실패했습니다.')); }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await agentService.reject(rejectTarget.id, rejectReason);
      setSuccess('제안을 거절했습니다.');
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (e) { setError(errorMessage(e, '거절에 실패했습니다.')); }
  };

  const handleRollback = async (p: AgentProposal) => {
    if (!await confirm(`매장 ${p.storeId}의 예측 모델을 교체 전으로 되돌리시겠습니까?`)) return;
    try {
      await agentService.rollbackModel(p.storeId, p.execResult?.archived);
      setSuccess('예측 모델을 교체 전으로 되돌렸습니다.');
    } catch (e) { setError(errorMessage(e, '되돌리기에 실패했습니다.')); }
  };

  const [active, setActive] = useState<ActiveRun | null>(null);
  const [now, setNow] = useState(Date.now());

  const handleRun = async (agent: string, sid: number) => {
    if (active) return;
    setError(''); setSuccess('');
    try {
      const { runId } = await agentService.run(agent, sid);
      setActive({ runId, agent, startedAt: Date.now(), run: null });
    } catch (e) { setError(errorMessage(e, '에이전트 실행에 실패했습니다. 에이전트 서비스(:8100)를 확인하세요.')); }
  };

  // 실행 중이면 1초마다 상태를 확인하고, 끝나면 결과를 알리고 목록을 다시 불러온다
  const activeId = active?.runId;
  const activeAgent = active?.agent;
  const activeStart = active?.startedAt;
  useEffect(() => {
    if (!activeId || !activeAgent || !activeStart) return;
    let alive = true;
    const name = AGENT_LABEL[activeAgent]?.name ?? activeAgent;
    const tick = async () => {
      setNow(Date.now());
      if (Date.now() - activeStart > RUN_TIMEOUT_MS) {
        setActive(null);
        setError(`${name}: 5분 동안 끝나지 않았습니다. 실행 기록 탭에서 상태를 확인하세요.`);
        return;
      }
      let run: AgentRun;
      try { run = await agentService.getRun(activeId); } catch { return; }  // 기록이 생기기 전이면 다음 틱에 다시
      if (!alive) return;
      if (run.status === 'RUNNING') {
        setActive((a) => (a && a.runId === activeId ? { ...a, run } : a));
        return;
      }
      setActive(null);
      const n = Array.isArray(run.resultJson?.proposals) ? run.resultJson.proposals.length : 0;
      if (run.status === 'OK') setSuccess(`${name} 완료. ${n ? `새 제안 ${n}건이 올라왔습니다.` : '새 제안은 없습니다.'}`);
      else setError(`${name} 실행 실패: ${run.error ?? '실행 기록 탭에서 확인하세요.'}`);
      load();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(timer); };
  }, [activeId, activeAgent, activeStart, load]);

  const runIcon = (agent: string, icon: string) => (active?.agent === agent
    ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon={icon} />);

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="h5" fontWeight={700}>AI 승인함</Typography>
        <Chip label={`승인 대기 ${proposals.filter((p) => p.status === 'PENDING').length}건`} color="warning" size="small" />
        {agentFilter && (
          <Chip size="small" variant="outlined" onDelete={() => setSearchParams({})}
            label={`필터: ${agentFilter.split(',').map((a) => AGENT_LABEL[a]?.name ?? a).join(', ')}`} />
        )}
        <Box flex={1} />
        {!isHq && storeId && (
          <>
            <Button variant="outlined" startIcon={runIcon('echo', 'mingcute:play-line')} disabled={!!active}
              onClick={() => handleRun('echo', storeId)}>
              재고 점검 실행(테스트)
            </Button>
            <Button variant="contained" startIcon={runIcon('order_advisor', 'mingcute:refresh-2-line')} disabled={!!active}
              onClick={() => handleRun('order_advisor', storeId)}>
              {active?.agent === 'order_advisor' ? '발주안 만드는 중…' : '발주안 지금 만들기'}
            </Button>
            <Button variant="contained" color="secondary" startIcon={runIcon('waste', 'mingcute:delete-2-line')} disabled={!!active}
              onClick={() => handleRun('waste', storeId)}>
              폐기 위험 점검
            </Button>
          </>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        에이전트는 제안만 만듭니다. 수량은 결정적 코드가 계산하고, 승인해야 실행됩니다.
      </Typography>

      {active && <RunningBanner active={active} now={now} />}

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      <Paper sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label="제안" />
          <Tab label="실행 기록" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : tab === 0 ? (
        <Stack gap={2}>
          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" onClick={() => setShowDone(!showDone)}>
              {showDone ? '승인 대기만 보기' : '처리된 제안도 보기'}
            </Button>
          </Stack>
          {proposals.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={6}>처리할 제안이 없습니다.</Typography>
          ) : proposals.map((p) => (
            <ProposalCard key={p.id} p={p} isHq={isHq}
              onApprove={() => handleApprove(p)}
              onReject={() => setRejectTarget(p)}
              onReplan={() => handleRun(p.agent, p.storeId)}
              onRollback={() => handleRollback(p)} />
          ))}
        </Stack>
      ) : (
        <Paper sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>시작</TableCell><TableCell>에이전트</TableCell><TableCell>매장</TableCell>
                <TableCell>트리거</TableCell><TableCell>상태</TableCell><TableCell>모델</TableCell>
                <TableCell align="right">토큰(입/출)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.runId} hover selected={selectedRun?.runId === r.runId}
                  onClick={() => setSelectedRun(r)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{fmt(r.startedAt)}</TableCell>
                  <TableCell>{AGENT_LABEL[r.agent]?.name ?? r.agent}</TableCell>
                  <TableCell>{r.storeId ?? '전체'}</TableCell>
                  <TableCell>{r.triggerType}</TableCell>
                  <TableCell>
                    <Chip label={STATUS_LABEL[r.status] ?? r.status} color={STATUS_COLOR[r.status] ?? 'default'} size="small" />
                  </TableCell>
                  <TableCell>{r.model ?? '-'}</TableCell>
                  <TableCell align="right">{r.inputTokens ?? '-'} / {r.outputTokens ?? '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {selectedRun && (
            <Box mt={2}>
              <Typography fontWeight={700} mb={1}>실행 {selectedRun.runId}</Typography>
              {selectedRun.error && <Typography color="error" variant="body2">{selectedRun.error}</Typography>}
              <Box component="pre" sx={{ fontSize: 12, bgcolor: 'background.default', p: 2, borderRadius: 2, overflow: 'auto', maxHeight: 480 }}>
                {JSON.stringify(selectedRun.resultJson, null, 2)}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      <Dialog open={rejectTarget !== null} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>제안 거절</DialogTitle>
        <DialogContent>
          <TextField label="거절 사유 (선택)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            fullWidth multiline minRows={2} size="small" sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectTarget(null)}>취소</Button>
          <Button variant="contained" color="error" onClick={handleReject}>거절</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default AgentInbox;
