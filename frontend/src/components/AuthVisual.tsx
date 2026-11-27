import { ReactNode } from 'react';
import { Box, Stack, Typography, alpha, keyframes } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import authIllust from '../assets/auth-illust.svg';

// 로그인·회원가입 공용 비주얼 패널: 데스크톱은 왼쪽에 고정(폼이 길어도 따라오지 않음), 모바일은 상단 배너
export const fadeUp = keyframes`from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none }`;
export const enter = (i: number) => ({ animation: `${fadeUp} .6s ease ${0.1 + i * 0.08}s both` });
const blob = keyframes`0%,100% { transform: translate(0,0) scale(1) } 33% { transform: translate(40px,-30px) scale(1.1) } 66% { transform: translate(-30px,20px) scale(.95) }`;

interface AuthVisualProps {
  eyebrow: string;
  title: ReactNode;
  features: { icon: string; text: string }[];
}

const AuthVisual = ({ eyebrow, title, features }: AuthVisualProps) => (
  <Box sx={{
    position: { xs: 'relative', md: 'sticky' }, top: 0, alignSelf: 'flex-start',
    width: { xs: 1, md: 'auto' }, flex: { md: '1 1 55%' }, height: { md: '100vh' }, minHeight: { xs: 300, sm: 360 },
    overflow: 'hidden', color: '#1B1F3B',
    background: 'linear-gradient(140deg, #EAF6F1 0%, #EEEBFF 55%, #FDEFF4 100%)',
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    px: { xs: 3, sm: 5, lg: 8 }, pt: { xs: 3, md: 6 }, pb: { xs: 7, md: 6 },
  }}>
    {/* 움직이는 빛 덩어리 */}
    {[{ c: '#1D9E75', s: 420, t: '-10%', l: '40%', d: 0 }, { c: '#2F7DD1', s: 360, t: '55%', l: '-10%', d: 4 }, { c: '#7A4FD6', s: 280, t: '70%', l: '70%', d: 8 }].map((b) => (
      <Box key={b.c} sx={{
        position: 'absolute', width: b.s, height: b.s, top: b.t, left: b.l, borderRadius: '50%',
        background: b.c, filter: 'blur(90px)', opacity: 0.22, animation: `${blob} 16s ease-in-out infinite`, animationDelay: `-${b.d}s`,
      }} />
    ))}
    <Box sx={{
      position: 'absolute', inset: 0, opacity: 0.08,
      backgroundImage: 'linear-gradient(rgba(27,31,59,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(27,31,59,.6) 1px, transparent 1px)',
      backgroundSize: '56px 56px', maskImage: 'radial-gradient(ellipse at 60% 50%, #000 15%, transparent 70%)',
    }} />

    {/* 로고 */}
    <Stack direction="row" alignItems="center" gap={1.2} sx={{ position: 'relative', ...enter(0) }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '10px', background: 'linear-gradient(135deg, #1D9E75, #2F7DD1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconifyIcon icon="mingcute:leaf-fill" color="white" width={22} />
      </Box>
      <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.5px' }}>FoodGuard</Typography>
    </Stack>

    {/* 일러스트 + 문구 */}
    <Stack direction={{ xs: 'row', md: 'column' }} alignItems={{ xs: 'center', md: 'flex-start' }} gap={{ xs: 2, md: 4 }} sx={{ position: 'relative', my: { xs: 2, md: 0 } }}>
      <Box sx={{ width: { xs: 150, sm: 210, md: 'min(94%, 60vh)', lg: 'min(90%, 60vh)' }, maxWidth: 640, flexShrink: 0, mx: { md: 'auto' }, ...enter(1) }}>
        <Box component="img" src={authIllust} alt="FoodGuard 매장 일러스트" sx={{ display: 'block', width: 1, height: 'auto' }} />
      </Box>
      <Box minWidth={0}>
        <Typography sx={{ fontSize: { xs: 11, md: 13 }, letterSpacing: '0.3em', fontWeight: 700, color: '#1D9E75', ...enter(2) }}>
          {eyebrow}
        </Typography>
        <Typography sx={{ fontSize: { xs: 22, sm: 28, md: 38, lg: 44 }, fontWeight: 900, lineHeight: 1.2, letterSpacing: '-1px', mt: 1, ...enter(3) }}>
          {title}
        </Typography>
        <Stack gap={1.2} mt={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {features.map((f, i) => (
            <Stack key={f.text} direction="row" alignItems="center" gap={1.2} sx={{ color: '#4A5070', ...enter(4 + i) }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D9E75', boxShadow: '0 4px 12px rgba(30,40,90,.08)' }}>
                <IconifyIcon icon={f.icon} width={16} />
              </Box>
              <Typography fontSize={15}>{f.text}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Stack>

    <Typography variant="caption" sx={{ position: 'relative', color: alpha('#1B1F3B', 0.45), display: { xs: 'none', md: 'block' } }}>
      © 2026 FoodGuard Team. All rights reserved.
    </Typography>
  </Box>
);

export default AuthVisual;
