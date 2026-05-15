import { Menu, Avatar, Button, Tooltip, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';
import { useState, MouseEvent, useCallback, ReactElement } from 'react';

interface UserDropdownProps {
  onLogout: () => void;
}

/* JWT에서 유저 정보 추출 */
const getUserInfo = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  return decodeToken(token) as { sub: string; role: string; userId: number } | null;
};

const ROLE_LABEL: Record<string, string> = {
  OWNER:    '가맹점 점주',
  HQ:       '본사 관리자',
  HQ_ADMIN: '본사 관리자',
};

/* ─────────────── 내 프로필 다이얼로그 ─────────────── */
const ProfileDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const userInfo = getUserInfo();
  const [profile, setProfile]     = useState<any>(null);
  const [editName, setEditName]   = useState('');
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');

  useEffect(() => {
    if (!open) return;
    api.get('/users/me').then((data) => {
      setProfile(data);
      setEditName(data.userName || '');
    }).catch(() => {});
  }, [open]);

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true); setMsg('');
    try {
      await api.put('/users/me', { userName: editName.trim() });
      setProfile((p: any) => ({ ...p, userName: editName.trim() }));
      setEditing(false);
      setMsg('이름이 변경됐습니다.');
    } catch { setMsg('저장 실패'); }
    finally { setSaving(false); }
  };

  const initials = (profile?.userName || profile?.email || 'FG')
    .slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="mingcute:user-2-fill" sx={{ color: 'primary.main' }} />
          내 프로필
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack alignItems="center" gap={2} pt={1}>
          <Avatar
            sx={{
              width: 80, height: 80, fontSize: '1.8rem', fontWeight: 700,
              background: 'linear-gradient(135deg,#43a047,#1e88e5)',
              boxShadow: '0 4px 16px rgba(67,160,71,0.35)',
            }}
          >
            {initials}
          </Avatar>

          {editing ? (
            <Stack direction="row" gap={1} width="100%">
              <TextField size="small" fullWidth label="이름" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
              <Button variant="contained" size="small" onClick={handleSaveName} disabled={saving}>
                {saving ? <CircularProgress size={14} /> : '저장'}
              </Button>
              <Button size="small" onClick={() => setEditing(false)} color="inherit">취소</Button>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                {profile?.userName || '이름 없음'}
              </Typography>
              <IconButton size="small" onClick={() => setEditing(true)}>
                <IconifyIcon icon="mingcute:edit-line" width={16} height={16} sx={{ color: 'text.secondary' }} />
              </IconButton>
            </Stack>
          )}

          {msg && <Alert severity={msg.includes('실패') ? 'error' : 'success'} sx={{ width: '100%' }}>{msg}</Alert>}

          <Divider flexItem />

          {[
            { icon: 'mingcute:mail-line', label: '이메일', value: profile?.email || userInfo?.sub || '-' },
            { icon: 'mingcute:user-star-fill', label: '역할', value: ROLE_LABEL[profile?.role || userInfo?.role || ''] || profile?.role || '-' },
            { icon: 'mingcute:hashtag-line', label: '사용자 ID', value: `#${profile?.id || userInfo?.userId || '-'}` },
          ].map((item) => (
            <Stack key={item.label} direction="row" alignItems="center" gap={2} width="100%">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'primary.50', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon={item.icon} width={18} height={18} sx={{ color: 'primary.main' }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="body2" fontWeight={600} color="text.primary">{item.value}</Typography>
              </Box>
            </Stack>
          ))}

          <Divider flexItem />

          <Chip
            icon={<IconifyIcon icon="mingcute:leaf-fill" width={14} height={14} sx={{ color: 'white !important' }} />}
            label={ROLE_LABEL[profile?.role || userInfo?.role || ''] || '사용자'}
            sx={{ background: 'linear-gradient(135deg,#43a047,#1e88e5)', color: 'white', fontWeight: 700 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─────────────── 설정 다이얼로그 ─────────────── */
const SettingsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [stockAlert, setStockAlert] = useState(() => localStorage.getItem('set_stock') !== 'false');
  const [orderAlert, setOrderAlert] = useState(() => localStorage.getItem('set_order') !== 'false');
  const [wasteAlert, setWasteAlert] = useState(() => localStorage.getItem('set_waste') !== 'false');
  const [pwOld, setPwOld] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwNew2, setPwNew2] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');

  const saveAlerts = () => {
    localStorage.setItem('set_stock', String(stockAlert));
    localStorage.setItem('set_order', String(orderAlert));
    localStorage.setItem('set_waste', String(wasteAlert));
  };

  const handlePwChange = async () => {
    if (!pwOld || !pwNew) { setPwMsg('모든 항목을 입력해주세요.'); return; }
    if (pwNew !== pwNew2) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return; }
    if (pwNew.length < 6) { setPwMsg('비밀번호는 6자 이상이어야 합니다.'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await api.put('/users/me/password', { oldPassword: pwOld, newPassword: pwNew });
      setPwMsg('비밀번호가 변경됐습니다. 다음 로그인부터 적용됩니다.');
      setPwOld(''); setPwNew(''); setPwNew2('');
    } catch (e: any) {
      setPwMsg(e.message?.includes('맞지') ? '현재 비밀번호가 틀렸습니다.' : '변경 실패');
    } finally { setPwSaving(false); }
  };

  return (
    <Dialog open={open} onClose={() => { saveAlerts(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="material-symbols:settings-account-box-rounded" sx={{ color: 'primary.main' }} />
          설정
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack gap={3} pt={1}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary" mb={1.5}>🔔 알림 설정</Typography>
            <Stack gap={0.5} sx={{ pl: 1 }}>
              <FormControlLabel control={<Switch checked={stockAlert} onChange={(e) => setStockAlert(e.target.checked)} color="primary" size="small" />} label={<Typography variant="body2">재고 부족 알림</Typography>} />
              <FormControlLabel control={<Switch checked={orderAlert} onChange={(e) => setOrderAlert(e.target.checked)} color="primary" size="small" />} label={<Typography variant="body2">발주 상태 변경 알림</Typography>} />
              <FormControlLabel control={<Switch checked={wasteAlert} onChange={(e) => setWasteAlert(e.target.checked)} color="primary" size="small" />} label={<Typography variant="body2">폐기 기록 등록 알림</Typography>} />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary" mb={1.5}>🔒 비밀번호 변경</Typography>
            <Stack gap={1.5}>
              <TextField label="현재 비밀번호" type="password" size="small" fullWidth value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
              <TextField label="새 비밀번호 (6자 이상)" type="password" size="small" fullWidth value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
              <TextField label="새 비밀번호 확인" type="password" size="small" fullWidth value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} />
              {pwMsg && <Alert severity={pwMsg.includes('변경됐') ? 'success' : 'error'} sx={{ py: 0.5 }}>{pwMsg}</Alert>}
              <Button variant="contained" size="small" onClick={handlePwChange} disabled={pwSaving}
                startIcon={pwSaving ? <CircularProgress size={14} /> : <IconifyIcon icon="mingcute:lock-fill" width={14} height={14} />}
                sx={{ alignSelf: 'flex-start', px: 3 }}>
                {pwSaving ? '변경 중...' : '비밀번호 변경'}
              </Button>
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary" mb={1}>ℹ️ 앱 정보</Typography>
            <Stack gap={0.5} sx={{ pl: 1 }}>
              {[['서비스명', 'FoodGuard'], ['버전', 'v1.0.0 (2026)'], ['개발팀', '창신대학교 컴퓨터공학과 1조']].map(([k, v]) => (
                <Stack key={k} direction="row" gap={1}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60 }}>{k}</Typography>
                  <Typography variant="caption" fontWeight={600} color="text.primary">{v}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { saveAlerts(); onClose(); }} variant="contained">저장 후 닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─────────────── UserDropdown ─────────────── */    { id: 3, title: '로그아웃', icon: 'material-symbols:logout', color: 'error.main', onClick: handleLogout },
  ];

  return (
    <>
      <Button
        color="inherit"
        variant="text"
        id="account-dropdown-menu"
        aria-controls={menuOpen ? 'account-dropdown-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={menuOpen ? 'true' : undefined}
        onClick={handleUserClick}
        disableRipple
        sx={{ borderRadius: 2, gap: 1.5, px: { xs: 0, sm: 0.625 }, py: 0.625, '&:hover': { bgcolor: 'transparent' } }}      >
        <Tooltip title="Account" arrow placement="bottom">
          <Avatar sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}>FG</Avatar>
        </Tooltip>
        <IconifyIcon
          color="text.primary"
          icon="mingcute:down-fill"
          width={22.5}
          height={22.5}
          sx={(theme) => ({
            transform: menuOpen ? `rotate(180deg)` : `rotate(0deg)`,
            transition: theme.transitions.create('all', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.short,
            }),
          })}
        />
      </Button>
      <Menu
        id="account-dropdown-menu"
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleUserClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {userMenuItems.map((item) => (
          <MenuItem key={item.id} onClick={item.onClick || handleUserClose}>
            <ListItemIcon
              sx={{
                minWidth: `0 !important`,
                color: item.color,
                width: 14,
                height: 10,
                mb: 1.5,
                mr: 2
              }}
            >
              <IconifyIcon icon={item.icon} color={item.color} />
            </ListItemIcon>
            <ListItemText
              sx={(theme) => ({
                color: item.color,
                '& .MuiListItemText-primary': {
                  fontSize: theme.typography.subtitle2.fontSize,
                  fontWeight: theme.typography.subtitle2.fontWeight,
                },
              })}
            >
              {item.title}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default UserDropdown;
