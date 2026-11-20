import { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';

const POINTS = [
  { icon: 'mingcute:brain-line', title: 'AI 수요 예측', desc: '날씨·요일·특이사항을 반영해 메뉴별 7일 판매량을 예측해요' },
  { icon: 'mingcute:refresh-2-line', title: '발주 추천', desc: '재고·보관기한·입고 주기를 계산해 필요한 만큼만 주문해요' },
  { icon: 'mingcute:leaf-line', title: '폐기 줄이기', desc: '유통기한이 임박한 식자재는 할인 판매나 기부로 이어 줘요' },
];

// 로그인·회원가입 공통: 왼쪽 브랜드 패널(넓은 화면만) + 오른쪽 입력
const AuthShell = ({ children, maxWidth = 420 }: { children: ReactNode; maxWidth?: number }) => (
  <Box sx={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 6fr' }, bgcolor: 'background.default' }}>
    <Stack
      justifyContent="space-between"
      sx={{ display: { xs: 'none', md: 'flex' }, bgcolor: 'primary.main', color: 'common.white', p: { md: 10, lg: 14 } }}
    >
      <Stack direction="row" alignItems="center" gap={1.5}>
        <IconifyIcon icon="mingcute:leaf-fill" width={30} />
        <Typography fontSize={22} fontWeight={800}>FoodGuard</Typography>
      </Stack>
      <Box>
        <Typography fontSize={{ md: 34, lg: 40 }} fontWeight={700} lineHeight={1.35} mb={3}>
          내일 팔릴 만큼만,<br />똑똑하게 발주해요
        </Typography>
        <Typography fontSize={16} sx={{ opacity: 0.75 }} mb={8}>
          프랜차이즈 가맹점의 식자재 낭비를 줄이는 AI 발주 플랫폼
        </Typography>
        <Stack gap={5}>
          {POINTS.map((p) => (
            <Stack key={p.title} direction="row" gap={3} alignItems="flex-start">
              <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon={p.icon} width={22} />
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={16}>{p.title}</Typography>
                <Typography fontSize={14} sx={{ opacity: 0.7 }}>{p.desc}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </Box>
      <Typography fontSize={13} sx={{ opacity: 0.5 }}>© 2026 FoodGuard Team</Typography>
    </Stack>

    <Stack alignItems="center" justifyContent="center" sx={{ px: { xs: 4, sm: 8 }, py: 10 }}>
      <Stack direction="row" alignItems="center" gap={1.5} mb={8} sx={{ display: { xs: 'flex', md: 'none' } }}>
        <IconifyIcon icon="mingcute:leaf-fill" width={30} color="#1F4D3A" />
        <Typography fontSize={24} fontWeight={800} color="primary.main">FoodGuard</Typography>
      </Stack>
      <Box sx={{ width: '100%', maxWidth }}>{children}</Box>
    </Stack>
  </Box>
);

export default AuthShell;
