import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, IconButton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
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

  const columns: GridColDef[] = [
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    {
      field: 'category', headerName: '분류', width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" color="primary" />
      ),
    },
    { field: 'quantity', headerName: '현재고', width: 150, align: 'right', headerAlign: 'right' },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 250 },
    {
      field: 'actions', headerName: '', width: 100, sortable: false, align: 'center',
      renderCell: (params) => (
        <Button
          size="small"
          color="error"
          onClick={() => { setWasteForm({ quantity: '', reason: 'EXPIRED' }); setWasteTarget(params.row); }}
        >
          폐기
        </Button>
      ),
    },
  ];
  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {storeId && <WatchdogCard storeId={storeId} refreshKey={watchKey} />}

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="outlined" disabled={!storeId} startIcon={<IconifyIcon icon="mingcute:camera-line" />} onClick={() => setInvoiceOpen(true)}>
          거래명세서로 입고 (AI)
        </Button>
      </Stack>
      {storeId && (
        <InvoiceImportDialog open={invoiceOpen} storeId={storeId} ingredients={allIngredients} onClose={() => setInvoiceOpen(false)}
          onSaved={() => { loadInventory(storeId); setWatchKey((k) => k + 1); setSuccess('거래명세서 품목을 재고에 반영했습니다.'); }} />
      )}

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
        <Box sx={{ height: 420 }}>
          {loadingInventory ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress color="primary" />
            </Box>
          ) : (
            <DataGrid
              rows={rows}
              columns={columns}
              disableRowSelectionOnClick
              initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
              pageSizeOptions={[10, 20]}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': { bgcolor: 'primary.light', color: 'primary.dark', fontWeight: 700 },
                '& .MuiDataGrid-cell:focus': { outline: 'none' },
              }}
            />
          )}
        </Box>
      </Paper>

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
