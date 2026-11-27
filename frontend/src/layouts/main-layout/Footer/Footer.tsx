import { Box, Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { Logo } from '../Topbar/Topbar';

const Footer = (): ReactElement => (
  <Box component="footer">
    <Box sx={{ bgcolor: '#F4F6F9', px: { xs: 2, sm: 4, lg: 6 }, pt: { xs: 4, md: 5 }, pb: 4 }}>
      <Box sx={{ maxWidth: 1440, mx: 'auto' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={{ xs: 3, md: 8 }} justifyContent="space-between">
          <Box>
            <Logo />
            <Typography sx={{ mt: 2, fontSize: 13, color: 'text.secondary', lineHeight: 1.9 }}>
              FoodGuard · AI 식자재 관리 플랫폼 · 캡스톤 디자인 1조<br />
              수요를 예측하고, 낭비를 줄이고, 남는 식자재는 이웃과 나눕니다.
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: 4 }}>
          <Typography variant="caption" color="text.disabled">
            ⓒ 2026 FoodGuard Team. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </Box>
  </Box>
);

export default Footer;
