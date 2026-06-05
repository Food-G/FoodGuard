import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Paper, Stack, Button, TextField,
  Alert, CircularProgress, Box,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, MenuItem, Chip, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { ingredientService, Ingredient } from '../services/ingredientService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useConfirm } from '../hooks/useConfirm';
import { fileToDataUrl } from '../utils/image';

interface RecipeRow {
  ingredientId: string;
  qtyPerUnit: string;
  unit: string;
  tolerance: string;
}

// 식자재 기준 단위(kg/L/개) → 레시피 입력 단위(g/ml/개)
const recipeUnitFor = (baseUnit?: string) =>
  baseUnit === 'kg' ? 'g' : baseUnit === 'L' ? 'ml' : '개';

const emptyRow = (): RecipeRow => ({ ingredientId: '', qtyPerUnit: '', unit: 'g', tolerance: '5' });

const MenuManagement = ({ user }: any) => {
  const confirm = useConfirm();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Record<number, MenuIngredient[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ menuName: '', price: '' });
  const [recipe, setRecipe] = useState<RecipeRow[]>([emptyRow()]);
  const [photoBusyId, setPhotoBusyId] = useState<number | null>(null);

  // 새 식자재 즉시 등록 (식자재 관리 페이지 기능 통합)
  const [newIngOpen, setNewIngOpen] = useState(false);
  const [newIngRow, setNewIngRow] = useState<number | null>(null);
  const [newIng, setNewIng] = useState({ name: '', unit: 'kg' });
  const [creatingIng, setCreatingIng] = useState(false);

  const openNewIngredient = (rowIdx: number) => {
    setNewIngRow(rowIdx);
    setNewIng({ name: '', unit: 'kg' });
    setNewIngOpen(true);
  };

  const handleCreateIngredient = async () => {
    if (!newIng.name.trim()) return;
    setCreatingIng(true);
    setError('');
    try {
      const created = await ingredientService.create({ name: newIng.name.trim(), unit: newIng.unit });
      const list = await ingredientService.getAll();
      setIngredients(list);
      // 방금 만든 식자재를 호출한 레시피 행에 자동 선택
      if (newIngRow != null && created?.id) {
        setRow(newIngRow, { ingredientId: String(created.id), unit: recipeUnitFor(created.unit) });
      }
      setSuccess(`"${created?.name ?? newIng.name}" 식자재가 등록되었습니다.`);
      setNewIngOpen(false);
    } catch {
      setError('식자재 등록에 실패했습니다. (이미 존재하는 이름일 수 있습니다)');
    } finally {
      setCreatingIng(false);
    }
  };

  // 메뉴 사진 추가/변경 → POS 메뉴판에 표시됨
  const handlePhoto = async (menu: any, file?: File) => {
    if (!file || !storeId) return;
    setPhotoBusyId(menu.id);
    setError('');
    try {
      const imageUrl = await fileToDataUrl(file);
      await menuService.update(menu.id, {
        menuName: menu.menuName,
        price: menu.price,
        category: menu.category ?? null,
        imageUrl,
      });
      setSuccess(`"${menu.menuName}" 사진이 등록되었습니다.`);
      await loadMenus(storeId);
    } catch {
      setError('사진 등록에 실패했습니다.');
    } finally {
      setPhotoBusyId(null);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length > 0) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
    ingredientService.getAll().then(setIngredients).catch(() => {});
  }, [user]);

  const loadMenus = useCallback(async (sid: number) => {
    setLoading(true);
    try {
      const data = await menuService.getByStore(sid);
      const list = data ?? [];
      setMenus(list);
      // 각 메뉴의 레시피 로드
      const entries = await Promise.all(
        list.map((m: any) =>
          menuIngredientService.getByMenu(m.id)
            .then((r) => [m.id, r] as [number, MenuIngredient[]])
            .catch(() => [m.id, []] as [number, MenuIngredient[]]),
        ),
      );
      setRecipes(Object.fromEntries(entries));
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

  // ── 레시피 행 조작 ───────────────────────────────────────────────
  const setRow = (idx: number, patch: Partial<RecipeRow>) =>
    setRecipe((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const onPickIngredient = (idx: number, ingredientId: string) => {
    const ing = ingredients.find((i) => String(i.id) === ingredientId);
    setRow(idx, { ingredientId, unit: recipeUnitFor(ing?.unit) });
  };

  const addRow = () => setRecipe((rows) => [...rows, emptyRow()]);
  const removeRow = (idx: number) => setRecipe((rows) => rows.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.menuName || !form.price || !storeId) {
      setError('메뉴 이름과 가격을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created: any = await menuService.create({
        storeId,
        menuName: form.menuName,
        price: parseInt(form.price),
      });
      const newMenuId = created?.id;
      // 레시피 등록 (식자재 + 수량 입력된 행만)
      const rows = recipe.filter((r) => r.ingredientId && r.qtyPerUnit);
      if (newMenuId && rows.length) {
        for (const r of rows) {
          await menuIngredientService.add({
            menuId: newMenuId,
            ingredientId: parseInt(r.ingredientId),
            qtyPerUnit: parseFloat(r.qtyPerUnit),
            unit: r.unit,
            tolerance: parseFloat(r.tolerance || '0'),
          });
        }
      }
      setSuccess(`"${form.menuName}" 메뉴가 등록되었습니다.${rows.length ? ` (레시피 ${rows.length}개)` : ''}`);
      setForm({ menuName: '', price: '' });
      setRecipe([emptyRow()]);
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

  return (
    <Stack gap={4} maxWidth={820}>
      {!storeId && !loading && (
        <Alert severity="warning">등록된 가게가 없습니다. 먼저 가게를 등록해주세요.</Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 메뉴 등록 폼 */}
      {storeId && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
            <IconifyIcon icon="mingcute:add-circle-fill" color="primary.main" />
            <Typography variant="h6" fontWeight={700}>새 메뉴 등록</Typography>
          </Stack>
          <Stack component="form" onSubmit={handleSubmit} gap={2.5}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="flex-start">
              <TextField label="메뉴 이름" name="menuName" value={form.menuName} onChange={handleChange} size="small" required sx={{ flex: 2 }} />
              <TextField label="가격 (원)" name="price" type="number" value={form.price} onChange={handleChange} size="small" required sx={{ flex: 1 }} />
            </Stack>

            {/* 레시피 입력 */}
            <Box>
              <Stack direction="row" alignItems="center" gap={1} mb={1}>
                <IconifyIcon icon="mingcute:bowl-line" width={18} color="text.secondary" />
                <Typography variant="subtitle2" fontWeight={700}>레시피 (식자재 · 사용량 · 오차범위)</Typography>
              </Stack>
              <Stack gap={1}>
                {recipe.map((row, idx) => (
                  <Stack key={idx} direction="row" gap={1} alignItems="center">
                    <TextField
                      select size="small" label="식자재" value={row.ingredientId}
                      onChange={(e) => onPickIngredient(idx, e.target.value)}
                      sx={{ flex: 2, minWidth: 130 }}
                    >
                      <MenuItem value=""><em>선택</em></MenuItem>
                      {ingredients.map((i) => (
                        <MenuItem key={i.id} value={String(i.id)}>{i.name}</MenuItem>
                      ))}
                    </TextField>
                    <Tooltip title="새 식자재 등록">
                      <IconButton size="small" color="primary" onClick={() => openNewIngredient(idx)}
                        sx={{ border: `1px solid ${'rgba(0,0,0,0.12)'}`, borderRadius: 1.5 }}>
                        <IconifyIcon icon="mingcute:add-line" width={18} />
                      </IconButton>
                    </Tooltip>
                    <TextField
                      size="small" label="사용량" type="number" value={row.qtyPerUnit}
                      onChange={(e) => setRow(idx, { qtyPerUnit: e.target.value })}
                      sx={{ width: 96 }}
                    />
                    <TextField
                      select size="small" label="단위" value={row.unit}
                      onChange={(e) => setRow(idx, { unit: e.target.value })}
                      sx={{ width: 80 }}
                    >
                      {['g', 'ml', '개'].map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </TextField>
                    <TextField
                      size="small" label="오차%" type="number" value={row.tolerance}
                      onChange={(e) => setRow(idx, { tolerance: e.target.value })}
                      sx={{ width: 80 }}
                    />
                    <IconButton size="small" color="error" onClick={() => removeRow(idx)} disabled={recipe.length === 1}>
                      <IconifyIcon icon="mingcute:close-line" width={18} />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={addRow} sx={{ mt: 1 }}>
                식자재 추가
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                오차범위(%)는 조리 손실·편차를 반영합니다. 매출 발생 시 사용량 × (1 + 오차%) 만큼 재고에서 자동 차감됩니다.
              </Typography>
            </Box>

            <Box>
              <Button type="submit" variant="contained" disabled={submitting}
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}>
                메뉴 등록
              </Button>
            </Box>
          </Stack>
        </Paper>
      )}

      {/* 메뉴 목록 */}
      {storeId && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>등록된 메뉴 목록</Typography>
            <Chip label={`총 ${menus.length}개`} size="small" color="primary" variant="outlined" />
          </Stack>
          {loading ? (
            <CircularProgress size={24} />
          ) : menus.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              등록된 메뉴가 없습니다. 위에서 메뉴를 추가하세요.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>메뉴 / 레시피</TableCell>
                    <TableCell align="right">가격</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center" sx={{ width: 110 }}>관리</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {menus.map((menu) => {
                    const recipeRows = recipes[menu.id] ?? [];
                    return (
                      <TableRow key={menu.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" gap={1.5}>
                            {/* 썸네일 (POS 메뉴판에도 동일 사진 표시) */}
                            <Box
                              sx={{
                                width: 52, height: 52, flexShrink: 0, borderRadius: 2, overflow: 'hidden',
                                bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {menu.imageUrl
                                ? <Box component="img" src={menu.imageUrl} alt={menu.menuName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <IconifyIcon icon="mingcute:bowl-line" width={24} color="text.disabled" />}
                            </Box>
                            <Box minWidth={0}>
                              <Typography variant="body2" fontWeight={700}>{menu.menuName}</Typography>
                              {recipeRows.length > 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.5 }}>
                                  {recipeRows.map((mi) => `${mi.ingredient.name} ${mi.qtyPerUnit}${mi.unit}`).join(' · ')}
                                </Typography>
                              ) : (
                                <Typography variant="caption" color="text.disabled">레시피 없음</Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{menu.price?.toLocaleString()}원</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={menu.isActive !== false ? '활성' : '비활성'}
                            color={menu.isActive !== false ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" gap={0.3} justifyContent="center">
                            <Tooltip title="사진 추가/변경">
                              <IconButton size="small" color="primary" component="label" disabled={photoBusyId === menu.id}>
                                {photoBusyId === menu.id
                                  ? <CircularProgress size={18} />
                                  : <IconifyIcon icon="mingcute:pic-line" width={18} />}
                                <input hidden type="file" accept="image/*"
                                  onChange={(e) => handlePhoto(menu, e.target.files?.[0])} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="메뉴 비활성화">
                              <IconButton size="small" color="error" onClick={() => handleDeactivate(menu.id, menu.menuName)}>
                                <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* 새 식자재 등록 다이얼로그 (식자재 관리 기능 통합) */}
      <Dialog open={newIngOpen} onClose={() => setNewIngOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>새 식자재 등록</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={0.5}>
            <TextField
              label="식자재명" size="small" autoFocus fullWidth required
              value={newIng.name}
              onChange={(e) => setNewIng((p) => ({ ...p, name: e.target.value }))}
              placeholder="예: 치즈, 토마토"
            />
            <TextField
              select label="기준 단위" size="small" fullWidth
              value={newIng.unit}
              onChange={(e) => setNewIng((p) => ({ ...p, unit: e.target.value }))}
              helperText="무게=kg, 액체=L, 낱개=개 (재고·발주의 기준 단위)"
            >
              {['kg', 'L', '개'].map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              여기서 등록한 식자재는 모든 메뉴의 레시피·재고·발주에서 사용할 수 있습니다.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNewIngOpen(false)}>취소</Button>
          <Button variant="contained" onClick={handleCreateIngredient} disabled={creatingIng || !newIng.name.trim()} sx={{ fontWeight: 700 }}>
            {creatingIng ? <CircularProgress size={18} color="inherit" /> : '등록'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default MenuManagement;
