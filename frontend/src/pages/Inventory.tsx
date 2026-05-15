import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, IconButton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Popover, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';

const Inventory = ({ user }: any) => {
  const theme = useTheme();

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

  // 식자재 관리 CRUD — 발주/등록 단위
  const UNIT_OPTIONS = ['kg', 'L', '개'];
  // 발주 단위 → 레시피 소단위 변환
  const toRecipeUnit = (base: string) => base === 'kg' ? 'g' : base === 'L' ? 'ml' : '개';
  const [showIngForm, setShowIngForm] = useState(false);
  const [ingForm, setIngForm] = useState({ name: '', unit: '' });
  const [editingIng, setEditingIng] = useState<any | null>(null);
  const [ingSubmitting, setIngSubmitting] = useState(false);
  const [ingUnitAnchor, setIngUnitAnchor] = useState<HTMLElement | null>(null);
  const [editUnitAnchor, setEditUnitAnchor] = useState<HTMLElement | null>(null);

  // 재고 등록 다이얼로그
  const [stockDialog, setStockDialog] = useState(false);
  const [stockForm, setStockForm] = useState({ ingredientId: '', quantity: '' });
  const [stockSubmitting, setStockSubmitting] = useState(false);
  const [initLoading, setInitLoading] = useState(false);

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

  // 전체 재고 현황 30초마다 자동 동기화
  useEffect(() => {
    if (!storeId) return;
    const interval = setInterval(() => loadInventory(storeId), 30000);
    return () => clearInterval(interval);
  }, [storeId]);

  const loadInventory = (sid: number) => {
    setLoadingInventory(true);
    inventoryService.getByStore(sid).then((data: any[]) => {
      setRows((data ?? []).map((item: any) => ({
        id: item.id,
        ingredientId: item.ingredient?.id,
        name: item.ingredient?.name ?? '-',
        quantity: item.currentQty ?? item.quantity ?? 0,
        unit: item.ingredient?.unit ?? '',
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-',
      })));
    }).catch((e) => {
      console.error(e);
      setError('재고 목록을 불러오지 못했습니다.');
    }).finally(() => setLoadingInventory(false));
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
    if (!window.confirm('이 식자재 연결을 삭제하시겠습니까?')) return;
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

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingForm.name || !ingForm.unit) return;
    setIngSubmitting(true);
    setError('');
    try {
      await api.post('/ingredients', ingForm);
      setSuccess('식자재가 등록되었습니다.');
      setIngForm({ name: '', unit: '' });
      setShowIngForm(false);
      await loadAllIngredients();
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
      });
      setSuccess('식자재가 수정되었습니다.');
      setEditingIng(null);
      await loadAllIngredients();
    } catch {
      setError('식자재 수정에 실패했습니다.');
    } finally {
      setIngSubmitting(false);
    }
  };

  const handleDeleteIngredient = async (id: number, name: string) => {
    if (!window.confirm(`"${name}" 식자재를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/ingredients/${id}`);
      setSuccess('식자재가 삭제되었습니다.');
      await loadAllIngredients();
    } catch {
      setError('식자재 삭제에 실패했습니다.');
    }
  };

  const handleResetAll = async () => {
    if (!storeId) return;
    if (!window.confirm('전체 재고를 모두 삭제합니다. 계속하시겠습니까?')) return;
    try {
      await api.delete(`/inventory/store/${storeId}`);
      setSuccess('전체 재고가 초기화되었습니다.');
      loadInventory(storeId);
    } catch {
      setError('초기화에 실패했습니다.');
    }
  };

  const handleInitFromOrders = async () => {
    if (!storeId) return;
    if (!window.confirm('취소되지 않은 모든 발주 수량을 기존 재고에 더합니다. 계속하시겠습니까?')) return;
    setInitLoading(true);
    try {
      await api.post(`/orders/init-inventory/${storeId}`, {});
      setSuccess('발주 수량이 기존 재고에 반영되었습니다.');
      loadInventory(storeId);
    } catch {
      setError('재고 초기화에 실패했습니다.');
    } finally {
      setInitLoading(false);
    }
  };

  const handleCreateStock = async () => {
    if (!storeId || !stockForm.ingredientId || !stockForm.quantity) return;
    setStockSubmitting(true);
    try {
      const existing = rows.find((r) => String(r.ingredientId) === stockForm.ingredientId);
      if (existing) {
        await inventoryService.update(existing.id, { quantity: Number(stockForm.quantity) });
      } else {
        await inventoryService.create({
          storeId,
          ingredientId: Number(stockForm.ingredientId),
          quantity: Number(stockForm.quantity),
        });
      }
      setSuccess('재고가 등록되었습니다.');
      setStockDialog(false);
      setStockForm({ ingredientId: '', quantity: '' });
      loadInventory(storeId);
    } catch {
      setError('재고 등록에 실패했습니다.');
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleIngredientSelect = (ingredientId: string) => {
    const ing = allIngredients.find((i) => String(i.id) === ingredientId);
    setForm((prev) => ({ ...prev, ingredientId, unit: toRecipeUnit(ing?.unit ?? '') }));
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    {
      field: 'quantity', headerName: '현재고', width: 180, align: 'right', headerAlign: 'right',
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize={14}>
          {params.value} <span style={{ color: '#888', fontWeight: 400 }}>{params.row.unit}</span>
        </Typography>
      ),
    },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 250 },
  ];

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>실시간 자원 및 재고 현황</Typography>
        </Box>
      </Stack>

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
          </Typography>
        )}
      </Paper>

      {/* 식자재 관리 */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>식자재 관리</Typography>
          <Button
            size="small" variant="outlined"
            startIcon={<IconifyIcon icon="mingcute:add-line" />}
            onClick={() => { setShowIngForm((v) => !v); setEditingIng(null); }}
          >
            식자재 등록
          </Button>
        </Stack>

        {/* 등록 폼 */}
        {showIngForm && (
          <Box component="form" onSubmit={handleCreateIngredient}
            sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems="center">
              <TextField label="식자재명" size="small" required sx={{ flex: 2 }}
                value={ingForm.name} onChange={(e) => setIngForm((p) => ({ ...p, name: e.target.value }))} />
              <Button
                size="small" variant="outlined"
                endIcon={<IconifyIcon icon="mingcute:down-line" width={14} />}
                onClick={(e) => setIngUnitAnchor(e.currentTarget)}
                sx={{ minWidth: 100, justifyContent: 'space-between', color: ingForm.unit ? 'text.primary' : 'text.secondary' }}
              >
                {ingForm.unit || '단위 선택'}
              </Button>
              <Popover
                open={Boolean(ingUnitAnchor)}
                anchorEl={ingUnitAnchor}
                onClose={() => setIngUnitAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <Box sx={{ p: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', maxWidth: 220 }}>
                  {UNIT_OPTIONS.map((u) => (
                    <Chip
                      key={u} label={u} size="small" clickable
                      color={ingForm.unit === u ? 'primary' : 'default'}
                      variant={ingForm.unit === u ? 'filled' : 'outlined'}
                      onClick={() => { setIngForm((p) => ({ ...p, unit: u })); setIngUnitAnchor(null); }}
                      sx={{ fontWeight: ingForm.unit === u ? 700 : 400 }}
                    />
                  ))}
                </Box>
              </Popover>
              <Button type="submit" variant="contained" size="medium" disabled={ingSubmitting || !ingForm.unit}
                startIcon={ingSubmitting ? <CircularProgress size={14} color="inherit" /> : null}>
                등록
              </Button>
              <Button size="medium" onClick={() => setShowIngForm(false)}>취소</Button>
            </Stack>
          </Box>
        )}

        {/* 식자재 목록 테이블 */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>식자재명</TableCell>
                <TableCell>단위</TableCell>
                <TableCell align="center" width={120}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allIngredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      등록된 식자재가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : allIngredients.map((ing) => (
                <TableRow key={ing.id} hover>
                  {editingIng?.id === ing.id ? (
                    // 인라인 수정 행
                    <>
                      <TableCell>
                        <TextField size="small" value={editingIng.name} sx={{ width: 140 }}
                          onChange={(e) => setEditingIng((p: any) => ({ ...p, name: e.target.value }))} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small" variant="outlined"
                          endIcon={<IconifyIcon icon="mingcute:down-line" width={14} />}
                          onClick={(e) => setEditUnitAnchor(e.currentTarget)}
                          sx={{ minWidth: 90, justifyContent: 'space-between', color: editingIng.unit ? 'text.primary' : 'text.secondary' }}
                        >
                          {editingIng.unit || '단위'}
                        </Button>
                        <Popover
                          open={Boolean(editUnitAnchor)}
                          anchorEl={editUnitAnchor}
                          onClose={() => setEditUnitAnchor(null)}
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                          <Box sx={{ p: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', maxWidth: 220 }}>
                            {UNIT_OPTIONS.map((u) => (
                              <Chip
                                key={u} label={u} size="small" clickable
                                color={editingIng.unit === u ? 'primary' : 'default'}
                                variant={editingIng.unit === u ? 'filled' : 'outlined'}
                                onClick={() => { setEditingIng((p: any) => ({ ...p, unit: u })); setEditUnitAnchor(null); }}
                                sx={{ fontWeight: editingIng.unit === u ? 700 : 400 }}
                              />
                            ))}
                          </Box>
                        </Popover>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={0.5} justifyContent="center">
                          <Button size="small" variant="contained" disabled={ingSubmitting}
                            onClick={handleUpdateIngredient}>저장</Button>
                          <Button size="small" onClick={() => setEditingIng(null)}>취소</Button>
                        </Stack>
                      </TableCell>
                    </>
                  ) : (
                    // 일반 행
                    <>
                      <TableCell><Typography variant="body2" fontWeight={600}>{ing.name}</Typography></TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={0.5} justifyContent="center">
                          <IconButton size="small" color="primary"
                            onClick={() => { setEditingIng({ ...ing }); setShowIngForm(false); }}>
                            <IconifyIcon icon="mingcute:edit-2-line" width={17} />
                          </IconButton>
                          <IconButton size="small" color="error"
                            onClick={() => handleDeleteIngredient(ing.id, ing.name)}>
                            <IconifyIcon icon="mingcute:delete-2-line" width={17} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* 전체 재고 현황 */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>전체 재고 현황</Typography>
          <Stack direction="row" gap={1}>
            <Button
              variant="outlined" color="error"
              startIcon={<IconifyIcon icon="mingcute:delete-2-line" />}
              onClick={handleResetAll}
              sx={{ borderRadius: 2 }}
            >
              전체 초기화
            </Button>
            <Button
              variant="outlined" color="secondary"
              startIcon={initLoading ? <CircularProgress size={14} color="inherit" /> : <IconifyIcon icon="mingcute:refresh-2-line" />}
              disabled={initLoading}
              onClick={handleInitFromOrders}
              sx={{ borderRadius: 2 }}
            >
              발주 수량 재고 반영
            </Button>
            <Button
              variant="contained"
              startIcon={<IconifyIcon icon="mingcute:add-line" />}
              sx={{ borderRadius: 2 }}
              onClick={() => setStockDialog(true)}
            >
              재고 등록
            </Button>
          </Stack>
        </Stack>
        {loadingInventory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter
            autoHeight
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700 },
              '& .MuiDataGrid-cell:focus': { outline: 'none' },
            }}
          />
        )}
      </Paper>
      {/* 재고 등록 다이얼로그 */}
      <Dialog open={stockDialog} onClose={() => setStockDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>재고 등록</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              select label="식자재 선택" size="small" fullWidth required
              value={stockForm.ingredientId}
              onChange={(e) => setStockForm((p) => ({ ...p, ingredientId: e.target.value }))}
            >
              {allIngredients.map((ing) => (
                <MenuItem key={ing.id} value={String(ing.id)}>
                  {ing.name} ({ing.unit})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="수량" size="small" type="number" fullWidth required
              value={stockForm.quantity}
              onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))}
              inputProps={{ step: '0.01', min: '0' }}
              helperText="이미 등록된 식자재는 수량이 덮어씌워집니다."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStockDialog(false)} disabled={stockSubmitting}>취소</Button>
          <Button
            variant="contained"
            onClick={handleCreateStock}
            disabled={stockSubmitting || !stockForm.ingredientId || !stockForm.quantity}
            startIcon={stockSubmitting ? <CircularProgress size={14} color="inherit" /> : null}
          >
            등록
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Inventory;
