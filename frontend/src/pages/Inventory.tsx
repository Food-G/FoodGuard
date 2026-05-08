import { useEffect, useRef, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Chip, Alert, InputAdornment,
  IconButton, Tooltip,} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import { api } from '../services/api';import IconifyIcon from '../components/base/IconifyIcon';
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
    },  ];

  /* ───────────────── RENDER ───────────────── */
  return (
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
            <CircularProgress />          </Box>
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
            {deleting ? '삭제 중...' : '삭제'}          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Inventory;
