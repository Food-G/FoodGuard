import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, Stack, useTheme, Chip, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { donationService } from '../services/donationService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';

const STATUS_LABEL: Record<string, string> = {
  PLANNED: '기부 예정',
  COMPLETED: '기부 완료',
  CANCELLED: '취소됨',
};
const STATUS_COLOR: Record<string, any> = {
  PLANNED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};
const ORG_TYPE_LABEL: Record<string, string> = {
  ORPHANAGE: '고아원',
  NURSING_HOME: '양로원',
  FOOD_BANK: '푸드뱅크',
  OTHER: '기타',
};
const DONATION_TYPE_LABEL: Record<string, string> = {
  FOOD: '음식',
  INGREDIENT: '식재료',
};

const DonationHistory = ({ user }: any) => {
  const theme = useTheme();
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (sid: number) => {
    try {
      const data = await donationService.getByStore(sid);
      setRows((data ?? []).map((item: any) => ({ ...item, id: item.id })));
    } catch {
      setError('기부 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    load(storeId);
  }, [storeId, storeLoading]);

  const handleComplete = async (id: number) => {
    try {
      await donationService.complete(id);
      setSuccess('기부가 완료 처리되었습니다. 재고에서 차감되었습니다.');
      if (storeId) await load(storeId);
    } catch {
      setError('완료 처리에 실패했습니다.');
    }
  };

  const handleCancel = async (id: number) => {
    if (!await confirm('기부를 취소하시겠습니까?')) return;
    try {
      await donationService.cancel(id);
      setSuccess('기부가 취소되었습니다.');
      if (storeId) await load(storeId);
    } catch {
      setError('취소 처리에 실패했습니다.');
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'createdAt', headerName: '등록일', width: 160,
      renderCell: (p) => p.value ? new Date(p.value).toLocaleDateString() : '-',
    },
    { field: 'ingredientName', headerName: '식재료', width: 120, renderCell: (p) => p.value ?? '-' },
    {
      field: 'donationType', headerName: '기부 유형', width: 100,
      renderCell: (p) => <Chip label={DONATION_TYPE_LABEL[p.value] ?? p.value} size="small" variant="outlined" />,
    },
    {
      field: 'orgType', headerName: '기관 유형', width: 100,
      renderCell: (p) => <Typography fontSize={13}>{ORG_TYPE_LABEL[p.value] ?? p.value}</Typography>,
    },
    { field: 'orgName', headerName: '기관명', flex: 1, minWidth: 120 },
    {
      field: 'quantity', headerName: '수량', width: 100, align: 'right', headerAlign: 'right',
      renderCell: (p) => p.value ? (
        <Typography fontSize={13}>{p.value} <span style={{ color: '#999' }}>{p.row.unit}</span></Typography>
      ) : '-',
    },
    {
      field: 'status', headerName: '상태', width: 110,
      renderCell: (p) => (
        <Chip label={STATUS_LABEL[p.value] ?? p.value} color={STATUS_COLOR[p.value] ?? 'default'}
          size="small" variant="filled" sx={{ fontWeight: 700 }} />
      ),
    },
    {
      field: 'actions', headerName: '처리', width: 160, sortable: false,
      renderCell: (p) => p.row.status === 'PLANNED' ? (
        <Stack direction="row" gap={0.5}>
          <Button variant="contained" color="success" size="small"
            onClick={() => handleComplete(p.row.id)} sx={{ borderRadius: 2, fontSize: 11 }}>
            완료
          </Button>
          <Button variant="outlined" color="error" size="small"
            onClick={() => handleCancel(p.row.id)} sx={{ borderRadius: 2, fontSize: 11 }}>
            취소
          </Button>
        </Stack>
      ) : null,
    },
  ];

  return (
    <Stack gap={3}>
      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" color="secondary"
          startIcon={<IconifyIcon icon="mingcute:leaf-fill" width={16} />}
          href="/waste-prediction">
          폐기 예측 보기
        </Button>
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>기부 내역</Typography>
        <Box sx={{ height: 480 }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" height="100%">
              <CircularProgress />
            </Stack>
          ) : rows.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
              <IconifyIcon icon="mingcute:heart-line" color={theme.palette.secondary.main} width={48} />
              <Typography color="text.secondary" fontWeight={600}>등록된 기부 내역이 없습니다.</Typography>
            </Stack>
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
        </Box>
      </Paper>
    </Stack>
  );
};

export default DonationHistory;
