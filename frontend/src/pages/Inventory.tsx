<<<<<<< HEAD
import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, IconButton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Divider, Popover, Dialog, DialogTitle, DialogContent, DialogActions,
=======
import { useEffect, useRef, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, InputAdornment,
  IconButton, Tooltip,
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
<<<<<<< HEAD
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
=======
import { api } from '../services/api';
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';

interface InventoryRow {
  id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  totalPrice: number;
  expiryDate: string;
  registeredAt: string;
}

const TODAY = new Date().toISOString().split('T')[0];

const Inventory = ({ user }: any) => {
<<<<<<< HEAD
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
=======
  const [rows, setRows]       = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);

  /* ── 재고 등록 ── */
  const [openRegister, setOpenRegister] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [regError, setRegError]         = useState('');
  const [regForm, setRegForm] = useState({
    ingredientName: '',
    unit: '',
    quantity: '',
    price: '',
    expiryDate: '',
  });

  /* 유통기한 — 년/월/일 분리 입력 */
  const [expiry, setExpiry] = useState({ year: '', month: '', day: '' });
  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef   = useRef<HTMLInputElement>(null);

  const handleExpiryChange = (field: 'year' | 'month' | 'day', val: string) => {
    const num = val.replace(/\D/g, '');
    const updated = { ...expiry, [field]: num };
    setExpiry(updated);

    if (field === 'year'  && num.length === 4) monthRef.current?.focus();
    if (field === 'month' && num.length === 2) dayRef.current?.focus();

    const y = field === 'year'  ? num : updated.year;
    const m = field === 'month' ? num : updated.month;
    const d = field === 'day'   ? num : updated.day;

    if (y.length === 4 && m.length >= 1 && d.length >= 1) {
      setRegForm(prev => ({
        ...prev,
        expiryDate: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
      }));
    } else {
      setRegForm(prev => ({ ...prev, expiryDate: '' }));
    }
  };

  const resetExpiry = () => setExpiry({ year: '', month: '', day: '' });

  /* ── 재고 수정 ── */
  const [editTarget, setEditTarget] = useState<InventoryRow | null>(null);
  const [editQty, setEditQty]       = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  /* ── 삭제 확인 ── */
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null);
  const [deleting, setDeleting]         = useState(false);

  /* ── fetch ── */
  const fetchInventory = async (sid: number) => {
    setLoading(true);
    try {
      const inventory = await inventoryService.getByStore(sid);
      const mapped = (inventory || []).map((item: any) => {
        const qty       = Number(item.currentQty ?? 0);
        const unitPrice = Number(item.price ?? 0);
        const raw       = item.registeredAt ?? item.updatedAt ?? '';
        return {
          id:           item.id,
          name:         item.ingredient?.name ?? '-',
          category:     item.ingredient?.category ?? '-',
          quantity:     qty,
          unit:         item.unit ?? item.ingredient?.unit ?? '개',
          price:        unitPrice,
          totalPrice:   unitPrice * qty,
          expiryDate:   item.expiryDate ?? '-',
          registeredAt: raw
            ? new Date(raw).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })
            : '-',
        };
      });
      mapped.sort((a, b) => b.id - a.id);
      setRows(mapped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const uid = user?.userId ?? user?.id;
      if (!uid) return;
      try {
        const stores = await storeService.getMyStores(uid);
        if (stores?.length > 0) {
          const sid = stores[0].id;
          setStoreId(sid);
          await fetchInventory(sid);
        } else setLoading(false);
      } catch (e) { setLoading(false); }
    };
    init();
  }, [user]);

  /* ── 등록 ── */
  const handleRegister = async () => {
    if (!storeId) return;
    if (!regForm.ingredientName.trim()) { setRegError('재고명을 입력해주세요.'); return; }
    if (!regForm.quantity || Number(regForm.quantity) <= 0) { setRegError('재고 개수를 입력해주세요.'); return; }
    if (!regForm.price || Number(regForm.price) < 0) { setRegError('재고 가격을 입력해주세요.'); return; }

    setSubmitting(true); setRegError('');
    try {
      await inventoryService.register(storeId, {
        ingredientName: regForm.ingredientName.trim(),
        quantity:   Number(regForm.quantity),
        price:      Number(regForm.price),
        expiryDate: regForm.expiryDate || undefined,
        unit:       regForm.unit.trim() || undefined,
      });
      setOpenRegister(false);
      setRegForm({ ingredientName: '', unit: '', quantity: '', price: '', expiryDate: '' });
      await fetchInventory(storeId);
    } catch (e: any) {
      setRegError('등록 실패: ' + (e.message ?? ''));
    } finally { setSubmitting(false); }
  };

  /* ── 수정 저장 ── */
  const handleEditSave = async () => {
    if (!editTarget || !storeId) return;
    setEditSaving(true);
    try {
      await inventoryService.update(editTarget.id, { quantity: editQty });
      setEditTarget(null);
      await fetchInventory(storeId);
    } catch (e) { console.error(e); }
    finally { setEditSaving(false); }
  };

  /* ── 삭제 ── */
  const handleDelete = async () => {
    if (!deleteTarget || !storeId) return;
    setDeleting(true);
    try {
      await api.delete(`/inventory/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchInventory(storeId);
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  /* ── 컬럼 정의 ── */
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: '재고명',
      flex: 1,
      minWidth: 160,
      renderCell: (p) => (
        /* 재고명: 굵고 크게 */
        <Typography
          fontWeight={700}
          fontSize="0.95rem"
          color="text.primary"
          sx={{ letterSpacing: '-0.2px' }}
        >
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'quantity',
      headerName: '재고 개수',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Chip
          label={`${p.value}개`}
          size="small"
          color={p.value <= 0 ? 'error' : 'default'}
          variant="outlined"
          sx={{ fontWeight: 700, color: 'text.primary', borderColor: 'divider' }}
        />
      ),
    },
    {
      field: 'unit',
      headerName: '1개 단위',
      width: 90,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {p.value || '-'}
        </Typography>
      ),
    },
    {
      field: 'price',
      headerName: '단가',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary">
          {p.value > 0 ? `${Number(p.value).toLocaleString('ko-KR')}원` : '-'}
        </Typography>
      ),
    },
    {
      field: 'totalPrice',
      headerName: '총 가격',
      width: 130,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={700} color="primary.dark">
          {p.value > 0 ? `${Number(p.value).toLocaleString('ko-KR')}원` : '-'}
        </Typography>
      ),
    },
    {
      field: 'registeredAt',
      headerName: '등록일',
      width: 200,   /* ← 날짜 잘리지 않게 넓게 */
      renderCell: (p) => (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'expiryDate',
      headerName: '유통기한',
      width: 150,
      renderCell: (p) => {
        if (!p.value || p.value === '-')
          return <Typography variant="caption" color="text.disabled">-</Typography>;
        const expired = new Date(p.value) < new Date();
        return (
          <Chip
            label={p.value}
            size="small"
            color={expired ? 'error' : 'success'}
            variant="outlined"
            sx={{ fontSize: '0.72rem' }}
          />
        );
      },
    },
    /* 재고 수정 버튼 */
    {
      field: 'edit',
      headerName: '수정',
      width: 72,
      sortable: false,
      renderCell: (p) => (
        <Tooltip title="재고 수량 수정">
          <IconButton
            size="small"
            onClick={() => { setEditTarget(p.row as InventoryRow); setEditQty(p.row.quantity); }}
            sx={{
              width: 34, height: 34,
              border: '1.5px solid #2E7D32',
              borderRadius: 1.5,
              bgcolor: 'white',
              '&:hover': { bgcolor: '#f1f8e9' },
            }}
          >
            {/* 아이콘 색상 명시 — 검정에 가까운 진한 초록 */}
            <IconifyIcon icon="mingcute:edit-line" width={16} height={16} sx={{ color: '#1B5E20' }} />
          </IconButton>
        </Tooltip>
      ),
    },
    /* 삭제 버튼 */
    {
      field: 'delete',
      headerName: '삭제',
      width: 72,
      sortable: false,
      renderCell: (p) => (
        <Tooltip title="재고 삭제">
          <IconButton
            size="small"
            onClick={() => setDeleteTarget(p.row as InventoryRow)}
            sx={{
              width: 34, height: 34,
              border: '1.5px solid #D32F2F',
              borderRadius: 1.5,
              bgcolor: 'white',
              '&:hover': { bgcolor: '#ffebee' },
            }}
          >
            {/* 아이콘 색상 명시 — 빨간색 */}
            <IconifyIcon icon="mingcute:delete-2-line" width={16} height={16} sx={{ color: '#D32F2F' }} />
          </IconButton>
        </Tooltip>
      ),
    },
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
  ];

  /* ───────────────── RENDER ───────────────── */
  return (
<<<<<<< HEAD
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
=======
    <Stack gap={4}>
      {/* 헤더 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={700} color="text.primary">재고 현황</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            총 {rows.length}개 품목 등록됨
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<IconifyIcon icon="mingcute:add-line" />}
          onClick={() => {
            setRegError('');
            setRegForm({ ingredientName: '', unit: '', quantity: '', price: '', expiryDate: '' });
            resetExpiry();
            setOpenRegister(true);
          }}
          sx={{ px: 3, py: 1.2 }}
        >
          재고 등록
        </Button>
      </Stack>

      {/* 목록 */}
      <Paper sx={{ height: 620, width: '100%', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 2 }}>
            <IconifyIcon icon="mingcute:inventory-line" width={64} height={64} sx={{ color: 'text.disabled' }} />
            <Typography color="text.secondary">등록된 재고가 없습니다. 재고 등록 버튼을 눌러 추가하세요.</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
<<<<<<< HEAD
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
=======
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 20]}
            sx={{ border: 'none' }}
          />
        )}
      </Paper>

      {/* ════ 재고 등록 다이얼로그 ════ */}
      <Dialog open={openRegister} onClose={() => !submitting && setOpenRegister(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:add-circle-fill" sx={{ color: 'primary.main' }} />
            재고 등록
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2.5} mt={1}>
            {regError && <Alert severity="error">{regError}</Alert>}

            {/* 재고명 + 1개 단위 (같은 줄) */}
            <Stack direction="row" gap={1.5} alignItems="flex-start">
              <TextField
                label="재고명 *"
                fullWidth
                value={regForm.ingredientName}
                onChange={(e) => setRegForm({ ...regForm, ingredientName: e.target.value })}
                placeholder="예: 밀가루, 참기름"
              />
              <TextField
                label="1개 단위"
                sx={{ minWidth: 120 }}
                value={regForm.unit}
                onChange={(e) => setRegForm({ ...regForm, unit: e.target.value })}
                placeholder="kg, L, g…"
                helperText={regForm.unit ? `1개 = ${regForm.unit}` : '예: 1kg, 500ml'}
              />
            </Stack>

            {/* 재고 개수 — 순수 숫자만 */}
            <TextField
              label="재고 개수 *"
              type="number"
              fullWidth
              value={regForm.quantity}
              onChange={(e) => setRegForm({ ...regForm, quantity: e.target.value })}
              inputProps={{ min: 0, step: 1 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">개</InputAdornment>,
              }}
              helperText={
                regForm.quantity && regForm.unit
                  ? `총 ${regForm.quantity}개 (1개 = ${regForm.unit})`
                  : regForm.quantity
                  ? `${regForm.quantity}개`
                  : ' '
              }
            />

            {/* 단가 */}
            <TextField
              label="재고 1개 가격 *"
              type="number"
              fullWidth
              value={regForm.price}
              onChange={(e) => setRegForm({ ...regForm, price: e.target.value })}
              inputProps={{ min: 0, step: 100 }}
              InputProps={{
                endAdornment: <InputAdornment position="end">원</InputAdornment>,
              }}
              helperText={
                regForm.quantity && regForm.price
                  ? `총 가격: ${(Number(regForm.quantity) * Number(regForm.price)).toLocaleString('ko-KR')}원`
                  : ' '
              }
            />

            {/* 유통기한 — 년/월/일 박스 입력 */}
            <Box>
              <Typography variant="caption" color="text.secondary" mb={1} display="block">
                유통기한
              </Typography>
              <Stack direction="row" alignItems="center" gap={1}>

                {/* 년 */}
                <TextField
                  value={expiry.year}
                  onChange={(e) => handleExpiryChange('year', e.target.value)}
                  inputProps={{ maxLength: 4, style: { textAlign: 'center', fontWeight: 600 } }}
                  sx={{ width: 82 }}
                  size="small"
                />
                <Typography fontWeight={600} color="text.secondary">년</Typography>

                {/* 월 */}
                <TextField
                  value={expiry.month}
                  onChange={(e) => handleExpiryChange('month', e.target.value)}
                  inputProps={{ maxLength: 2, style: { textAlign: 'center', fontWeight: 600 }, ref: monthRef }}
                  sx={{ width: 62 }}
                  size="small"
                />
                <Typography fontWeight={600} color="text.secondary">월</Typography>

                {/* 일 */}
                <TextField
                  value={expiry.day}
                  onChange={(e) => handleExpiryChange('day', e.target.value)}
                  inputProps={{ maxLength: 2, style: { textAlign: 'center', fontWeight: 600 }, ref: dayRef }}
                  sx={{ width: 62 }}
                  size="small"
                />
                <Typography fontWeight={600} color="text.secondary">일</Typography>

                {/* 입력 완료 시 날짜 미리보기 */}
                {regForm.expiryDate && (
                  <Chip
                    label={regForm.expiryDate}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ ml: 1, fontWeight: 600 }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setOpenRegister(false)} disabled={submitting} color="inherit">취소</Button>
          <Button
            variant="contained"
            onClick={handleRegister}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : <IconifyIcon icon="mingcute:check-fill" />}
          >
            {submitting ? '등록 중...' : '등록'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ 재고 수정 다이얼로그 ════ */}
      <Dialog open={!!editTarget} onClose={() => !editSaving && setEditTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:edit-fill" sx={{ color: 'primary.main' }} />
            재고 수량 수정
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={3} mt={1} alignItems="center">
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              {editTarget?.name}
              {editTarget?.unit && (
                <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                  (1개 = {editTarget.unit})
                </Typography>
              )}
            </Typography>

            {/* +  /  - */}
            <Stack direction="row" alignItems="center" gap={2}>
              <IconButton
                size="large"
                onClick={() => setEditQty((q) => Math.max(0, q - 1))}
                sx={{
                  width: 52, height: 52,
                  border: '2px solid #D32F2F',
                  borderRadius: 2,
                  bgcolor: 'white',
                  '&:hover': { bgcolor: '#ffebee' },
                }}
              >
                <Typography variant="h5" fontWeight={900} sx={{ color: '#D32F2F', lineHeight: 1, userSelect: 'none' }}>
                  −
                </Typography>
              </IconButton>

              <TextField
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(Math.max(0, Number(e.target.value)))}
                inputProps={{ min: 0, style: { textAlign: 'center', fontSize: '1.6rem', fontWeight: 700, width: 80 } }}
                variant="outlined"
                sx={{ '& input': { p: 1.5 } }}
              />

              <IconButton
                size="large"
                onClick={() => setEditQty((q) => q + 1)}
                sx={{
                  width: 52, height: 52,
                  border: '2px solid #2E7D32',
                  borderRadius: 2,
                  bgcolor: 'white',
                  '&:hover': { bgcolor: '#f1f8e9' },
                }}
              >
                <Typography variant="h5" fontWeight={900} sx={{ color: '#2E7D32', lineHeight: 1, userSelect: 'none' }}>
                  +
                </Typography>
              </IconButton>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              기존 수량: {editTarget?.quantity}개
            </Typography>

            {/* 빠른 조정 */}
            <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center">
              {[-10, -5, -1, +1, +5, +10].map((d) => (
                <Button
                  key={d}
                  size="small"
                  variant="outlined"
                  color={d < 0 ? 'error' : 'primary'}
                  onClick={() => setEditQty((q) => Math.max(0, q + d))}
                  sx={{ minWidth: 52, fontSize: '0.75rem' }}
                >
                  {d > 0 ? `+${d}` : d}
                </Button>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEditTarget(null)} disabled={editSaving} color="inherit">취소</Button>
          <Button
            variant="contained"
            onClick={handleEditSave}
            disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={16} /> : <IconifyIcon icon="mingcute:check-fill" />}
          >
            {editSaving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ════ 삭제 확인 ════ */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:alert-fill" sx={{ color: 'error.main' }} />
            재고 삭제
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography color="text.primary">
            <strong>{deleteTarget?.name}</strong> 재고를 삭제하시겠습니까?
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            삭제 후에는 복구할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} color="inherit">취소</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <IconifyIcon icon="mingcute:delete-2-fill" />}
          >
            {deleting ? '삭제 중...' : '삭제'}
>>>>>>> 233f87c (feat: CRUD 완성 및 FoodGuard UI 전면 개선)
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Inventory;
