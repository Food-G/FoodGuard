import { Box, Typography, alpha, keyframes } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';

// 메인 히어로·로그인 화면용 움직이는 일러스트 (회전하는 궤도 + 식자재 아이콘 + 떠다니는 데이터 칩 + 그려지는 예측선)
const spin = keyframes`to { transform: rotate(360deg) }`;
const unspin = keyframes`to { transform: rotate(-360deg) }`;
const bob = keyframes`0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) }`;
const pulse = keyframes`0% { transform: scale(.85); opacity: .7 } 100% { transform: scale(1.6); opacity: 0 }`;
const draw = keyframes`0% { stroke-dashoffset: 400 } 60%,100% { stroke-dashoffset: 0 }`;

const ORBITS = [
  { size: 92, dur: 38, icons: ['mdi:carrot', 'mdi:fish', 'mdi:bread-slice', 'mdi:cheese'] },
  { size: 64, dur: 26, icons: ['mdi:leaf', 'mdi:food-apple', 'mdi:egg'] },
];

const CHIPS = [
  { top: '8%', left: '-4%', icon: 'mingcute:brain-fill', label: '수요 예측', value: '내일 판매량', delay: 0 },
  { top: '70%', left: '-8%', icon: 'mingcute:delete-2-line', label: '폐기 위험', value: '미리 감지', delay: 1.2 },
  { top: '78%', left: '68%', icon: 'mingcute:heart-line', label: '기부 매칭', value: '이웃과 나눔', delay: 2.1 },
];

// tone: dark = 어두운 배경 위(흰 선), light = 밝은 파스텔 배경 위(초록 선·흰 카드)
const EcoScene = ({ chips = true, tone = 'dark' }: { chips?: boolean; tone?: 'dark' | 'light' }) => {
  const light = tone === 'light';
  return (

  <Box sx={{ position: 'relative', width: 1, aspectRatio: '1 / 1', userSelect: 'none', pointerEvents: 'none' }}>
    {/* 궤도와 아이콘: 궤도는 돌고 아이콘은 반대로 돌아 똑바로 선다 */}
    {ORBITS.map((o, oi) => (
      <Box key={oi} sx={{
        position: 'absolute', width: `${o.size}%`, height: `${o.size}%`, top: `${(100 - o.size) / 2}%`, left: `${(100 - o.size) / 2}%`,
        borderRadius: '50%', border: `1.5px dashed ${light ? alpha('#1D9E75', 0.35) : alpha('#fff', 0.28)}`,
        animation: `${spin} ${o.dur}s linear infinite${oi ? ' reverse' : ''}`,
      }}>
        {o.icons.map((icon, i) => {
          const a = (i / o.icons.length) * Math.PI * 2;
          return (
            <Box key={icon} sx={{
              position: 'absolute', left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%`,
              width: '13%', aspectRatio: '1 / 1', ml: '-6.5%', mt: '-6.5%',
            }}>
              <Box sx={{
                width: 1, height: 1, borderRadius: '30%', bgcolor: alpha('#fff', 0.95), color: '#1D9E75',
                display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: light ? '0 8px 20px rgba(40,60,120,.14)' : '0 10px 24px rgba(0,0,0,.18)',
                animation: `${unspin} ${o.dur}s linear infinite${oi ? ' reverse' : ''}`,
              }}>
                <IconifyIcon icon={icon} width="55%" height="55%" />
              </Box>
            </Box>
          );
        })}
      </Box>
    ))}

    {/* 중심: 맥박치는 AI 코어 */}
    <Box sx={{ position: 'absolute', inset: '34%' }}>
      {[0, 1.2].map((d) => (
        <Box key={d} sx={{
          position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${light ? alpha('#1D9E75', 0.5) : alpha('#9FF5D3', 0.8)}`,
          animation: `${pulse} 2.4s ease-out infinite`, animationDelay: `${d}s`,
        }} />
      ))}
      <Box sx={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, #7EE8C0, #1D9E75 60%, #0F5C45)',
        boxShadow: '0 0 60px rgba(126,232,192,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 100 60" width="62%">
          <path d="M5 50 L22 38 L36 44 L52 22 L66 30 L80 12 L95 18" fill="none" stroke="#fff" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray="400" style={{ animation: `${draw} 4s ease-in-out infinite` }} />
        </svg>
      </Box>
    </Box>

    {/* 떠다니는 데이터 칩 */}
    {chips && CHIPS.map((c) => (
      <Box key={c.label} sx={{
        position: 'absolute', top: c.top, left: c.left, display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1,
        px: 1.5, py: 1, borderRadius: 2.5, bgcolor: light ? 'common.white' : alpha('#fff', 0.14), backdropFilter: 'blur(10px)',
        border: `1px solid ${light ? alpha('#1D9E75', 0.15) : alpha('#fff', 0.25)}`, color: light ? 'text.primary' : 'common.white',
        boxShadow: light ? '0 10px 24px rgba(40,60,120,.12)' : 'none', '& svg': { color: light ? '#1D9E75' : 'inherit' },
        animation: `${bob} 5s ease-in-out infinite`, animationDelay: `${c.delay}s`,
      }}>
        <IconifyIcon icon={c.icon} width={20} />
        <Box>
          <Typography sx={{ fontSize: 11, opacity: 0.8, lineHeight: 1.2 }}>{c.label}</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{c.value}</Typography>
        </Box>
      </Box>
    ))}
  </Box>
  );
};

export default EcoScene;
