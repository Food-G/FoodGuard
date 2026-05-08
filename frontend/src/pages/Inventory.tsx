import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack, useTheme, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { inventoryService } from '../services/inventoryService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

const emptyForm = {
  ingredientName: '',
  currentStock: '',
  thresholdStock: '',
  unit: '',
};

const Inventory = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);

  // 등록 모달
  const [openCreate, setOpenCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  // 수정 모달
  const [openUpdate, setOpenUpdate] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [updateQuantity, setUpdateQuantity] = useState('');

  // 삭제 확인 모달
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // 데이터 불러오기
  const fetchData = useCallback(async () => {
    try {
      if (user?.id) {
        const stores = await storeService.getMyStores(user.id);
        if (stores && stores.length > 0) {
          const sid = stores[0].id;
          setStoreId(sid);
          const inventory = await inventoryService.getByStore(sid);
          setRows(
              inventory.map((item: any) => ({
                id: item.id,
                name: item.ingredientName ?? '-',
                category: '-',
                quantity: item.currentStock,
                thresholdStock: item.thresholdStock,
                unit: item.unit,
                updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-',
                isLow: item.thresholdStock != null && Number(item.currentStock) <= Number(item.thresholdStock),
              }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 등록
  const handleCreate = async () => {
    if (!storeId) return;
    try {
      await inventoryService.create({
        storeId,
        ingredientName: createForm.ingredientName,
        currentStock: Number(createForm.currentStock),
        thresholdStock: createForm.thresholdStock ? Number(createForm.thresholdStock) : null,
        unit: createForm.unit,
      });
      setOpenCreate(false);
      setCreateForm(emptyForm);
      setLoading(true);
      await fetchData();
    } catch (error) {
      console.error('재고 등록 실패:', error);
    }
  };

  // 수정 모달 오픈
  const handleOpenUpdate = (id: number, currentQty: number) => {
    setSelectedId(id);
    setUpdateQuantity(String(currentQty));
    setOpenUpdate(true);
  };

  // 수정 확인
  const handleUpdate = async () => {
    if (selectedId === null) return;
    try {
      await inventoryService.update(selectedId, { currentStock: Number(updateQuantity), wasteQuantity: 0 });
      setOpenUpdate(false);
      setSelectedId(null);
      setLoading(true);
      await fetchData();
    } catch (error) {
      console.error('재고 수정 실패:', error);
    }
  };

  // 삭제 모달 오픈
  const handleOpenDelete = (id: number) => {
    setDeleteId(id);
    setOpenDelete(true);
  };

  // 삭제 확인
  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await inventoryService.delete(deleteId);
      setOpenDelete(false);
      setDeleteId(null);
      setLoading(true);
      await fetchData();
    } catch (error) {
      console.error('재고 삭제 실패:', error);
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 200 },
    {
      field: 'category',
      headerName: '분류',
      width: 150,
      renderCell: (params) => (
          <Chip label={params.value} size="small" variant="outlined" color="primary" />
      ),
    },
    {
      field: 'quantity',
      headerName: '현재고',
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
          <Typography
              variant="body2"
              color={params.row.isLow ? 'error' : 'text.primary'}
              fontWeight={params.row.isLow ? 700 : 400}
          >
            {params.value} {params.row.isLow ? '⚠️' : ''}
          </Typography>
      ),
    },
    { field: 'unit', headerName: '단위', width: 100 },
    { field: 'updatedAt', headerName: '최근 업데이트', width: 200 },
    {
      field: 'actions',
      headerName: '관리',
      width: 120,
      sortable: false,
      renderCell: (params) => (
          <Stack direction="row" gap={1}>
            <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenUpdate(params.row.id, params.row.quantity)}
            >
              <IconifyIcon icon="mingcute:edit-line" />
            </IconButton>
            <IconButton
                size="small"
                color="error"
                onClick={() => handleOpenDelete(params.row.id)}
            >
              <IconifyIcon icon="mingcute:delete-line" />
            </IconButton>
          </Stack>
      ),
    },
  ];

  return (
      <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
        {/* 헤더 */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
            <Typography variant="h5" color="text.secondary" fontWeight={600}>실시간 자원 및 재고 현황</Typography>
          </Box>
          <Button
              variant="contained"
              startIcon={<IconifyIcon icon="mingcute:add-line" />}
              sx={{ px: 4, py: 1.5, borderRadius: 3 }}
              onClick={() => setOpenCreate(true)}
          >
            재고 등록
          </Button>
        </Stack>

        {/* 테이블 */}
        <Paper sx={{ height: 650, width: '100%', p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
          {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress color="primary" />
              </Box>
          ) : (
              <DataGrid
                  rows={rows}
                  columns={columns}
                  disableRowSelectionOnClick
                  initialState={{
                    pagination: { paginationModel: { pageSize: 10 } },
                  }}
                  pageSizeOptions={[10, 20]}
                  sx={{
                    border: 'none',
                    '& .MuiDataGrid-columnHeaders': {
                      bgcolor: 'primary.light',
                      color: 'primary.dark',
                      fontWeight: 700,
                    },
                    '& .MuiDataGrid-cell:focus': {
                      outline: 'none',
                    },
                  }}
              />
          )}
        </Paper>

        {/* 등록 모달 */}
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
          <DialogTitle>재고 등록</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField
                  label="식자재명 (예: 돼지고기)"
                  value={createForm.ingredientName}
                  onChange={(e) => setCreateForm({ ...createForm, ingredientName: e.target.value })}
                  fullWidth
              />
              <TextField
                  label="현재 재고"
                  type="number"
                  value={createForm.currentStock}
                  onChange={(e) => setCreateForm({ ...createForm, currentStock: e.target.value })}
                  fullWidth
              />
              <TextField
                  label="발주 기준 재고 (선택)"
                  type="number"
                  value={createForm.thresholdStock}
                  onChange={(e) => setCreateForm({ ...createForm, thresholdStock: e.target.value })}
                  fullWidth
              />
              <TextField
                  label="단위 (예: kg, box)"
                  value={createForm.unit}
                  onChange={(e) => setCreateForm({ ...createForm, unit: e.target.value })}
                  fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreate(false)}>취소</Button>
            <Button variant="contained" onClick={handleCreate}>등록</Button>
          </DialogActions>
        </Dialog>

        {/* 수정 모달 */}
        <Dialog open={openUpdate} onClose={() => setOpenUpdate(false)} fullWidth maxWidth="xs">
          <DialogTitle>재고 수량 수정</DialogTitle>
          <DialogContent>
            <Stack gap={2} mt={1}>
              <TextField
                  label="수량"
                  type="number"
                  value={updateQuantity}
                  onChange={(e) => setUpdateQuantity(e.target.value)}
                  fullWidth
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenUpdate(false)}>취소</Button>
            <Button variant="contained" onClick={handleUpdate}>수정</Button>
          </DialogActions>
        </Dialog>

        {/* 삭제 확인 모달 */}
        <Dialog open={openDelete} onClose={() => setOpenDelete(false)} fullWidth maxWidth="xs">
          <DialogTitle>재고 삭제</DialogTitle>
          <DialogContent>
            <Typography>해당 재고 항목을 삭제할까요?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDelete(false)}>취소</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>삭제</Button>
          </DialogActions>
        </Dialog>
      </Stack>
  );
};

export default Inventory;
