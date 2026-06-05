import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, IconButton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider,
} from '@mui/material';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';

const Inventory = ({ user }: any) => {
  const theme = useTheme();
  const confirm = useConfirm();

  // 재고 현황
  const [rows, setRows] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);

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
    }).catch(console.error);

    loadAllIngredients();
  }, [user]);

  const loadInventory = (sid: number) => {
    setLoadingInventory(true);
    inventoryService.getByStore(sid).then((data: any[]) => {
      setRows((data ?? []).map((item: any) => ({
        id: item.id,
        name: item.ingredient?.name ?? '',
        quantity: Number(item.currentQty ?? item.quantity ?? 0),
        minThreshold: Number(item.minThreshold ?? 0),
        unit: item.ingredient?.unit ?? item.unit ?? '',
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

  const loadAllIngredients = async () => {
    try {
      const data = await api.get('/ingredients');
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

  const handleIngredientSelect = (ingredientId: string) => {
    const ing = allIngredients.find((i) => String(i.id) === ingredientId);
    setForm((prev) => ({ ...prev, ingredientId, unit: toRecipeUnit(ing?.unit ?? '') }));
  };

  // 재고 긴급도: 현재고 / 최소임계치 비율로 판단 (낮을수록 급함)
  const urgencyOf = (q: number, min: number) => {
    const ratio = min > 0 ? q / min : (q <= 0 ? 0 : 99);
    if (q <= 0 || ratio <= 1) return { level: '긴급', color: theme.palette.error.main, sort: ratio - (q <= 0 ? 1 : 0) };
    if (ratio <= 2) return { level: '부족', color: theme.palette.warning.main, sort: ratio };
    return { level: '충분', color: theme.palette.success.main, sort: ratio };
  };
  // 급한(현재고 적은) 순으로 상단 정렬
  const sortedRows = [...rows].sort((a, b) => urgencyOf(a.quantity, a.minThreshold).sort - urgencyOf(b.quantity, b.minThreshold).sort);

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 메뉴별 식자재 구성 */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>메뉴별 식자재 구성</Typography>

        {/* 메뉴 선택 버튼 */}
        <Stack direction="row" gap={1} flexWrap="wrap" mb={2.5}>
          {menus.length === 0 ? (
            <Typography variant="body2" color="text.secondary">등록된 메뉴가 없습니다.</Typography>
          ) : (
            menus.map((menu) => (
              <Chip
                key={menu.id}
                label={menu.menuName}
                onClick={() => handleSelectMenu(menu)}
                color={selectedMenu?.id === menu.id ? 'primary' : 'default'}
                variant={selectedMenu?.id === menu.id ? 'filled' : 'outlined'}
                sx={{ fontWeight: selectedMenu?.id === menu.id ? 700 : 400, cursor: 'pointer' }}
              />
            ))
          )}
        </Stack>

        {/* 선택된 메뉴의 식자재 목록 */}
        {selectedMenu && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle1" fontWeight={700}>
                {selectedMenu.menuName} 식자재 목록
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<IconifyIcon icon="mingcute:add-line" />}
                onClick={() => setShowForm((v) => !v)}
              >
                식자재 추가
              </Button>
            </Stack>

            {/* 추가 폼 */}
            {showForm && (
              <Box
                component="form"
                onSubmit={handleAddIngredient}
                sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems="flex-end">
                  <TextField
                    select label="식자재 선택" size="small" required
                    value={form.ingredientId}
                    onChange={(e) => handleIngredientSelect(e.target.value)}
                    sx={{ minWidth: 160 }}
                  >
                    {allIngredients.map((ing) => (
                      <MenuItem key={ing.id} value={String(ing.id)}>
                        {ing.name} ({ing.unit})
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="1개당 사용량" size="small" type="number" required
                    value={form.qtyPerUnit}
                    onChange={(e) => setForm((p) => ({ ...p, qtyPerUnit: e.target.value }))}
                    sx={{ width: 140 }}
                    inputProps={{ step: '0.01', min: '0' }}
                  />
                  {form.unit && (
                    <Chip label={form.unit} size="small" color="primary" variant="outlined"
                      sx={{ height: 40, px: 0.5, fontSize: 13, fontWeight: 700 }} />
                  )}
                  <Button
                    type="submit" variant="contained" size="medium"
                    disabled={submitting}
                    startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
                  >
                    추가
                  </Button>
                  <Button size="medium" onClick={() => setShowForm(false)}>취소</Button>
                </Stack>
              </Box>
            )}

            {/* 식자재 테이블 */}
            {loadingMI ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : menuIngredients.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                등록된 식자재가 없습니다. "식자재 추가" 버튼으로 연결하세요.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>식자재명</TableCell>
                      <TableCell align="right">1개당 사용량</TableCell>
                      <TableCell>단위</TableCell>
                      <TableCell align="center">삭제</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {menuIngredients.map((mi) => (
                      <TableRow key={mi.id} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{mi.ingredient.name}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} color="primary.main">{mi.qtyPerUnit}</Typography>
                        </TableCell>
                        <TableCell>{mi.unit}</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => handleDelete(mi.id)}>
                            <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {!selectedMenu && menus.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            위에서 메뉴를 선택하면 해당 메뉴의 식자재 구성이 표시됩니다.
          </Typography>        )}
      </Paper>

      {/* 전체 재고 현황 */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>전체 재고 현황</Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<IconifyIcon icon="mingcute:delete-2-line" />}
            onClick={handleClearInventory}
            sx={{ px: 3, borderRadius: 2 }}
          >
            전체 삭제
          </Button>
        </Stack>
        {loadingInventory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : sortedRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>등록된 재고가 없습니다.</Typography>
        ) : (
          // 급한 재고일수록 상단 · 색상으로 긴급도 표현 (스크롤바 숨김)
          <Box
            sx={{
              maxHeight: 480, overflowY: 'auto',
              scrollbarWidth: 'none', msOverflowStyle: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <Stack gap={1}>
              {sortedRows.map((row) => {
                const u = urgencyOf(row.quantity, row.minThreshold);
                return (
                  <Stack
                    key={row.id}
                    direction="row"
                    alignItems="center"
                    gap={2}
                    sx={{
                      p: 1.8, borderRadius: 2,
                      border: `1px solid ${theme.palette.divider}`,
                      borderLeft: `5px solid ${u.color}`,
                      bgcolor: `${u.color}0d`,   // 아주 옅은 긴급도 색 배경
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>{row.name}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography fontWeight={800} fontSize={17} sx={{ color: u.color, lineHeight: 1.1 }}>
                        {row.quantity}<Box component="span" sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary', ml: 0.3 }}>{row.unit}</Box>
                      </Typography>
                      <Typography variant="caption" color="text.disabled">최소 {row.minThreshold}{row.unit}</Typography>
                    </Box>
                    <Chip
                      label={u.level}
                      size="small"
                      sx={{ fontWeight: 800, minWidth: 56, color: '#fff', bgcolor: u.color }}
                    />
                  </Stack>
                );
              })}
            </Stack>
          </Box>
        )}
      </Paper>    </Stack>
  );
};

export default Inventory;
