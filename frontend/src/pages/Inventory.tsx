import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, IconButton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import RecipeDraftDialog from '../components/RecipeDraftDialog';
import InvoiceImportDialog from '../components/agent/InvoiceImportDialog';
import WatchdogCard from '../components/agent/WatchdogCard';

const Inventory = ({ user }: any) => {
  const theme = useTheme();
  const confirm = useConfirm();

  // 재고 현황
  const [rows, setRows] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [watchKey, setWatchKey] = useState(0);
  const [category, setCategory] = useState<string | null>(null);

  // 메뉴 식자재 구성
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<any | null>(null);
  const [menuIngredients, setMenuIngredients] = useState<MenuIngredient[]>([]);
  const [loadingMI, setLoadingMI] = useState(false);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 메뉴-식자재 연결 추가 폼
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ingredientId: '', qtyPerUnit: '', unit: '' });
  const [submitting, setSubmitting] = useState(false);

  // AI 레시피 초안
  const [showDraft, setShowDraft] = useState(false);

  // 폐기 기록 (실제 폐기량 → 폐기율 측정 기준)
  const [wasteTarget, setWasteTarget] = useState<any | null>(null);
  const [wasteForm, setWasteForm] = useState({ quantity: '', reason: 'EXPIRED' });

  // 발주 단위 → 레시피 소단위 변환
  const toRecipeUnit = (base: string) => base === 'kg' ? 'g' : base === 'L' ? 'ml' : '개';

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (!stores?.length) return;
      const sid = stores[0].id;
      setStoreId(sid);
      loadInventory(sid);
      menuService.getByStore(sid).then((m: any[]) => setMenus(m ?? []));
      loadAllIngredients(sid);
    }).catch(console.error);
  }, [user]);

  const loadInventory = (sid: number) => {
    setLoadingInventory(true);
    inventoryService.getByStore(sid).then((data: any[]) => {
      setRows((data ?? []).map((item: any) => ({
        id: item.id,
        ingredientId: item.ingredient?.id,
        name: item.ingredient?.name ?? '',
        category: item.ingredient?.category ?? '',
        quantity: item.currentQty ?? item.quantity,
        unit: item.ingredient?.unit ?? '',
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-',
      })));
    }).catch(console.error).finally(() => setLoadingInventory(false));
  };

  const loadMenuIngredients = useCallback(async (menuId: number) => {
    setLoadingMI(true);
    try {
      const data = await menuIngredientService.getByMenu(menuId);
      setMenuIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingMI(false);
    }
  }, []);

  const handleSelectMenu = (menu: any) => {
    setSelectedMenu(menu);
    setShowForm(false);
    setForm({ ingredientId: '', qtyPerUnit: '', unit: '' });
    setError('');
    setSuccess('');
    loadMenuIngredients(menu.id);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !form.ingredientId || !form.qtyPerUnit || !form.unit) return;
    setSubmitting(true);
    setError('');
    try {
      await menuIngredientService.add({
        menuId: selectedMenu.id,
        ingredientId: Number(form.ingredientId),
        qtyPerUnit: Number(form.qtyPerUnit),
        unit: form.unit,
      });
      setSuccess('식자재가 추가되었습니다.');
      setForm({ ingredientId: '', qtyPerUnit: '', unit: '' });
      setShowForm(false);
      await loadMenuIngredients(selectedMenu.id);
    } catch {
      setError('식자재 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm('이 식자재 연결을 삭제하시겠습니까?')) return;
    try {
      await menuIngredientService.delete(id);
      setMenuIngredients((prev) => prev.filter((mi) => mi.id !== id));
      setSuccess('삭제되었습니다.');
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  const loadAllIngredients = async (sid: number) => {
    try {
      const data = await api.get(`/ingredients?storeId=${sid}`);
      setAllIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    }
  };

  const handleClearInventory = async () => {
    if (!storeId) return;
    if (!await confirm({ message: '전체 재고를 모두 삭제하시겠습니까?', confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await inventoryService.clearByStore(storeId);
      setSuccess('전체 재고가 삭제되었습니다.');
      loadInventory(storeId);
    } catch {
      setError('재고 삭제에 실패했습니다.');
    }
  };

  const handleWasteSubmit = async () => {
    if (!storeId || !wasteTarget || !(Number(wasteForm.quantity) > 0)) return;
    try {
      await inventoryService.recordWaste({
        storeId,
        ingredientId: wasteTarget.ingredientId,
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason,
      });
      setSuccess(`${wasteTarget.name} ${wasteForm.quantity}${wasteTarget.unit} 폐기가 기록되었습니다.`);
      setWasteTarget(null);
      loadInventory(storeId);
    } catch {
      setError('폐기 기록에 실패했습니다.');
    }
  };

  const handleIngredientSelect = (ingredientId: string) => {
    const ing = allIngredients.find((i) => String(i.id) === ingredientId);
    setForm((prev) => ({ ...prev, ingredientId, unit: toRecipeUnit(ing?.unit ?? '') }));
  };

  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean))] as string[];
  const shownRows = category ? rows.filter((r) => r.category === category) : rows;

  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.default',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };

  return (
    <Stack gap={5}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 큰 숫자 요약 + 입고 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>재고 품목</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loadingInventory ? '-' : `${rows.length}개`}
          </Typography>
        </Box>
        <Stack direction="row" gap={2}>
          <Button color="error" variant="text" disabled={!storeId || rows.length === 0} onClick={handleClearInventory}>
            전체 삭제
          </Button>
          <Button disabled={!storeId} startIcon={<IconifyIcon icon="mingcute:camera-line" />} onClick={() => setInvoiceOpen(true)}>
            거래명세서로 입고 (AI)
          </Button>
        </Stack>
      </Stack>
      {storeId && (
        <InvoiceImportDialog open={invoiceOpen} storeId={storeId} ingredients={allIngredients} onClose={() => setInvoiceOpen(false)}
          onSaved={() => { loadInventory(storeId); setWatchKey((k) => k + 1); setSuccess('거래명세서 품목을 재고에 반영했습니다.'); }} />
      )}

      {storeId && <WatchdogCard storeId={storeId} refreshKey={watchKey} />}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 380px' }, alignItems: 'start' }}>
        {/* 전체 재고 (토스 목록 행) */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>전체 재고</Typography>
          {categories.length > 1 && (
            <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
              {pill('전체', category === null, () => setCategory(null))}
              {categories.map((c) => pill(c, category === c, () => setCategory(category === c ? null : c)))}
            </Stack>
          )}
          {loadingInventory ? (
            <Stack alignItems="center" py={8}><CircularProgress /></Stack>
          ) : shownRows.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              재고가 없습니다. 거래명세서로 입고하거나 발주를 받으면 여기에 표시됩니다.
            </Typography>
          ) : shownRows.map((r) => (
            <Stack key={r.id} direction="row" alignItems="center" gap={3} sx={{ py: 3, ...rowSx }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography fontWeight={700} color="primary.main" fontSize={15}>{r.name.slice(0, 1)}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600} fontSize={15} noWrap>{r.name}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {r.category ? `${r.category} · ` : ''}{r.updatedAt}
                </Typography>
              </Box>
              <Typography fontWeight={700} fontSize={16} sx={{ whiteSpace: 'nowrap' }}>
                {r.quantity}<Box component="span" color="text.secondary" fontWeight={500} ml={0.5}>{r.unit}</Box>
              </Typography>
              <Button size="small" variant="text" color="error"
                onClick={() => { setWasteForm({ quantity: '', reason: 'EXPIRED' }); setWasteTarget(r); }}>
                폐기
              </Button>
            </Stack>
          ))}
        </Paper>

        {/* 메뉴별 식자재 구성 */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={1}>메뉴별 식자재 구성</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>메뉴 1개에 들어가는 식자재입니다. 발주 추천이 이 값으로 계산됩니다.</Typography>

          {menus.length === 0 ? (
            <Typography variant="body2" color="text.secondary">등록된 메뉴가 없습니다.</Typography>
          ) : (
            <Stack direction="row" gap={1} flexWrap="wrap" mb={3}>
              {menus.map((menu) => pill(menu.menuName, selectedMenu?.id === menu.id, () => handleSelectMenu(menu)))}
            </Stack>
          )}

          {!selectedMenu && menus.length > 0 && (
            <Typography variant="body2" color="text.secondary">메뉴를 고르면 식자재 구성이 표시됩니다.</Typography>
          )}

          {selectedMenu && (
            <>
              <Stack direction="row" gap={1.5} mb={2}>
                <Button size="small" variant="outlined" startIcon={<IconifyIcon icon="mingcute:sparkles-line" />} onClick={() => setShowDraft(true)}>
                  AI 초안
                </Button>
                <Button size="small" variant="outlined" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={() => setShowForm((v) => !v)}>
                  식자재 추가
                </Button>
              </Stack>

              {/* 추가 폼 */}
              {showForm && (
                <Box component="form" onSubmit={handleAddIngredient} sx={{ p: 3, mb: 2, bgcolor: 'background.default', borderRadius: 3 }}>
                  <Stack gap={2}>
                    <TextField
                      select label="식자재 선택" size="small" required fullWidth
                      value={form.ingredientId}
                      onChange={(e) => handleIngredientSelect(e.target.value)}
                    >
                      {allIngredients.map((ing) => (
                        <MenuItem key={ing.id} value={String(ing.id)}>
                          {ing.name} ({ing.unit})
                        </MenuItem>
                      ))}
                    </TextField>
                    <Stack direction="row" gap={1.5} alignItems="center">
                      <TextField
                        label={`1개당 사용량${form.unit ? ` (${form.unit})` : ''}`} size="small" type="number" required
                        value={form.qtyPerUnit}
                        onChange={(e) => setForm((p) => ({ ...p, qtyPerUnit: e.target.value }))}
                        sx={{ flex: 1 }}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                      <Button type="submit" size="small" disabled={submitting}
                        startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}>
                        추가
                      </Button>
                      <Button size="small" variant="text" onClick={() => setShowForm(false)}>취소</Button>
                    </Stack>
                  </Stack>
                </Box>
              )}

              {loadingMI ? (
                <Stack alignItems="center" py={3}><CircularProgress size={24} /></Stack>
              ) : menuIngredients.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  연결된 식자재가 없습니다. "AI 초안"이나 "식자재 추가"로 연결하세요.
                </Typography>
              ) : menuIngredients.map((mi) => (
                <Stack key={mi.id} direction="row" alignItems="center" gap={2} sx={{ py: 2.5, ...rowSx }}>
                  <Typography fontWeight={600} fontSize={15} sx={{ flex: 1, minWidth: 0 }} noWrap>{mi.ingredient.name}</Typography>
                  <Typography fontWeight={700} fontSize={15}>
                    {mi.qtyPerUnit}<Box component="span" color="text.secondary" fontWeight={500} ml={0.5}>{mi.unit}</Box>
                  </Typography>
                  <IconButton size="small" onClick={() => handleDelete(mi.id)} aria-label={`${mi.ingredient.name} 연결 삭제`}>
                    <IconifyIcon icon="mingcute:delete-2-line" width={18} color={theme.palette.text.disabled} />
                  </IconButton>
                </Stack>
              ))}
            </>
          )}
        </Paper>
      </Box>

      {selectedMenu && (
        <RecipeDraftDialog
          open={showDraft}
          menu={selectedMenu}
          ingredients={allIngredients}
          toRecipeUnit={toRecipeUnit}
          onClose={() => setShowDraft(false)}
          onSaved={(count) => {
            setShowDraft(false);
            setSuccess(`AI 초안에서 식자재 ${count}개를 연결했습니다.`);
            loadMenuIngredients(selectedMenu.id);
          }}
        />
      )}

      <Dialog open={!!wasteTarget} onClose={() => setWasteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>폐기 기록 — {wasteTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <TextField
              label={`폐기 수량 (${wasteTarget?.unit ?? ''}, 현재고 ${wasteTarget?.quantity ?? 0})`}
              type="number"
              autoFocus
              value={wasteForm.quantity}
              onChange={(e) => setWasteForm((p) => ({ ...p, quantity: e.target.value }))}
              inputProps={{ step: '0.1', min: '0' }}
            />
            <TextField
              select
              label="사유"
              value={wasteForm.reason}
              onChange={(e) => setWasteForm((p) => ({ ...p, reason: e.target.value }))}
            >
              <MenuItem value="EXPIRED">유통기한 경과</MenuItem>
              <MenuItem value="SPOILED">변질·파손</MenuItem>
              <MenuItem value="OTHER">기타</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWasteTarget(null)}>취소</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleWasteSubmit}
            disabled={!(Number(wasteForm.quantity) > 0)}
          >
            기록
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Inventory;
