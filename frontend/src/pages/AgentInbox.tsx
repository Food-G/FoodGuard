import { ReactNode, useCallback, useEffect, useState } from 'react';
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
import { AGENTS, PLAIN } from './AgentCenter';
import { timeAgo, dateTimeLabel } from '../utils/timeAgo';

// 에이전트 이름·아이콘·색 (에이전트 센터와 같은 값). 코파일럿 대화 기록처럼 목록에 없는 것은 기본값
const meta = (agent: string) => AGENTS[agent]
  ?? { name: agent === 'chat' ? 'AI 코파일럿' : agent, icon: 'mingcute:robot-line', color: '#607D8B' };
// 받침이 있으면 '이', 없으면 '가' (발주 참모가 / 폐기 위험이)
const ga = (word: string) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return `${word}${c >= 0 && c <= 11171 && c % 28 ? '이' : '가'}`;
};

// 데이터를 바꾸지 않는 정보 카드: 승인·거절 대신 "확인"만 한다
const INFO_TYPES = new Set(['AUDIT_REPORT', 'WEEKLY_BRIEFING']);
// 제안 종류를 사장님 말로
const TYPE_LABEL: Record<string, string> = {
  ORDER_CREATE: '발주 제안', ORDER_REDUCE: '발주 줄이기 제안', ORDER_FLAG: '발주 확인 요청',
  DONATION_CREATE: '기부 제안', DISCOUNT_SUGGEST: '할인 판매 제안', WASTE_RECORD: '폐기 기록 제안',
  MODEL_PROMOTE: '예측 방법 교체 제안', AUDIT_REPORT: '데이터 점검 결과', WEEKLY_BRIEFING: '지난주 요약',
};
const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: '결정 기다리는 중', color: '#E0803D' },
  EXECUTED: { label: '실행 완료', color: '#1D9E75' },
  REJECTED: { label: '거절함', color: '#8A90A6' },
  FAILED: { label: '실패', color: '#E53935' },
  STALE: { label: '그 사이 상황이 바뀜', color: '#7A4FD6' },
  EXPIRED: { label: '기한 지남', color: '#8A90A6' },
  RUNNING: { label: '일하는 중', color: '#2F7DD1' },
  OK: { label: '완료', color: '#1D9E75' },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, color: '#8A90A6' };
const TRIGGER: Record<string, string> = { MANUAL: '직접 실행', SCHEDULE: '정해진 시간에 자동 실행', EVENT: '다른 에이전트가 이어서 실행' };

const CARD = { p: { xs: 2, sm: 2.5 }, borderRadius: '10px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 6px 24px rgba(30,40,90,0.06)' };

const Pill = ({ label, color }: { label: string; color: string }) => (
  <Box sx={{ px: 1.1, py: 0.3, borderRadius: 9, bgcolor: alpha(color, 0.12), color, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</Box>
);
const IconTile = ({ icon, color, size = 42 }: { icon: string; color: string; size?: number }) => (
  <Box sx={{ width: size, height: size, borderRadius: '10px', flexShrink: 0, bgcolor: alpha(color, 0.12), color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <IconifyIcon icon={icon} width={size * 0.52} />
  </Box>
);
// 연한 바탕 안내 상자 (요약·주의 등)
const Note = ({ color, icon, title, children }: { color: string; icon: string; title?: string; children: ReactNode }) => (
  <Stack direction="row" gap={1.2} sx={{ p: 1.5, borderRadius: '8px', bgcolor: alpha(color, 0.07) }}>
    <IconifyIcon icon={icon} width={18} sx={{ color, flexShrink: 0, mt: 0.2 }} />
    <Box minWidth={0}>
      {title && <Typography fontSize={13} fontWeight={800} color={color} mb={0.3}>{title}</Typography>}
      <Typography component="div" fontSize={13.5} sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{children}</Typography>
    </Box>
  </Stack>
);
const DevBox = ({ value }: { value: unknown }) => (
  <Box component="pre" sx={{ fontSize: 11.5, bgcolor: '#F6F8FB', p: 1.5, borderRadius: '8px', overflow: 'auto', maxHeight: 360, m: 0, mt: 1 }}>
    {JSON.stringify(value, null, 2)}
  </Box>
);

// 런타임이 resultJson.progress 에 쌓는 단계 (fgagent/runtime/runner.py)
const PHASES: { key: string; short: string; busy: string }[] = [
  { key: 'observe', short: '기록 살펴보기', busy: '재고·판매 기록을 살펴보고 있어요' },
  { key: 'decide', short: '필요한 양 계산', busy: '필요한 양을 계산하고 있어요' },
  { key: 'llm', short: 'AI 검토', busy: 'AI가 결과를 검토하고 설명을 쓰고 있어요' },
  { key: 'proposals', short: '승인함에 올리기', busy: '승인함에 제안을 올리고 있어요' },
  { key: 'notify', short: '알림 보내기', busy: '알림을 보내고 있어요' },
];
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

interface ActiveRun { runId: string; agent: string; startedAt: number; run: AgentRun | null }

/** 실행을 누른 뒤 끝날 때까지 보여주는 진행 배너 */
const RunningBanner = ({ active, now }: { active: ActiveRun; now: number }) => {
  const theme = useTheme();
  const name = meta(active.agent).name;
  const progress = ((active.run?.resultJson?.progress ?? []) as { phase: string }[]).map((p) => p.phase);
  const current = progress[progress.length - 1];
  const currentIdx = PHASES.findIndex((p) => p.key === current);
  const sec = Math.max(0, Math.floor((now - active.startedAt) / 1000));
  return (
    <Paper elevation={0} role="status" aria-live="polite" sx={{
      p: { xs: 2, sm: 2.5 }, borderRadius: '10px',
      border: `2px solid ${theme.palette.primary.main}`, bgcolor: alpha(theme.palette.primary.main, 0.04),
    }}>
      <Stack direction="row" alignItems="center" gap={2}>
        <CircularProgress size={40} thickness={4.5} />
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={800}>{ga(name)} 일하는 중이에요</Typography>
          <Typography variant="body2" color="text.secondary">
            {PHASES[currentIdx]?.busy ?? '에이전트를 시작하고 있어요'} · {sec}초 지남
          </Typography>
        </Box>
      </Stack>
      <LinearProgress sx={{ mt: 2, height: 6, borderRadius: '10px' }} />
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
        다른 화면으로 가도 계속 일해요. 끝나면 아래 목록이 저절로 바뀝니다.
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

const RISK_LABEL: Record<string, { label: string; color: string }> = {
  stockout: { label: '곧 떨어질 재료', color: '#E53935' },
  below_threshold: { label: '최소 재고보다 적음', color: '#E0803D' },
  awaiting_delivery: { label: '주문한 물건이 와야 충분', color: '#2F7DD1' },
  waste: { label: '너무 많아 버려질 수 있음', color: '#C2477E' },
  no_demand: { label: '당분간 쓸 일 없음', color: '#8A90A6' },
};
const verdictText = (it: any) => {
  if (it.verdict === 'reduce') return `줄였어요 (${it.planQty}→${it.orderQty}${it.unit})`;
  if (it.verdict === 'hold') return '이번엔 보류';
  return '계산대로';
};
const qty = (v: any, unit: string) => <>{v}<Box component="span" sx={{ color: 'text.secondary', fontSize: 12, ml: 0.2 }}>{unit}</Box></>;

/** 발주 참모(AG-1) 발주안: 위험 표시 + 재료별 표 + 주의 */
const OrderPlanView = ({ payload }: { payload: Record<string, any> }) => {
  const items: any[] = payload.items ?? [];
  const showPending = items.some((it) => Number(it.pendingQty) > 0);
  const notes = [...(payload.warnings ?? []), ...(payload.concerns ?? [])];
  return (
    <Stack gap={1.5} mt={1.5}>
      {payload.risks?.length > 0 && (
        <Stack direction="row" gap={0.6} flexWrap="wrap">
          {payload.risks.map((r: any, i: number) => {
            const rl = RISK_LABEL[r.risk] ?? { label: r.risk, color: '#8A90A6' };
            return <Pill key={i} color={rl.color} label={`${r.ingredientName} · ${rl.label}`} />;
          })}
        </Stack>
      )}
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflowX: 'auto' }}>
        <Table size="small" sx={{ '& th': { bgcolor: '#F6F8FB', fontWeight: 700, fontSize: 12.5, color: 'text.secondary', whiteSpace: 'nowrap' }, '& td': { fontSize: 13.5 } }}>
          <TableHead>
            <TableRow>
              <TableCell>재료</TableCell>
              <TableCell align="right">지금 재고</TableCell>
              <TableCell align="right">앞으로 필요한 양</TableCell>
              {showPending && <TableCell align="right">이미 주문해 오는 양</TableCell>}
              <TableCell align="right">주문할 양</TableCell>
              <TableCell>AI 의견</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.ingredientId}>
                <TableCell sx={{ fontWeight: 700 }}>{it.ingredientName}</TableCell>
                <TableCell align="right">{qty(it.currentStock, it.unit)}</TableCell>
                <TableCell align="right">{qty(it.requiredQty, it.unit)}</TableCell>
                {showPending && <TableCell align="right">{qty(it.pendingQty, it.unit)}</TableCell>}
                <TableCell align="right" sx={{ fontWeight: 900, color: 'primary.main' }}>{qty(it.orderQty, it.unit)}</TableCell>
                <TableCell title={it.reason} sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{verdictText(it)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {payload.held?.length > 0 && (
        <Typography fontSize={13} color="text.secondary">이번엔 주문하지 않는 재료: {payload.held.join(', ')}</Typography>
      )}
      {notes.length > 0 && (
        <Note color="#E0803D" icon="mingcute:warning-line" title="확인해 주세요">
          {notes.map((c: string) => `• ${c}`).join('\n')}
        </Note>
      )}
    </Stack>
  );
};

/** 기부 매칭(AG-3): 기관·수량 + 주의 + 점주가 직접 보낼 메시지 초안 */
const DonationView = ({ payload }: { payload: Record<string, any> }) => (
  <Stack gap={1.2} mt={1.5}>
    <Typography fontSize={14.5} fontWeight={800}>
      {payload.ingredientName} {payload.quantity}{payload.unit}을(를) {payload.orgName}에 기부해요
      <Box component="span" sx={{ ml: 1, fontSize: 12.5, fontWeight: 600, color: 'text.secondary' }}>유통기한 {payload.daysUntilExpiry}일 남음</Box>
    </Typography>
    {(payload.concerns ?? []).length > 0 && (
      <Note color="#E0803D" icon="mingcute:warning-line" title="확인해 주세요">
        {(payload.concerns as string[]).map((c) => `• ${c}`).join('\n')}
      </Note>
    )}
    <TextField label="기부처에 보낼 메시지 초안 (자동으로 보내지지 않아요. 복사해서 직접 보내세요)" value={payload.draftMessage ?? ''}
      size="small" fullWidth multiline minRows={3} InputProps={{ readOnly: true }} />
    <Box>
      <Button size="small" variant="outlined" startIcon={<IconifyIcon icon="mingcute:copy-2-line" width={15} />}
        onClick={() => navigator.clipboard.writeText(payload.draftMessage ?? '')}>
        메시지 복사
      </Button>
    </Box>
  </Stack>
);

const ProposalCard = ({ p, isHq, onApprove, onReject, onReplan, onRollback }: {
  p: AgentProposal; isHq: boolean; onApprove: () => void; onReject: () => void; onReplan: () => void; onRollback: () => void;
}) => {
  const [open, setOpen] = useState(false);
  // 모델 교체는 전사 운영 판단이라 본사만 승인한다 (서버도 막는다)
  const canDecide = p.type !== 'MODEL_PROMOTE' || isHq;
  const m = meta(p.agent);
  const st = statusOf(p.status);
  const hasDetail = p.type !== 'ORDER_CREATE' || !!p.execResult;
  return (
    <Paper elevation={0} sx={{ ...CARD, borderLeft: `4px solid ${p.status === 'PENDING' ? st.color : 'transparent'}` }}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <IconTile icon={m.icon} color={m.color} />
        <Box flex={1} minWidth={0}>
          <Typography fontWeight={800} fontSize={15.5}>{TYPE_LABEL[p.type] ?? p.type}</Typography>
          <Typography fontSize={12.5} color="text.secondary">
            {ga(m.name)} {timeAgo(p.createdAt)} 올림{isHq && ` · 매장 ${p.storeId}`}
          </Typography>
        </Box>
        <Pill label={st.label} color={st.color} />
      </Stack>

      <Typography fontSize={14} sx={{ mt: 1.5, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{p.rationale}</Typography>
      {p.type === 'ORDER_CREATE' && <OrderPlanView payload={p.payload} />}
      {p.type === 'DONATION_CREATE' && <DonationView payload={p.payload} />}

      <Collapse in={open}>
        {p.type !== 'ORDER_CREATE' && <Box mt={2}><PayloadView payload={p.payload} /></Box>}
        {p.execResult && (
          <Box mt={1.5}>
            <Typography fontSize={12} color="text.secondary">처리 결과 (원본 기록)</Typography>
            <DevBox value={p.execResult} />
          </Box>
        )}
      </Collapse>

      <Stack direction="row" alignItems="center" gap={1} mt={2} flexWrap="wrap">
        {hasDetail && (
          <Button size="small" color="inherit" onClick={() => setOpen(!open)}
            endIcon={<IconifyIcon icon={open ? 'mingcute:up-line' : 'mingcute:down-line'} width={15} />} sx={{ color: 'text.secondary' }}>
            {open ? '접기' : '자세히 보기'}
          </Button>
        )}
        {p.status === 'PENDING' && p.expiresAt && (
          <Typography fontSize={12} color="text.disabled">{dateTimeLabel(p.expiresAt)}까지 결정해 주세요</Typography>
        )}
        <Box flex={1} />
        {p.status === 'PENDING' && canDecide && (
          <>
            {!INFO_TYPES.has(p.type) && <Button size="small" variant="outlined" color="error" onClick={onReject}>거절</Button>}
            <Button size="small" variant="contained" onClick={onApprove}>{INFO_TYPES.has(p.type) ? '확인했어요' : '승인하고 실행'}</Button>
          </>
        )}
        {p.status === 'PENDING' && !canDecide && (
          <Typography variant="caption" color="text.secondary">본사가 결정하는 제안이에요</Typography>
        )}
        {p.type === 'MODEL_PROMOTE' && p.status === 'EXECUTED' && isHq && p.execResult?.archived && (
          <Button size="small" variant="outlined" color="warning" onClick={onRollback}>교체 되돌리기</Button>
        )}
        {p.status === 'STALE' && (
          <Button size="small" variant="contained" color="secondary" onClick={onReplan}>지금 상황으로 다시 만들기</Button>
        )}
      </Stack>
    </Paper>
  );
};

/** 실행 기록 한 건: 누가·언제·어떻게 시작해서·무엇을 했는지 */
const RunItem = ({ r, isHq, open, onToggle }: { r: AgentRun; isHq: boolean; open: boolean; onToggle: () => void }) => {
  const [dev, setDev] = useState(false);
  const m = meta(r.agent);
  const st = statusOf(r.status);
  const res = r.resultJson ?? {};
  const props: any[] = Array.isArray(res.proposals) ? res.proposals : [];
  const notis: any[] = Array.isArray(res.notifications) ? res.notifications : [];
  const summary: string | undefined = res.llm?.output?.summary;
  const done = ((res.progress ?? []) as { phase: string }[]).map((x) => x.phase);
  const outcome = r.status === 'RUNNING' ? '지금 일하는 중이에요'
    : r.status === 'FAILED' ? '도중에 문제가 생겨 끝내지 못했어요'
      : props.length ? `제안 ${props.length}건을 승인함에 올렸어요` : '살펴봤지만 새로 올릴 제안은 없었어요';
  const sec = r.finishedAt ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000) : null;
  return (
    <Paper elevation={0} sx={{ ...CARD, p: 0, overflow: 'hidden' }}>
      <Stack direction="row" alignItems="center" gap={1.5} onClick={onToggle}
        sx={{ p: { xs: 1.8, sm: 2.2 }, cursor: 'pointer', '&:hover': { bgcolor: alpha(m.color, 0.04) } }}>
        <IconTile icon={m.icon} color={m.color} />
        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap">
            <Typography fontWeight={800} fontSize={15}>{m.name}</Typography>
            <Typography fontSize={12.5} color="text.secondary">{PLAIN[r.agent]?.short}</Typography>
          </Stack>
          <Typography fontSize={13.5} mt={0.3} sx={{ color: r.status === 'FAILED' ? '#E53935' : 'text.primary' }}>
            {outcome}{notis.length > 0 && ` · 알림 ${notis.length}건`}
          </Typography>
          <Typography fontSize={12} color="text.disabled" mt={0.3}>
            {timeAgo(r.startedAt)} · {dateTimeLabel(r.startedAt)} · {TRIGGER[r.triggerType] ?? r.triggerType}
            {isHq && ` · ${r.storeId ? `매장 ${r.storeId}` : '전체 매장'}`}
          </Typography>
        </Box>
        <Stack alignItems="flex-end" gap={0.8}>
          <Pill label={st.label} color={st.color} />
          <IconifyIcon icon={open ? 'mingcute:up-line' : 'mingcute:down-line'} width={18} sx={{ color: 'text.disabled' }} />
        </Stack>
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Stack gap={1.5} sx={{ px: { xs: 1.8, sm: 2.2 }, pb: 2.2, pt: 0.5, borderTop: '1px dashed', borderColor: 'divider' }}>
          {PLAIN[r.agent] && <Typography fontSize={13} color="text.secondary" mt={1}>{PLAIN[r.agent].does}</Typography>}
          {summary && <Note color={m.color} icon="mingcute:sparkles-line" title="AI 요약">{summary}</Note>}
          {r.error && <Note color="#E53935" icon="mingcute:warning-line" title="무엇이 문제였나요">{r.error}</Note>}

          {done.length > 0 && (
            <Box>
              <Typography fontSize={12.5} fontWeight={700} color="text.secondary" mb={0.8}>진행 순서</Typography>
              <Stack direction="row" gap={0.6} flexWrap="wrap" alignItems="center">
                {PHASES.filter((ph) => done.includes(ph.key)).map((ph, i) => (
                  <Stack key={ph.key} direction="row" alignItems="center" gap={0.6}>
                    {i > 0 && <IconifyIcon icon="mingcute:right-line" width={14} sx={{ color: 'text.disabled' }} />}
                    <Stack direction="row" alignItems="center" gap={0.4} sx={{ px: 1, py: 0.3, borderRadius: 9, bgcolor: '#F6F8FB', fontSize: 12.5 }}>
                      <IconifyIcon icon="mingcute:check-line" width={13} sx={{ color: '#1D9E75' }} /> {ph.short}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {props.length > 0 && (
            <Box>
              <Typography fontSize={12.5} fontWeight={700} color="text.secondary" mb={0.8}>올린 제안</Typography>
              <Stack direction="row" gap={0.6} flexWrap="wrap">
                {props.map((x, i) => (
                  <Pill key={i} label={`${TYPE_LABEL[x.type] ?? x.type}${x.ok ? '' : ' (올리지 못함)'}`} color={x.ok ? '#2F7DD1' : '#E53935'} />
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <Button size="small" color="inherit" onClick={() => setDev(!dev)} sx={{ color: 'text.disabled', fontSize: 12, px: 0 }}
              startIcon={<IconifyIcon icon="mingcute:code-line" width={14} />}>
              {dev ? '개발자용 정보 숨기기' : '개발자용 정보 보기'}
            </Button>
            <Collapse in={dev} unmountOnExit>
              <Typography fontSize={12} color="text.secondary">
                실행 ID {r.runId} · 모델 {r.model ?? '-'} · 토큰 {r.inputTokens ?? '-'}/{r.outputTokens ?? '-'}{sec !== null && ` · ${sec}초 걸림`}
              </Typography>
              <DevBox value={r.resultJson} />
            </Collapse>
          </Box>
        </Stack>
      </Collapse>
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
  const [runLimit, setRunLimit] = useState(20);
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
      else setError(`승인했지만 실행되지 않았습니다 (${statusOf(r.status).label}): ${r.execResult?.error ?? ''}`);
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
    const name = meta(activeAgent).name;
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

  const pendingCount = proposals.filter((p) => p.status === 'PENDING').length;
  // ?replay 로 연 실행이 목록 밖이면 맨 위에 붙인다
  const runList = selectedRun && !runs.some((r) => r.runId === selectedRun.runId) ? [selectedRun, ...runs] : runs;

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.5}>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography fontSize={18} fontWeight={800}>AI가 올린 제안</Typography>
            <Pill label={`결정 기다리는 중 ${pendingCount}건`} color={pendingCount ? '#E0803D' : '#8A90A6'} />
            {agentFilter && (
              <Chip size="small" variant="outlined" onDelete={() => setSearchParams({})}
                label={`${agentFilter.split(',').map((a) => meta(a).name).join(', ')}만 보는 중`} />
            )}
          </Stack>
          <Typography fontSize={13.5} color="text.secondary" mt={0.5}>
            AI는 제안만 만들어요. 사장님이 승인해야 실제로 실행되고, 수량은 정해진 계산식으로 구합니다.
          </Typography>
        </Box>
        {!isHq && storeId && (
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="outlined" startIcon={runIcon('echo', 'mingcute:play-line')} disabled={!!active}
              onClick={() => handleRun('echo', storeId)}>
              재고 점검(테스트)
            </Button>
            <Button variant="contained" startIcon={runIcon('order_advisor', 'mingcute:refresh-2-line')} disabled={!!active}
              onClick={() => handleRun('order_advisor', storeId)}>
              {active?.agent === 'order_advisor' ? '발주안 만드는 중…' : '발주안 지금 만들기'}
            </Button>
            <Button variant="contained" color="secondary" startIcon={runIcon('waste', 'mingcute:delete-2-line')} disabled={!!active}
              onClick={() => handleRun('waste', storeId)}>
              폐기 위험 점검
            </Button>
          </Stack>
        )}
      </Stack>

      {active && <RunningBanner active={active} now={now} />}

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      <Paper elevation={0} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '10px' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2 }}>
          <Tab label={`결정할 일${pendingCount ? ` (${pendingCount})` : ''}`} />
          <Tab label="AI가 한 일 (실행 기록)" />
        </Tabs>
      </Paper>

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : tab === 0 ? (
        <Stack gap={2}>
          <Stack direction="row" justifyContent="flex-end">
            <Button size="small" onClick={() => setShowDone(!showDone)}>
              {showDone ? '결정할 일만 보기' : '이미 처리한 제안도 보기'}
            </Button>
          </Stack>
          {proposals.length === 0 ? (
            <Stack alignItems="center" gap={1} py={6}>
              <IconifyIcon icon="mingcute:check-circle-line" width={36} sx={{ color: 'primary.main' }} />
              <Typography fontWeight={800}>지금 결정할 일이 없어요</Typography>
              <Typography fontSize={13} color="text.secondary">AI가 새 제안을 올리면 여기에 나타나요.</Typography>
            </Stack>
          ) : proposals.map((p) => (
            <ProposalCard key={p.id} p={p} isHq={isHq}
              onApprove={() => handleApprove(p)}
              onReject={() => setRejectTarget(p)}
              onReplan={() => handleRun(p.agent, p.storeId)}
              onRollback={() => handleRollback(p)} />
          ))}
        </Stack>
      ) : (
        <Stack gap={1.5}>
          <Typography fontSize={13} color="text.secondary">최근 순으로 보여드려요. 눌러서 자세한 내용을 볼 수 있어요.</Typography>
          {runList.length === 0 ? (
            <Typography color="text.secondary" textAlign="center" py={6}>아직 실행 기록이 없어요.</Typography>
          ) : runList.slice(0, runLimit).map((r) => (
            <RunItem key={r.runId} r={r} isHq={isHq} open={selectedRun?.runId === r.runId}
              onToggle={() => setSelectedRun(selectedRun?.runId === r.runId ? null : r)} />
          ))}
          {runList.length > runLimit && (
            <Button onClick={() => setRunLimit(runLimit + 20)} sx={{ alignSelf: 'center' }}>
              더 보기 ({runList.length - runLimit}건 남음)
            </Button>
          )}
        </Stack>
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
