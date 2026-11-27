import { Box, Stack, Typography } from '@mui/material';
import { TOSS } from './TossUI';

// /inventory/{storeId}/lots 한 줄 (남은 입고 묶음)
export interface Lot { lotId: number; ingredientId: number; remainingQty: number; receivedAt: string; expiryDate: string | null }

const DAY = 86_400_000;
const dayOf = (s: string) => { const d = new Date(s); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const weekLabel = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}월 ${Math.ceil(d.getDate() / 7)}주차`; };
const md = (s: string) => { const d = new Date(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

// 남은 기간 비율 → 색 (넉넉 초록 · 절반 아래 주황 · 20% 아래 빨강)
const tone = (ratio: number | null) => ratio == null ? '#B0B8C1' : ratio > 0.5 ? TOSS.green : ratio > 0.2 ? '#F59F00' : TOSS.red;

// 유통기한까지 남은 기간 고리 (다 차 있으면 막 들어온 것, 비어 갈수록 기한이 가깝다)
const LifeRing = ({ ratio, size = 40 }: { ratio: number | null; size?: number }) => {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9EDF0" strokeWidth={4}
        strokeDasharray={ratio == null ? '3 3' : undefined} />
      {ratio != null && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(ratio)} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${c * Math.max(ratio, 0.02)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={800} fill={ratio == null ? '#B0B8C1' : tone(ratio)}>
        {ratio == null ? '-' : `${Math.round(ratio * 100)}%`}
      </text>
    </svg>
  );
};

// 식자재 타일에 마우스를 올리면 보이는 내용: 입고 주차별 남은 양 + 묶음마다 유통기한까지 남은 기간
const StockLots = ({ name, unit, lots }: { name: string; unit: string; lots: Lot[] }) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = (v: number) => `${unit === '개' ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;

  // 입고 주차·유통기한이 같은 묶음끼리 합친다 (먼저 들어온 것부터)
  const groups: { key: string; week: string; received: string; expiry: string | null; qty: number }[] = [];
  [...lots].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).forEach((l) => {
    const key = `${weekLabel(l.receivedAt)}|${l.expiryDate ?? ''}`;
    const g = groups.find((x) => x.key === key);
    if (g) g.qty += Number(l.remainingQty);
    else groups.push({ key, week: weekLabel(l.receivedAt), received: l.receivedAt, expiry: l.expiryDate, qty: Number(l.remainingQty) });
  });
  const rows = groups.map((g) => {
    if (!g.expiry) return { ...g, left: null as number | null, total: null as number | null, ratio: null as number | null };
    const total = Math.max(1, Math.round((dayOf(g.expiry) - dayOf(g.received)) / DAY));
    const left = Math.round((dayOf(g.expiry) - today.getTime()) / DAY);
    return { ...g, left, total, ratio: Math.min(1, Math.max(0, left / total)) };
  });
  const sum = rows.reduce((s, g) => s + g.qty, 0);

  return (
    <Box sx={{ width: 280, p: 0.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: TOSS.text }}>{name}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOSS.sub }}>{fmt(sum)} · {rows.length}묶음</Typography>
      </Stack>

      {rows.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: TOSS.sub, py: 1 }}>남아 있는 입고 기록이 없어요.</Typography>
      ) : (
        <>
          <Stack gap={0.5}>
            {rows.map((g) => (
              <Stack key={g.key} direction="row" alignItems="center" gap={1.25}
                sx={{ px: 1, py: 0.75, borderRadius: '12px', transition: 'background .15s', '&:hover': { bgcolor: '#F2F4F6' } }}>
                <LifeRing ratio={g.ratio} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOSS.text }}>{g.week} 입고 · {md(g.received)}</Typography>
                  <Typography sx={{ fontSize: 12, color: g.left != null && g.left <= 0 ? TOSS.red : TOSS.sub }}>
                    {g.left == null ? '유통기한 정보 없음'
                      : g.left < 0 ? `기한 ${-g.left}일 지남 (${md(g.expiry!)})`
                      : g.left === 0 ? `오늘까지 (${md(g.expiry!)})`
                      : `${g.left}일 남음 / ${g.total}일 · ${md(g.expiry!)}까지`}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: TOSS.text }}>{fmt(g.qty)}</Typography>
              </Stack>
            ))}
          </Stack>
        </>
      )}
    </Box>
  );
};

export default StockLots;
