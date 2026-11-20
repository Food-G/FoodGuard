import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, Alert, TextField, IconButton,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import { useMyStore } from '../hooks/useMyStore';
import IngredientSuggestDialog from '../components/agent/IngredientSuggestDialog';

const UNIT_OPTIONS = ['kg', 'L', '개'];

// 자동 발주 기간 계산용 식자재 설정 (비우면 백엔드 기본값)
const DAY_FIELDS = [
  { key: 'shelfLifeDays', label: '보관기한(일)', min: 1, placeholder: '제한 없음' },
  { key: 'leadTimeDays', label: '입고(일 뒤)', min: 0, placeholder: '1' },
  { key: 'orderCycleDays', label: '주기(일)', min: 1, placeholder: '7' },
];

const Ingredients = ({ user }: any) => {
  const theme = useTheme();
  const confirm = useConfirm();
  const { storeId, storeLoading } = useMyStore(user);

  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showIngForm, setShowIngForm] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [ingForm, setIngForm] = useState({ name: '', unit: '' });
  const [editingIng, setEditingIng] = useState<any | null>(null);
  const [ingSubmitting, setIngSubmitting] = useState(false);

  useEffect(() => {
    if (storeId) loadAllIngredients(storeId);
    else if (!storeLoading) setLoading(false);
  }, [storeId, storeLoading]);

  const loadAllIngredients = async (sid: number) => {
    try {
      const data = await api.get(`/ingredients?storeId=${sid}`);
      setAllIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingForm.name || !ingForm.unit || !storeId) return;
    setIngSubmitting(true);
    setError('');
    try {
      await api.post('/ingredients', { ...ingForm, storeId });
      setSuccess('식자재가 등록되었습니다.');
      setIngForm({ name: '', unit: '' });
      setShowIngForm(false);
      await loadAllIngredients(storeId);
    } catch {
      setError('식자재 등록에 실패했습니다.');
    } finally {
      setIngSubmitting(false);
    }
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng) return;
    setIngSubmitting(true);
    setError('');
    try {
      await api.put(`/ingredients/${editingIng.id}`, {
        name: editingIng.name,
        unit: editingIng.unit,
        shelfLifeDays: editingIng.shelfLifeDays ?? '',
        leadTimeDays: editingIng.leadTimeDays ?? '',
        orderCycleDays: editingIng.orderCycleDays ?? '',
      });
      setSuccess('식자재가 수정되었습니다.');
      setEditingIng(null);
      if (storeId) await loadAllIngredients(storeId);
    } catch {
      setError('식자재 수정에 실패했습니다.');
    } finally {
      setIngSubmitting(false);
    }
  };

  const handleDeleteIngredient = async (id: number, name: string) => {
    if (!await confirm({ message: `"${name}" 식자재를 삭제하시겠습니까?`, confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await api.delete(`/ingredients/${id}`);
      setSuccess('식자재가 삭제되었습니다.');
      if (storeId) await loadAllIngredients(storeId);
    } catch {
      setError('식자재 삭제에 실패했습니다.');
    }
  };

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const unitPills = (value: string, onPick: (u: string) => void) => (
    <Stack direction="row" gap={1}>
      {UNIT_OPTIONS.map((u) => (
        <Chip
          key={u} label={u} onClick={() => onPick(u)}
          sx={{
            height: 36, minWidth: 52, borderRadius: 999, border: 'none', fontWeight: value === u ? 700 : 500,
            bgcolor: value === u ? 'text.primary' : 'background.paper',
            color: value === u ? 'common.white' : 'text.secondary',
            '&:hover': { bgcolor: value === u ? 'text.primary' : 'divider' },
            '& .MuiChip-label': { fontSize: 14 },
          }}
        />
      ))}
    </Stack>
  );
  const settingText = (ing: any) =>
    `보관 ${ing.shelfLifeDays ? `${ing.shelfLifeDays}일` : '제한 없음'} · ${ing.leadTimeDays ?? 1}일 뒤 입고 · ${ing.orderCycleDays ?? 7}일마다`;

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 + 버튼 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>등록된 식자재</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `${allIngredients.length}개`}
          </Typography>
        </Box>
        <Stack direction="row" gap={1.5}>
          <Button variant="outlined" disabled={!storeId} onClick={() => setSuggestOpen(true)}
            startIcon={<IconifyIcon icon="mingcute:sparkles-line" />}>
            AI 설정 제안
          </Button>
          <Button startIcon={<IconifyIcon icon="mingcute:add-line" />}
            onClick={() => { setShowIngForm((v) => !v); setEditingIng(null); }}>
            식자재 등록
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
      {storeId && (
        <IngredientSuggestDialog open={suggestOpen} storeId={storeId} ingredients={allIngredients} onClose={() => setSuggestOpen(false)}
          onSaved={() => { loadAllIngredients(storeId); setSuccess('확인한 설정을 저장했습니다.'); }} />
      )}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>식자재 목록</Typography>

          {/* 새 식자재 */}
          {showIngForm && (
            <Box component="form" onSubmit={handleCreateIngredient} sx={{ p: 4, mb: 3, bgcolor: 'background.default', borderRadius: 3 }}>
              <Stack gap={2.5}>
                <TextField label="식자재명" size="small" required fullWidth
                  value={ingForm.name} onChange={(e) => setIngForm((p) => ({ ...p, name: e.target.value }))} />
                <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                  <Typography variant="body2" color="text.secondary">발주 단위</Typography>
                  {unitPills(ingForm.unit, (u) => setIngForm((p) => ({ ...p, unit: u })))}
                </Stack>
                <Stack direction="row" gap={1.5} justifyContent="flex-end">
                  <Button variant="text" onClick={() => setShowIngForm(false)}>취소</Button>
                  <Button type="submit" disabled={ingSubmitting || !ingForm.unit}
                    startIcon={ingSubmitting ? <CircularProgress size={14} color="inherit" /> : null}>
                    등록
                  </Button>
                </Stack>
              </Stack>
            </Box>
          )}

          {loading ? (
            <Stack alignItems="center" py={6}><CircularProgress /></Stack>
          ) : allIngredients.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>등록된 식자재가 없습니다.</Typography>
          ) : allIngredients.map((ing) => (
            <Box key={ing.id} sx={rowSx}>
              <Stack direction="row" alignItems="center" gap={3} sx={{ py: 3 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography fontWeight={700} color="primary.main" fontSize={15}>{ing.name?.slice(0, 1)}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap>
                    {ing.name} <Box component="span" color="text.secondary" fontWeight={500}>{ing.unit}</Box>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>{settingText(ing)}</Typography>
                </Box>
                <IconButton size="small" aria-label={`${ing.name} 수정`}
                  onClick={() => { setEditingIng(editingIng?.id === ing.id ? null : { ...ing }); setShowIngForm(false); }}>
                  <IconifyIcon icon="mingcute:edit-2-line" width={18} color={editingIng?.id === ing.id ? theme.palette.primary.main : theme.palette.text.disabled} />
                </IconButton>
                <IconButton size="small" aria-label={`${ing.name} 삭제`} onClick={() => handleDeleteIngredient(ing.id, ing.name)}>
                  <IconifyIcon icon="mingcute:delete-2-line" width={18} color={theme.palette.text.disabled} />
                </IconButton>
              </Stack>

              {/* 수정 (행 아래로 펼침) */}
              {editingIng?.id === ing.id && (
                <Box component="form" onSubmit={handleUpdateIngredient} sx={{ p: 4, mb: 3, bgcolor: 'background.default', borderRadius: 3 }}>
                  <Stack gap={2.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ sm: 'center' }}>
                      <TextField size="small" label="식자재명" value={editingIng.name} sx={{ flex: 1 }}
                        onChange={(e) => setEditingIng((p: any) => ({ ...p, name: e.target.value }))} />
                      {unitPills(editingIng.unit, (u) => setEditingIng((p: any) => ({ ...p, unit: u })))}
                    </Stack>
                    <Stack direction="row" gap={1.5}>
                      {DAY_FIELDS.map(({ key, label, min, placeholder }) => (
                        <TextField
                          key={key} label={label} size="small" type="number" placeholder={placeholder}
                          InputLabelProps={{ shrink: true }} inputProps={{ min }} sx={{ flex: 1 }}
                          value={editingIng[key] ?? ''}
                          onChange={(e) => setEditingIng((p: any) => ({ ...p, [key]: e.target.value }))}
                        />
                      ))}
                    </Stack>
                    <Stack direction="row" gap={1.5} justifyContent="flex-end">
                      <Button variant="text" onClick={() => setEditingIng(null)}>취소</Button>
                      <Button type="submit" disabled={ingSubmitting}>저장</Button>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Box>
          ))}
        </Paper>

        {/* 발주 설정 안내 */}
        <Paper sx={{ p: 5, gap: 2 }}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <IconifyIcon icon="mingcute:information-line" width={20} color={theme.palette.primary.main} />
            <Typography fontSize={16} fontWeight={700}>발주 설정이란?</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            자동 발주는 식자재마다 "입고 전 기간 + 다음 입고까지" 수요만 주문하고, 보관기한을 넘는 날의 수요는 다음 발주로 미룹니다.
          </Typography>
          <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
            비워 두면 다음날 입고, 7일마다 입고, 보관기한 제한 없음으로 계산합니다. 잘 모르겠으면 "AI 설정 제안"을 눌러 보세요.
          </Typography>
        </Paper>
      </Box>
    </Stack>
  );
};

export default Ingredients;
