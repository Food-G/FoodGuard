import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Paper, Stack, Button, TextField, Box,
  Alert, CircularProgress, IconButton, InputAdornment, useTheme,
} from '@mui/material';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useConfirm } from '../hooks/useConfirm';

const MenuManagement = ({ user }: any) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ menuName: '', price: '' });

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length > 0) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const loadMenus = useCallback(async (sid: number) => {
    setLoading(true);
    try {
      const data = await menuService.getByStore(sid);
      setMenus(data ?? []);
    } catch {
      setError('메뉴 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeId) loadMenus(storeId);
  }, [storeId, loadMenus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.menuName || !form.price || !storeId) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await menuService.create({
        storeId,
        menuName: form.menuName,
        price: parseInt(form.price),
      });
      setSuccess(`"${form.menuName}" 메뉴가 등록되었습니다.`);
      setForm({ menuName: '', price: '' });
      await loadMenus(storeId);
    } catch {
      setError('메뉴 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (menuId: number, menuName: string) => {
    if (!await confirm(`"${menuName}" 메뉴를 비활성화하시겠습니까?`)) return;
    try {
      await menuService.deactivate(menuId);
      setSuccess(`"${menuName}" 메뉴가 비활성화되었습니다.`);
      if (storeId) await loadMenus(storeId);
    } catch {
      setError('메뉴 비활성화에 실패했습니다.');
    }
  };

  const activeCount = menus.filter((m) => m.isActive !== false).length;
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Box>
        <Typography color="text.secondary" fontSize={15} mb={1}>판매 중인 메뉴</Typography>
        <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
          {loading ? '-' : `${activeCount}개`}
        </Typography>
      </Box>

      {!storeId && !loading && (
        <Alert severity="warning">등록된 가게가 없습니다. 먼저 가게를 등록해주세요.</Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {storeId && (
        <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, alignItems: 'start' }}>
          {/* 메뉴 목록 */}
          <Paper sx={{ p: 5 }}>
            <Typography fontSize={18} fontWeight={700} mb={2}>메뉴 목록</Typography>
            {loading ? (
              <Stack alignItems="center" py={6}><CircularProgress /></Stack>
            ) : menus.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                등록된 메뉴가 없습니다. 오른쪽에서 메뉴를 추가하세요.
              </Typography>
            ) : menus.map((menu) => {
              const active = menu.isActive !== false;
              return (
                <Stack key={menu.id} direction="row" alignItems="center" gap={3} sx={{ py: 3, opacity: active ? 1 : 0.5, ...rowSx }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography fontWeight={700} color="primary.main" fontSize={15}>{menu.menuName?.slice(0, 1)}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize={15} noWrap>{menu.menuName}</Typography>
                    {!active && <Typography variant="body2" color="text.secondary">판매 중지</Typography>}
                  </Box>
                  <Typography fontWeight={700} fontSize={16}>₩{menu.price?.toLocaleString()}</Typography>
                  {active && (
                    <IconButton size="small" aria-label={`${menu.menuName} 판매 중지`} onClick={() => handleDeactivate(menu.id, menu.menuName)}>
                      <IconifyIcon icon="mingcute:delete-2-line" width={18} color={theme.palette.text.disabled} />
                    </IconButton>
                  )}
                </Stack>
              );
            })}
          </Paper>

          <Stack gap={5}>
            {/* 새 메뉴 등록 */}
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: 5, gap: 3 }}>
              <Typography fontSize={18} fontWeight={700}>새 메뉴</Typography>
              <TextField label="메뉴 이름" name="menuName" value={form.menuName} onChange={handleChange} size="small" required fullWidth />
              <TextField
                label="가격" name="price" type="number" value={form.price} onChange={handleChange} size="small" required fullWidth
                InputProps={{ endAdornment: <InputAdornment position="end">원</InputAdornment> }}
              />
              <Button
                type="submit" fullWidth disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="mingcute:add-line" />}
              >
                메뉴 등록
              </Button>
            </Paper>

            {/* 레시피 안내 */}
            <Paper onClick={() => navigate('/inventory')} sx={{ p: 4, flexDirection: 'row', alignItems: 'center', gap: 2.5, cursor: 'pointer', '&:hover': { bgcolor: 'primary.light' } }}>
              <IconifyIcon icon="mingcute:sparkles-line" width={20} color={theme.palette.primary.main} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={600} fontSize={15} color="primary.main">레시피 설정하기</Typography>
                <Typography variant="body2" color="text.secondary">메뉴에 들어가는 식자재는 재고 화면에서 정해요. AI 초안도 있어요.</Typography>
              </Box>
              <IconifyIcon icon="mingcute:right-line" width={18} color={theme.palette.text.disabled} />
            </Paper>
          </Stack>
        </Box>
      )}
    </Stack>
  );
};

export default MenuManagement;
