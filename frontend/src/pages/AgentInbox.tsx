import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, Tabs, Tab, Collapse,
  Table, TableBody, TableCell, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, useTheme,
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
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: '승인 대기', EXECUTED: '실행됨', REJECTED: '거절됨', FAILED: '실행 실패',
  STALE: '상태 변경됨', EXPIRED: '만료', RUNNING: '실행 중', OK: '완료',
};
const STATUS_COLOR: Record<string, any> = {
  PENDING: 'warning', EXECUTED: 'success', REJECTED: 'default', FAILED: 'error',
  STALE: 'secondary', EXPIRED: 'default', RUNNING: 'info', OK: 'success',
};

const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : '-');
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

const ProposalCard = ({ p, onApprove, onReject, onReplan }: {
  p: AgentProposal; onApprove: () => void; onReject: () => void; onReplan: () => void;
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
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
      <Collapse in={open}>
        <Box mt={2}><PayloadView payload={p.payload} /></Box>
        {p.execResult && (
          <Typography variant="caption" color="text.secondary" component="pre" mt={1}>
            실행 결과: {JSON.stringify(p.execResult, null, 2)}
          </Typography>
        )}
      </Collapse>
      <Stack direction="row" gap={1} mt={2}>
        <Button size="small" onClick={() => setOpen(!open)}>{open ? '근거 접기' : '근거 보기'}</Button>
        <Box flex={1} />
        {p.status === 'PENDING' && (
          <>
            <Button size="small" variant="outlined" color="error" onClick={onReject}>거절</Button>
            <Button size="small" variant="contained" onClick={onApprove}>승인</Button>
          </>
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
  const [searchParams] = useSearchParams();
  const replayId = searchParams.get('replay');

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
      setProposals(ps ?? []);
      setRuns(rs ?? []);
    } catch (e) {
      setError(errorMessage(e, '에이전트 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [scope, showDone]);

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
    if (!await confirm('이 제안을 승인하고 실행하시겠습니까?')) return;
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

  const handleRun = async (agent: string, sid: number) => {
    try {
      await agentService.run(agent, sid);
      setSuccess('에이전트를 실행했습니다. 잠시 후 결과가 표시됩니다.');
    } catch (e) { setError(errorMessage(e, '에이전트 실행에 실패했습니다. 에이전트 서비스(:8100)를 확인하세요.')); }
  };

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="h5" fontWeight={700}>AI 승인함</Typography>
        <Chip label={`승인 대기 ${proposals.filter((p) => p.status === 'PENDING').length}건`} color="warning" size="small" />
        <Box flex={1} />
        {!isHq && storeId && (
          <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:play-line" />}
            onClick={() => handleRun('echo', storeId)}>
            재고 점검 실행(테스트)
          </Button>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary">
        에이전트는 제안만 만듭니다. 수량은 결정적 코드가 계산하고, 승인해야 실행됩니다.
      </Typography>

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
            <ProposalCard key={p.id} p={p}
              onApprove={() => handleApprove(p)}
              onReject={() => setRejectTarget(p)}
              onReplan={() => handleRun(p.agent, p.storeId)} />
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
