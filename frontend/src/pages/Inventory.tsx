import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, TextField, MenuItem, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { wastePredictionService } from '../services/wastePredictionService';
import ClearanceCard from '../components/agent/ClearanceCard';
import { errorText } from '../services/agentService';
import { storeService } from '../services/storeService';
import { menuIngredientService } from '../services/menuIngredientService';
import IngredientSuggestDialog from '../components/agent/IngredientSuggestDialog';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import InvoiceImportDialog from '../components/agent/InvoiceImportDialog';
import WatchdogCard from '../components/agent/WatchdogCard';

const Inventory = ({ user }: any) => {
  const theme = useTheme();
  const confirm = useConfirm();
  const navigate = useNavigate();

  // 재고 현황
  const [rows, setRows] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [watchKey, setWatchKey] = useState(0);

  const [suggestOpen, setSuggestOpen] = useState(false);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 폐기 기록 (실제 폐기량 → 폐기율 측정 기준)
  const [wasteTarget, setWasteTarget] = useState<any | null>(null);
  const [wasteForm, setWasteForm] = useState({ quantity: '', reason: 'EXPIRED' });

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (!stores?.length) return;
      const sid = stores[0].id;
      setStoreId(sid);
      loadInventory(sid);
      loadAllIngredients(sid);
    }).catch(console.error);
  }, [user]);

  const loadInventory = (sid: number) => {
    setLoadingInventory(true);
    // 재고 + 폐기 예측 (유통기한이 있는 재고만 예측이 있다)
    Promise.all([inventoryService.getByStore(sid), wastePredictionService.predict(sid), menuIngredientService.getByStore(sid)]).then(([data, waste, recipes]: any[]) => {
      const wasteById = new Map((waste ?? []).map((w: any) => [w.ingredientId, w]));
      const stocked = new Set((data ?? []).map((item: any) => item.ingredient?.id));
      // 레시피에는 있지만 아직 재고 기록이 없는 식자재도 보여 준다 (식자재 전체를 보는 곳이 이 화면이다)
      const noStock = new Map<number, any>();
      (recipes ?? []).forEach((r: any) => {
        if (!stocked.has(r.ingredientId) && !noStock.has(r.ingredientId)) {
          noStock.set(r.ingredientId, {
            id: `recipe-${r.ingredientId}`, ingredientId: r.ingredientId, name: r.ingredientName, quantity: 0, unit: r.baseUnit,
            expiryDate: null, daysUntilExpiry: null, expectedConsumption: null, plannedDonation: 0, wastePrediction: 0, wasteRate: null, noStock: true,
          });
        }
      });
      setRows([...(data ?? []).map((item: any) => {
        const w: any = wasteById.get(item.ingredient?.id);
        return {
          id: item.id,
          ingredientId: item.ingredient?.id,
          name: item.ingredient?.name ?? '',
          category: item.ingredient?.category ?? '',
          quantity: item.currentQty ?? item.quantity,
          unit: item.ingredient?.unit ?? '',
          expiryDate: item.expiryDate ?? null,
          daysUntilExpiry: w?.daysUntilExpiry ?? null,
          expectedConsumption: w?.expectedConsumption ?? null,
          plannedDonation: w?.plannedDonation ?? 0,
          wastePrediction: w?.wastePrediction ?? 0,
          wasteRate: w?.wasteRate ?? null,
        };
      }), ...noStock.values()]);
    }).catch(() => setError('재고를 불러오지 못했습니다.')).finally(() => setLoadingInventory(false));
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
      setWatchKey((k) => k + 1);
    } catch (e) {
      setError(errorText(e, '폐기 기록에 실패했습니다.'));
    }
  };

  const unit = (value: any, row: any) => <>{value} <span style={{ color: '#999' }}>{row.unit}</span></>;

  const columns: GridColDef[] = [
    { field: 'name', headerName: '식자재', flex: 1, minWidth: 130 },
    {
      field: 'quantity', headerName: '현재고', width: 110, align: 'right', headerAlign: 'right',
      renderCell: (p) => unit(p.value, p.row),
    },
    {
      field: 'expiryDate', headerName: '유통기한', width: 170,
      renderCell: (p) => {
        if (!p.value) return <Typography fontSize={13} color="text.disabled">미입력</Typography>;
        const days = p.row.daysUntilExpiry;
        // 지난 재고는 폐기 예측에서 빠진다
        if (days == null) return <Chip label={`${p.value} 지남`} color="error" size="small" />;
        return <Chip label={`${p.value} (D-${days})`} color={days <= 3 ? 'error' : days <= 7 ? 'warning' : 'default'} size="small" variant="outlined" />;
      },
    },
    {
      field: 'expectedConsumption', headerName: '소비 예상', width: 100, align: 'right', headerAlign: 'right',
      renderCell: (p) => (p.value == null ? '-' : unit(p.value, p.row)),
    },
    {
      field: 'plannedDonation', headerName: '기부 예정', width: 100, align: 'right', headerAlign: 'right',
      renderCell: (p) => (p.value > 0 ? unit(p.value, p.row) : '-'),
    },
    {
      field: 'wastePrediction', headerName: '폐기 예측', width: 110, align: 'right', headerAlign: 'right',
      renderCell: (p) => (p.row.wasteRate == null ? '-' : (
        <Typography fontSize={13} fontWeight={700} color={p.value > 0 ? 'error.main' : 'success.main'} lineHeight="inherit">{p.value} {p.row.unit}</Typography>
      )),
    },
    {
      field: 'wasteRate', headerName: '폐기율', width: 90, align: 'center', headerAlign: 'center',
      renderCell: (p) => (p.value == null ? '-' : (
        <Chip label={`${p.value}%`} size="small" color={p.value > 50 ? 'error' : p.value > 20 ? 'warning' : 'success'} sx={{ fontWeight: 700 }} />
      )),
    },
    {
      field: 'actions', headerName: '처리', width: 130, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (params) => (
        <>
          {!params.row.noStock && <Button size="small" color="error" onClick={() => { setWasteForm({ quantity: '', reason: 'EXPIRED' }); setWasteTarget(params.row); }}>폐기</Button>}
          {params.row.wastePrediction > 0 && (
            <Button size="small" color="secondary" onClick={() => navigate('/donations', { state: { ingredientId: params.row.ingredientId } })}>기부</Button>
          )}
        </>
      ),
    },
  ];

  const wasteCount = rows.filter((r) => r.wastePrediction > 0).length;

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {storeId && <WatchdogCard storeId={storeId} refreshKey={watchKey} />}
      {storeId && <ClearanceCard storeId={storeId} refreshKey={watchKey} />}

      {storeId && (
        <InvoiceImportDialog open={invoiceOpen} storeId={storeId} ingredients={allIngredients} onClose={() => setInvoiceOpen(false)}
          onSaved={() => { loadInventory(storeId); setWatchKey((k) => k + 1); setSuccess('거래명세서 품목을 재고에 반영했습니다.'); }} />
      )}

      {/* 전체 재고 현황 */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack>
            <Typography variant="h6" fontWeight={700}>재고·폐기 예측</Typography>
            {wasteCount > 0 && <Typography variant="body2" color="error.main">{wasteCount}개 식자재가 기한까지 다 쓰이지 못할 것으로 예측됩니다.</Typography>}
          </Stack>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" disabled={!storeId} startIcon={<IconifyIcon icon="mingcute:sparkles-line" />} onClick={() => setSuggestOpen(true)}>
              AI 설정 제안
            </Button>
            <Button variant="outlined" disabled={!storeId} startIcon={<IconifyIcon icon="mingcute:camera-line" />} onClick={() => setInvoiceOpen(true)}>
              거래명세서로 입고 (AI)
            </Button>
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

      {storeId && (
        <IngredientSuggestDialog open={suggestOpen} storeId={storeId} ingredients={allIngredients} onClose={() => setSuggestOpen(false)}
          onSaved={() => { loadAllIngredients(storeId); setSuccess('확인한 설정을 저장했습니다.'); }} />
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
