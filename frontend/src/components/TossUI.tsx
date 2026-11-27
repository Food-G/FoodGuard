// 매출·나눔 화면(판매 입력·판매 내역·폐기 예측 & 기부·기부 이력)이 같이 쓰는 부품.
// 상자를 쓰지 않는다: 글씨는 배경 위에 바로 두고, 구획은 여백·은은한 그라데이션 빛·반투명(유리) 면·양끝이 사라지는 선으로 나눈다.
import { ReactNode } from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { TOPBAR_HEIGHT } from '../layouts/main-layout/Topbar/Topbar';

export const TOSS = {
  bg: 'rgba(15, 30, 50, 0.045)',        // 입력칸·보조 버튼의 반투명 면
  card: 'rgba(255, 255, 255, 0.82)',    // 유리 면 (선택된 알약·고정 머리줄)
  text: '#191F28',
  sub: '#8B95A1',
  line: 'rgba(15, 30, 50, 0.08)',
  red: '#F04452',
  green: '#1D9E75',
  radius: '20px',
};

// 양끝이 투명하게 사라지는 구분선
const hairline = `linear-gradient(90deg, transparent, ${TOSS.line} 18%, ${TOSS.line} 82%, transparent)`;

// 페이지: 바탕 상자 없이 가운데 한 줄. 구획 사이에 넉넉한 여백 + 사라지는 선
export const TossPage = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
  <Stack sx={{
    // wide: 두 칸 배치 화면 (판매 입력). 넓은 화면에서 양옆이 비지 않게
    maxWidth: wide ? 1200 : 720, mx: 'auto', width: 1,
    '& > .toss-section + .toss-section': { mt: 2, pt: 4, backgroundImage: hairline, backgroundSize: '100% 1px', backgroundRepeat: 'no-repeat', backgroundPosition: 'top' },
  }}>
    {children}
  </Stack>
);

// 구획: 상자 없음. glow 를 주면 뒤에 그 색의 빛이 은은하게 번진다 (핵심 숫자 강조)
export const TossCard = ({ title, right, children, glow }: { title?: string; right?: ReactNode; children: ReactNode; pad?: number; glow?: string }) => (
  <Box className="toss-section" sx={{ position: 'relative', py: 1 }}>
    {glow && (
      <Box aria-hidden sx={{
        position: 'absolute', inset: { xs: '-24px -16px', sm: '-40px -48px' }, zIndex: 0, pointerEvents: 'none',
        // 빛의 가장자리가 상자 경계에 닿기 전에 완전히 사라지게 (직선 테두리가 보이지 않도록)
        background: `radial-gradient(closest-side at 16% 50%, ${glow}2E 0%, ${glow}12 45%, transparent 100%)`,
      }} />
    )}
    <Box sx={{ position: 'relative', zIndex: 1 }}>
      {(title || right) && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          {title && <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, letterSpacing: '-0.02em' }}>{title}</Typography>}
          {right}
        </Stack>
      )}
      {children}
    </Box>
  </Box>
);

// 작은 회색 설명 + 큰 숫자
export const BigStat = ({ label, value, color }: { label: string; value: ReactNode; color?: string }) => (
  <Box>
    <Typography sx={{ fontSize: 14, color: TOSS.sub, mb: 0.5 }}>{label}</Typography>
    <Typography sx={{ fontSize: { xs: 30, sm: 36 }, fontWeight: 800, color: color ?? TOSS.text, letterSpacing: '-0.03em', lineHeight: 1.15 }}>{value}</Typography>
  </Box>
);

// 반투명 알약 안에서 하나를 고르는 선택. 고른 것만 유리처럼 떠 보인다
export const Segmented = <T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T | ''; onChange: (v: T) => void;
}) => (
  <Stack direction="row" sx={{ bgcolor: TOSS.bg, backdropFilter: 'blur(8px)', borderRadius: '14px', p: 0.5, gap: 0.5, overflowX: 'auto' }}>
    {options.map((o) => {
      const on = o.value === value;
      return (
        <ButtonBase key={o.value} onClick={() => onChange(o.value)}
          sx={{
            flex: 1, minWidth: 56, py: 1, px: 1.25, borderRadius: '10px', fontSize: 14, whiteSpace: 'nowrap', transition: 'all .2s',
            fontWeight: on ? 700 : 500, color: on ? TOSS.text : TOSS.sub,
            bgcolor: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 2px 10px rgba(15,30,50,0.08)' : 'none',
          }}>
          {o.label}
        </ButtonBase>
      );
    })}
  </Stack>
);

// 스크롤해도 위에 붙어 있는 반투명 머리줄 (아래 내용이 흐리게 비친다)
export const StickyHeader = ({ left, right }: { left: ReactNode; right?: ReactNode }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="center"
    sx={{
      position: 'sticky', top: TOPBAR_HEIGHT, zIndex: 2, mx: -1.5, px: 1.5, py: 1,
      bgcolor: TOSS.card, backdropFilter: 'saturate(180%) blur(14px)',
      maskImage: 'linear-gradient(180deg, #000 85%, transparent)',
    }}>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TOSS.sub }}>{left}</Typography>
    {right && <Typography sx={{ fontSize: 14, fontWeight: 600, color: TOSS.sub }}>{right}</Typography>}
  </Stack>
);

// 목록 한 줄: 반투명 동그라미 아이콘 · 제목/설명 · 오른쪽 값. 마우스를 올리면 옅은 면이 생긴다
export const ListRow = ({ icon, iconColor, title, desc, right, rightSub, onClick, selected }: {
  icon: string; iconColor: string; title: ReactNode; desc?: ReactNode; right?: ReactNode; rightSub?: ReactNode; onClick?: () => void; selected?: boolean;
}) => (
  <Stack direction="row" alignItems="center" gap={1.75} onClick={onClick}
    sx={{
      py: 1.5, px: 1.5, mx: -1.5, borderRadius: '16px', cursor: onClick ? 'pointer' : 'default', transition: 'background .2s',
      background: selected ? `linear-gradient(90deg, ${iconColor}1F, ${iconColor}08 70%, transparent)` : 'transparent',
      '&:hover': { background: selected ? undefined : `linear-gradient(90deg, ${TOSS.bg}, transparent 85%)` },
    }}>
    <Box sx={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(circle at 30% 30%, ${iconColor}33, ${iconColor}12)` }}>
      <IconifyIcon icon={icon} color={iconColor} width={20} />
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography noWrap sx={{ fontSize: 16, fontWeight: 600, color: TOSS.text }}>{title}</Typography>
      {desc && <Typography noWrap sx={{ fontSize: 13, color: TOSS.sub, mt: 0.25 }}>{desc}</Typography>}
    </Box>
    {(right || rightSub) && (
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        {right && <Typography component="div" sx={{ fontSize: 16, fontWeight: 700, color: TOSS.text }}>{right}</Typography>}
        {rightSub && <Typography component="div" sx={{ fontSize: 13, color: TOSS.sub, mt: 0.25 }}>{rightSub}</Typography>}
      </Box>
    )}
  </Stack>
);

// 비었을 때: 빛나는 동그라미 아이콘 + 한 줄 + 다음 할 일
export const EmptyState = ({ icon, title, desc, action }: { icon: string; title: string; desc?: string; action?: ReactNode }) => (
  <Stack alignItems="center" gap={1} sx={{ py: 6, textAlign: 'center' }}>
    <Box sx={{ width: 64, height: 64, borderRadius: '50%', mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `radial-gradient(circle, ${TOSS.green}1F 0%, ${TOSS.green}08 60%, transparent 72%)` }}>
      <IconifyIcon icon={icon} color={TOSS.green} width={28} />
    </Box>
    <Typography sx={{ fontSize: 17, fontWeight: 700, color: TOSS.text }}>{title}</Typography>
    {desc && <Typography sx={{ fontSize: 14, color: TOSS.sub, maxWidth: 360 }}>{desc}</Typography>}
    {action && <Box mt={1.5}>{action}</Box>}
  </Stack>
);

// 큰 둥근 버튼. 주 버튼은 초록 그라데이션
export const tossButtonSx = {
  borderRadius: '14px', py: 1.6, fontSize: 16, fontWeight: 700, boxShadow: 'none',
  backgroundImage: 'linear-gradient(135deg, #22B286, #1D9E75 55%, #178A66)',
  '&:hover': { boxShadow: '0 8px 20px rgba(29,158,117,0.25)' },
  '&.Mui-disabled': { backgroundImage: 'none' },
};

// 보조 버튼 (반투명 회색 면)
export const tossSubButtonSx = {
  ...tossButtonSx, backgroundImage: 'none', bgcolor: TOSS.bg, color: TOSS.text,
  '&:hover': { bgcolor: 'rgba(15, 30, 50, 0.08)', boxShadow: 'none' },
};

// ── 넓은 화면 두 칸 배치 (왼쪽 목록 · 오른쪽 따라오는 요약). 좁은 화면에서는 요약이 위로 ──
export const TwoColumn = ({ main, side }: { main: ReactNode; side: ReactNode }) => (
  <Box sx={{ display: 'grid', gap: { xs: 3, md: 5 }, alignItems: 'start',
    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px', lg: 'minmax(0, 1fr) 380px' } }}>
    <Box sx={{ order: { xs: 2, md: 1 }, minWidth: 0 }}>{main}</Box>
    <Box sx={{ order: { xs: 1, md: 2 }, position: { md: 'sticky' }, top: { md: 140 }, minWidth: 0 }}>{side}</Box>
  </Box>
);

// 반투명 유리 패널 (요약·필터). glow 색이 왼쪽 위에서 은은하게 번진다
export const SidePanel = ({ children, glow = TOSS.green }: { children: ReactNode; glow?: string }) => (
  <Box sx={{ borderRadius: '24px', p: { xs: 2.5, md: 3 },
    background: `linear-gradient(165deg, rgba(255,255,255,0.92), rgba(242,244,246,0.78)), radial-gradient(circle at 0% 0%, ${glow}24, transparent 60%)`,
    backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(15,30,50,0.06)' }}>
    {children}
  </Box>
);

export const PanelTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <Stack direction="row" justifyContent="space-between" alignItems="baseline" mt={3} mb={1}>
    <Typography sx={{ fontSize: 15, fontWeight: 800, color: TOSS.text }}>{children}</Typography>
    {right && <Typography sx={{ fontSize: 13, color: TOSS.sub }}>{right}</Typography>}
  </Stack>
);

// 이름 · 값 · 비율 막대 한 줄
export const BarRow = ({ label, value, ratio, color = TOSS.green }: { label: ReactNode; value: ReactNode; ratio: number; color?: string }) => (
  <Box sx={{ py: 0.75 }}>
    <Stack direction="row" justifyContent="space-between" mb={0.5}>
      <Typography noWrap sx={{ fontSize: 14, color: TOSS.text, fontWeight: 600, pr: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, color: TOSS.text, fontWeight: 700, flexShrink: 0 }}>{value}</Typography>
    </Stack>
    <Box sx={{ height: 6, borderRadius: 3, bgcolor: TOSS.bg, overflow: 'hidden' }}>
      <Box sx={{ height: 1, width: `${Math.max(2, Math.min(100, ratio * 100))}%`, borderRadius: 3,
        background: `linear-gradient(90deg, ${color}99, ${color})`, transition: 'width .4s' }} />
    </Box>
  </Box>
);

// 작은 막대 추이 (날짜별 값). 가장 큰 값을 진하게
export const MiniBars = ({ values, labels, color = TOSS.green, height = 72 }: { values: number[]; labels?: string[]; color?: string; height?: number }) => {
  const max = Math.max(1, ...values);
  return (
    <Box>
      <Stack direction="row" alignItems="flex-end" gap="3px" sx={{ height }}>
        {values.map((v, i) => (
          <Box key={i} title={labels?.[i] ? `${labels[i]} · ${v.toLocaleString()}` : undefined}
            sx={{ flex: 1, minWidth: 2, height: `${Math.max(4, (v / max) * 100)}%`, borderRadius: '4px 4px 2px 2px',
              background: v === max ? color : `${color}55` }} />
        ))}
      </Stack>
      {labels && labels.length > 1 && (
        <Stack direction="row" justifyContent="space-between" mt={0.5}>
          <Typography sx={{ fontSize: 12, color: TOSS.sub }}>{labels[0]}</Typography>
          <Typography sx={{ fontSize: 12, color: TOSS.sub }}>{labels[labels.length - 1]}</Typography>
        </Stack>
      )}
    </Box>
  );
};

// 여러 부분으로 나눈 가로 막대 (긴급도 비율 등)
export const StackedBar = ({ parts }: { parts: { value: number; color: string; label: string }[] }) => {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <Box>
      <Stack direction="row" sx={{ height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: TOSS.bg }}>
        {parts.filter((p) => p.value > 0).map((p) => <Box key={p.label} sx={{ width: `${(p.value / total) * 100}%`, bgcolor: p.color }} />)}
      </Stack>
      <Stack direction="row" gap={2} mt={1} flexWrap="wrap">
        {parts.map((p) => (
          <Stack key={p.label} direction="row" alignItems="center" gap={0.75}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p.color }} />
            <Typography sx={{ fontSize: 13, color: TOSS.sub }}>{p.label} <b style={{ color: TOSS.text }}>{p.value}</b></Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};
