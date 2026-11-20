import { Box, Collapse, Stack, Typography, alpha } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IconifyIcon from 'components/base/IconifyIcon';
import { Logo } from '../Topbar/Topbar';
import { menuFor } from '../menu';

const Footer = ({ role }: { role: string }): ReactElement => {
  const navigate = useNavigate();
  const menu = menuFor(role);
  const [open, setOpen] = useState<number | null>(null);
  const aiGroup = menu.find((g) => g.title === 'AI 비서');

  return (
    <Box component="footer">
      {/* 메뉴 바로가기: 이어 붙은 네모 칸 (꾸민 아이콘·색·글씨는 유지). 칸을 누르면 하위 메뉴가 펼쳐진다 */}
      <Box sx={{ bgcolor: '#FAFBFD' }}>
        <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 0, lg: 6 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${menu.length}, 1fr)` } }}>
          {menu.map((g, i) => {
            const isOpen = open === i;
            return (
              <Box key={g.title} sx={{
                position: 'relative',
                bgcolor: isOpen ? alpha(g.color, 0.04) : 'transparent', transition: 'background-color .25s',
                '&::before': {
                  content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: g.color,
                  transform: isOpen ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left', transition: 'transform .3s ease',
                },
                '&:hover::before': { transform: 'scaleX(1)' },
              }}>
                <Stack direction="row" alignItems="center" gap={1.4} onClick={() => setOpen(isOpen ? null : i)}
                  sx={{ px: 2.5, py: 1.6, cursor: 'pointer' }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '8px', flexShrink: 0, bgcolor: alpha(g.color, 0.12), color: g.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconifyIcon icon={g.icon} width={19} />
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography fontWeight={800} fontSize={14.5} noWrap>{g.title}</Typography>
                    <Typography fontSize={12} color="text.secondary" noWrap>메뉴 {g.items.length}개</Typography>
                  </Box>
                  <Box sx={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid', borderColor: isOpen ? g.color : 'divider', bgcolor: isOpen ? g.color : 'transparent',
                    color: isOpen ? 'common.white' : 'text.secondary', transition: 'all .25s', transform: isOpen ? 'rotate(45deg)' : 'none',
                  }}>
                    <IconifyIcon icon="mingcute:add-line" width={15} />
                  </Box>
                </Stack>
                <Collapse in={isOpen}>
                  <Stack sx={{ px: 2, pb: 1.5 }} gap={0.3}>
                    {g.items.map((it) => (
                      <Stack key={it.path} direction="row" alignItems="center" gap={1} onClick={() => navigate(it.path)} sx={{
                        px: 1, py: 0.9, borderRadius: '6px', cursor: 'pointer', fontSize: 13.5, color: 'text.secondary',
                        '&:hover': { bgcolor: alpha(g.color, 0.08), color: g.color },
                      }}>
                        <IconifyIcon icon={it.icon} width={15} />
                        <Box component="span" flex={1}>{it.title}</Box>
                        <IconifyIcon icon="mingcute:right-line" width={14} />
                      </Stack>
                    ))}
                  </Stack>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Box>

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
            {aiGroup && (
              <Stack gap={0.8} sx={{ minWidth: 220 }}>
                {aiGroup.items.map((it) => (
                  <Stack key={it.path} direction="row" alignItems="center" justifyContent="space-between" onClick={() => navigate(it.path)}
                    sx={{ fontSize: 13.5, fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
                    {it.title}
                    <IconifyIcon icon="mingcute:right-line" width={16} />
                  </Stack>
                ))}
              </Stack>
            )}
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
};

export default Footer;
