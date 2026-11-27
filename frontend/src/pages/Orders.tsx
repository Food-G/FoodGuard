import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Stack, Typography, useMediaQuery } from '@mui/material';
import { orderService } from '../services/orderService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';
import { TOSS, TossPage, TwoColumn, SidePanel, PanelTitle, BigStat, EmptyState, tossButtonSx } from '../components/TossUI';

// 단계별로 묶어 보여 준다 (점주가 할 일이 있는 단계부터). 행마다 단계 그림을 그리지 않는다
const GROUPS = [
  { key: 'INSPECT', title: '검수 대기', hint: '도착했어요. 검수하면 재고에 들어가요.', color: TOSS.green, statuses: ['DRIVER_RECEIVED'] },
  { key: 'SHIPPING', title: '배송 중', hint: '본사가 승인하고 보내는 중이에요.', color: '#2F7DD1', statuses: ['APPROVED', 'HQ_SENT'] },
  { key: 'WAITING', title: '승인 대기', hint: '본사 승인 전이라 취소할 수 있어요.', color: '#F59F00', statuses: ['REQUESTED'] },
];

// 발주 단계 (고리의 칸). 지금 단계 = 이미 지난 칸 수
const STEPS = ['요청', '승인', '발송', '기사 수령', '입고'];
const STEP_OF: Record<string, number> = { REQUESTED: 1, APPROVED: 2, HQ_SENT: 3, DRIVER_RECEIVED: 4, DONE: 5 };
const WAITING_FOR: Record<string, string> = { REQUESTED: '승인 대기', APPROVED: '발송 대기', HQ_SENT: '기사 수령 대기', DRIVER_RECEIVED: '검수 대기' };

// "3시간째", "2일째" (마지막 단계가 지난 뒤 얼마나 기다렸는지)
const elapsed = (from: Date | null) => {
  if (!from) return '';
  const min = Math.max(0, Math.floor((Date.now() - from.getTime()) / 60000));
  if (min < 60) return `${min}분째`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간째`;
  return `${Math.floor(min / 1440)}일째`;
};
const fmt = (d: Date | null) => (d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');

// 칸으로 나뉜 고리: 지난 단계는 진하게, 지금 기다리는 칸은 옅게, 남은 칸은 회색
// 칸으로 나뉜 고리. 칸에 마우스를 올리거나(휴대폰은 누르면) 그 칸이 굵어지고, 옆 글자가 그 단계 이름·시각으로 바뀐다
const StepRing = ({ done, color, track, hovered, onHover, size = 56 }: {
  done: number; color: string; track: string; hovered: number | null; onHover: (i: number | null) => void; size?: number;
}) => {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const gap = 6;
  const seg = c / STEPS.length - gap;
  const dash = (i: number) => ({ strokeDasharray: `${seg} ${c - seg}`, strokeDashoffset: -(i * (c / STEPS.length)) - gap / 2 });
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }} onMouseLeave={() => onHover(null)}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }} role="img"
        aria-label={STEPS.map((st, i) => `${i + 1} ${st}${i < done ? ' 완료' : ''}`).join(', ')}>
        {STEPS.map((step, i) => (
          <circle key={step} cx={size / 2} cy={size / 2} r={r} fill="none" strokeLinecap="round"
            strokeWidth={hovered === i ? 9 : 6}
            stroke={i < done ? color : i === done ? `${color}66` : track}
            opacity={hovered === null || hovered === i ? 1 : 0.45}
            style={{ transition: 'stroke-width .15s, opacity .15s', pointerEvents: 'none' }}
            {...dash(i)} />
        ))}
        {/* 칸이 얇아 맞히기 어려우니, 보이지 않는 두꺼운 칸으로 마우스·터치를 받는다 */}
        {STEPS.map((step, i) => (
          <circle key={`hit-${step}`} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={16} stroke="transparent"
            style={{ cursor: 'pointer', pointerEvents: 'stroke' }} {...dash(i)}
            onMouseEnter={() => onHover(i)} onClick={(e) => { e.stopPropagation(); onHover(hovered === i ? null : i); }} />
        ))}
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 800, color }}>{hovered === null ? `${done}/${STEPS.length}` : hovered + 1}</Typography>
      </Box>
    </Box>
  );
};

// 타일 머리줄: 고리 + 지금 단계(기본) 또는 가리킨 단계의 이름·시각
const RingHeader = ({ done, times, status, color, solid, demo = null, touch }: {
  done: number; times: (Date | null)[]; status: string; color: string; solid: boolean; demo?: number | null; touch: boolean;
}) => {
  const [pointed, setPointed] = useState<number | null>(null);
  const hovered = demo ?? pointed;
  const ringColor = solid ? '#FFFFFF' : color;
  const sub = solid ? 'rgba(255,255,255,0.85)' : TOSS.sub;
  const stateOf = (i: number) => (i < done ? `${fmt(times[i]) || ''} 완료`.trim() : i === done ? '지금 기다리는 중' : '아직');
  return (
    <Stack direction="row" alignItems="center" gap={1.25}>
      {/* ring-wrap: 타일에 마우스가 들어오면 살짝 커진다 (가리킬 수 있다는 신호) */}
      <Box className="ring-wrap" sx={{ transition: 'transform .2s', transformOrigin: 'center' }}>
        <StepRing done={done} color={ringColor} track={solid ? 'rgba(255,255,255,0.25)' : 'rgba(15,30,50,0.1)'}
          hovered={hovered} onHover={setPointed} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        {hovered === null ? (
          <>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: ringColor }}>{WAITING_FOR[status]}</Typography>
            <Typography sx={{ fontSize: 12, color: sub }}>{elapsed(times[done - 1])}</Typography>
            <Typography className="ring-hint" sx={{ fontSize: 11, fontWeight: 600, color: sub, opacity: 0, height: 0, overflow: 'hidden', transition: 'opacity .2s' }}>
              {touch ? '칸을 눌러 보세요' : '칸을 가리켜 보세요'}
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: ringColor }}>{hovered + 1}. {STEPS[hovered]}</Typography>
            <Typography sx={{ fontSize: 12, color: sub }}>{stateOf(hovered)}</Typography>
          </>
        )}
      </Box>
    </Stack>
  );
};

const COACH_KEY = 'foodguard.orderRingCoachSeen';
const coachSeen = () => { try { return localStorage.getItem(COACH_KEY) === '1'; } catch { return true; } };

const Orders = ({ user }: any) => {
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recommend, setRecommend] = useState<any[] | null>(null);
  const touch = useMediaQuery('(hover: none)');
  const [coach, setCoach] = useState(false);
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    if (!loading && rows.length > 0 && !coachSeen()) setCoach(true);
  }, [loading, rows.length]);
  useEffect(() => {
    if (!coach) return;
    const t = setInterval(() => setDemoStep((i) => (i + 1) % STEPS.length), 900);
    return () => clearInterval(t);
  }, [coach]);
  const closeCoach = () => {
    setCoach(false);
    try { localStorage.setItem(COACH_KEY, '1'); } catch { /* 저장이 막힌 브라우저면 다음에 다시 보인다 */ }
  };

  const loadOrders = async (sid: number) => {
    try {
      const orders = await orderService.getByStore(sid);
      const hiddenStatuses = new Set(['DONE', 'CANCELLED', 'REJECTED']);
      setRows((orders ?? []).filter((item: any) => !hiddenStatuses.has(item.status)).map((item: any) => ({
        id: item.id,
        name: item.ingredient?.name ?? '-',
        quantity: item.orderedQty ?? item.quantity,
        unit: item.ingredient?.unit ?? '',
        status: item.status,
        orderedAt: item.orderedAt ? new Date(item.orderedAt) : null,
        // 단계마다 일어난 시각 (요청·승인·발송·기사 수령). 없으면 아직 안 지난 단계
        times: [item.orderedAt, item.approvedAt, item.hqSentAt, item.driverReceivedAt].map((t: string | null) => (t ? new Date(t) : null)),
      })));
    } catch {
      setError('발주 내역을 불러오지 못했습니다.');
    }
  };

  const loadRecommend = (sid: number) =>
    orderService.recommend(sid).then((r: any[]) => setRecommend(r ?? [])).catch(() => setRecommend([]));

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    loadOrders(storeId).finally(() => setLoading(false));
    loadRecommend(storeId);
    const timer = setInterval(() => loadOrders(storeId), 5000);
    return () => clearInterval(timer);
  }, [storeId, storeLoading]);

  const handleCancel = async (id: number) => {
    if (!await confirm('발주를 취소하시겠습니까?')) return;
    try {
      await orderService.cancel(id);
      setSuccess('발주가 취소되었습니다.');
      if (storeId) { await loadOrders(storeId); loadRecommend(storeId); }
    } catch {
      setError('취소에 실패했습니다.');
    }
  };

  // 기사에게 받은 발주를 검수하면 입고되어 재고에 더해진다
  const handleReceive = async (id: number) => {
    if (!await confirm('입고를 확인하고 재고에 반영하시겠습니까?')) return;
    try {
      await orderService.updateStatus(id, 'DONE');
      setSuccess('검수 완료. 재고에 반영되었습니다.');
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('검수 처리에 실패했습니다.');
    }
  };

  const handleAutoOrder = async () => {
    if (!storeId) return;
    setOrdering(true);
    setError('');
    setSuccess('');
    try {
      const result = await orderService.autoOrder(storeId);
      const count = Array.isArray(result) ? result.length : 0;
      if (count === 0) {
        setSuccess('현재 재고가 충분하여 발주가 필요한 식자재가 없습니다.');
      } else {
        setSuccess(`${count}건 발주가 등록되었습니다.`);
        await loadOrders(storeId);
        loadRecommend(storeId);
      }
    } catch (e: any) {
      setError(e?.message || '자동 발주 등록에 실패했습니다.');
    } finally {
      setOrdering(false);
    }
  };

  const inGroup = (g: typeof GROUPS[number]) => rows
    .filter((r) => g.statuses.includes(r.status))
    .sort((a, b) => (b.orderedAt?.getTime() ?? 0) - (a.orderedAt?.getTime() ?? 0));
  const inspect = inGroup(GROUPS[0]).length;
  // 시연할 첫 타일 (화면에서 맨 앞에 나오는 발주)
  const firstId = GROUPS.map(inGroup).find((l) => l.length > 0)?.[0]?.id;

  const side = (
    <SidePanel>
      <BigStat label="진행 중인 발주" value={loading ? '…' : `${rows.length}건`} />
      <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
        {loading ? '' : inspect > 0 ? `검수할 발주가 ${inspect}건 있어요.` : '검수할 발주는 없어요.'}
      </Typography>

      <PanelTitle>AI 추천 발주</PanelTitle>
      {recommend === null ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
      ) : recommend.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: TOSS.sub, py: 0.5 }}>지금은 더 주문할 식자재가 없어요.</Typography>
      ) : (
        <Box>
          {recommend.slice(0, 5).map((r) => (
            <Stack key={r.ingredientId} direction="row" justifyContent="space-between" sx={{ py: 0.75 }}>
              <Typography noWrap sx={{ fontSize: 15, color: TOSS.text }}>{r.ingredientName}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: TOSS.text, flexShrink: 0, ml: 1 }}>{r.orderQty}{r.unit}</Typography>
            </Stack>
          ))}
          {recommend.length > 5 && <Typography sx={{ fontSize: 13, color: TOSS.sub }}>외 {recommend.length - 5}개</Typography>}
        </Box>
      )}
      <Button fullWidth variant="contained" onClick={handleAutoOrder} disabled={ordering || !recommend?.length}
        startIcon={ordering ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="mingcute:sparkles-line" />}
        sx={{ ...tossButtonSx, py: 1.2, fontSize: 15, mt: 2 }}>
        {ordering ? '발주 등록 중…' : '추천대로 발주하기'}
      </Button>
    </SidePanel>
  );

  const main = (
    <Box>
      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : rows.length === 0 ? (
        <EmptyState icon="mingcute:inbox-line" title="진행 중인 발주가 없어요"
          desc="오른쪽 AI 추천을 확인하고 필요한 식자재를 주문해 보세요." />
      ) : (
      <>
      {GROUPS.map((g) => {
        const list = inGroup(g);
        if (list.length === 0) return null;
        return (
          <Box key={g.key} sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="baseline" gap={1}>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: TOSS.text }}>{g.title}</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: g.color }}>{list.length}</Typography>
            </Stack>
            <Typography sx={{ fontSize: 13, color: TOSS.sub, mb: 1.25 }}>{g.hint}</Typography>
            {/* 발주 한 건 = 타일 하나 (판매 입력의 메뉴 타일처럼). 이름·수량을 크게, 할 일은 아래 버튼 하나 */}
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
              {list.map((r) => (
                (() => {
                  const done = STEP_OF[r.status] ?? 1;
                  // 검수 대기: 할 일이 있어 초록으로 꽉 채운다 / 배송 중: 옅은 파랑 / 승인 대기: 시작 전이라 회색 + 점선
                  const solid = g.key === 'INSPECT';
                  const ink = solid ? '#FFFFFF' : TOSS.text;
                  const sub = solid ? 'rgba(255,255,255,0.85)' : TOSS.sub;
                  return (
                    <Box key={r.id} sx={{
                      position: 'relative',
                      '&:hover .ring-wrap': { transform: 'scale(1.08)' },
                      '&:hover .ring-hint': { opacity: 1, height: 'auto' },
                      display: 'flex', flexDirection: 'column', borderRadius: '18px', p: 1.75, minHeight: 214,
                      background: solid ? 'linear-gradient(150deg, #27B88B, #1D9E75 55%, #178A66)'
                        : g.key === 'SHIPPING' ? `linear-gradient(160deg, ${g.color}1F, ${g.color}08)` : 'rgba(15,30,50,0.025)',
                      border: g.key === 'WAITING' ? `1.5px dashed ${g.color}99` : '1.5px solid transparent',
                      boxShadow: solid ? '0 10px 24px rgba(29,158,117,0.28)' : 'none',
                    }}>
                      <RingHeader done={done} times={r.times} status={r.status} color={g.color} solid={solid}
                        touch={touch} demo={coach && r.id === firstId ? demoStep : null} />
                      {coach && r.id === firstId && (
                        <Box role="dialog" aria-label="고리 사용법" sx={{
                          position: 'absolute', top: 78, left: 8, zIndex: 5, width: 230, p: 1.75, borderRadius: '14px',
                          bgcolor: '#191F28', color: '#FFFFFF', boxShadow: '0 12px 30px rgba(15,30,50,0.3)',
                          '&::before': { content: '""', position: 'absolute', top: -6, left: 26, width: 12, height: 12, bgcolor: '#191F28', transform: 'rotate(45deg)' },
                        }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 800 }}>고리의 칸이 발주 단계예요</Typography>
                          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', mt: 0.5, lineHeight: 1.5 }}>
                            {touch ? '칸을 누르면' : '칸에 마우스를 올리면'} 요청·승인·발송·기사 수령·입고 시각이 보여요.
                          </Typography>
                          <Button size="small" onClick={closeCoach}
                            sx={{ mt: 1.25, borderRadius: '10px', px: 1.5, fontWeight: 800, bgcolor: '#FFFFFF', color: TOSS.text, '&:hover': { bgcolor: '#F2F4F6' } }}>
                            알겠어요
                          </Button>
                        </Box>
                      )}
                      <Typography noWrap sx={{ fontSize: 15, fontWeight: 700, color: ink, mt: 1.5 }}>{r.name}</Typography>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, color: ink, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                        {r.quantity}<Box component="span" sx={{ fontSize: 15, fontWeight: 700, color: sub, ml: 0.25 }}>{r.unit}</Box>
                      </Typography>
                      {/* 지난 단계 시각: 처음(요청)과 마지막 단계만 */}
                      <Typography sx={{ fontSize: 12, color: sub, mt: 0.5 }}>요청 {fmt(r.times[0] ?? r.orderedAt)}</Typography>
                      {done > 1 && r.times[done - 1] && (
                        <Typography sx={{ fontSize: 12, color: sub }}>{STEPS[done - 1]} {fmt(r.times[done - 1])}</Typography>
                      )}
                      <Box sx={{ mt: 'auto', pt: 1.5 }}>
                        {r.status === 'DRIVER_RECEIVED' ? (
                          <Button fullWidth onClick={() => handleReceive(r.id)}
                            startIcon={<IconifyIcon icon="mingcute:check-line" width={16} />}
                            sx={{ borderRadius: '12px', py: 0.8, fontSize: 14, fontWeight: 800, bgcolor: '#FFFFFF', color: TOSS.green, '&:hover': { bgcolor: '#F1FBF7' } }}>
                            검수하기
                          </Button>
                        ) : r.status === 'REQUESTED' ? (
                          <Button fullWidth onClick={() => handleCancel(r.id)}
                            sx={{ borderRadius: '12px', py: 0.8, fontSize: 14, fontWeight: 700, bgcolor: '#FFFFFF', color: TOSS.sub, '&:hover': { bgcolor: '#FFF0F1', color: TOSS.red } }}>
                            발주 취소
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: TOSS.sub, textAlign: 'center', py: 0.9 }}>도착하면 검수할 수 있어요</Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })()
              ))}
            </Box>
          </Box>
        );
      })}
      </>
      )}
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />
    </TossPage>
  );
};

export default Orders;
