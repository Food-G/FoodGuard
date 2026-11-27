import { ReactNode } from 'react';
import { Box, Stack } from '@mui/material';
import AuthVisual, { enter } from './AuthVisual';

const FEATURES = [
  { icon: 'mingcute:brain-fill', text: 'AI 수요 예측으로 필요한 만큼만 발주' },
  { icon: 'mingcute:refresh-2-line', text: '재고·보관기한을 계산한 발주 추천' },
  { icon: 'mingcute:heart-line', text: '남는 식자재는 할인 판매나 기부로' },
];

// 로그인·회원가입 공통: 왼쪽 일러스트 패널(모바일은 상단 배너) + 오른쪽 입력
const AuthShell = ({ children, maxWidth = 420 }: { children: ReactNode; maxWidth?: number }) => (
  <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
    <AuthVisual
      eyebrow="AI FOOD MANAGEMENT"
      title={<>버려지는 식자재 없이,<br />똑똑한 매장 운영</>}
      features={FEATURES}
    />
    <Stack
      alignItems="center"
      justifyContent="center"
      sx={{
        flex: { md: '1 1 45%' }, bgcolor: 'background.paper', position: 'relative',
        px: { xs: 3, sm: 5 }, py: { xs: 4, md: 6 },
        mt: { xs: -4, md: 0 }, borderRadius: { xs: '28px 28px 0 0', md: 0 }, // 모바일: 배너 위로 살짝 겹치는 시트
      }}
    >
      <Box sx={{ width: 1, maxWidth, ...enter(2) }}>{children}</Box>
    </Stack>
  </Box>
);

export default AuthShell;
