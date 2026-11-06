import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack, useTheme, Alert, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { wastePredictionService } from '../services/wastePredictionService';
import { donationService } from '../services/donationService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import AlertMessages from '../components/AlertMessages';

const ORG_TYPES = [
  { value: 'ORPHANAGE', label: '고아원' },
  { value: 'NURSING_HOME', label: '양로원' },
  { value: 'FOOD_BANK', label: '푸드뱅크' },
  { value: 'OTHER', label: '기타' },
];

const DONATION_TYPES = [
  { value: 'FOOD', label: '음식 (조리 후 기부)' },
  { value: 'INGREDIENT', label: '식재료 (원재료 기부)' },
];

const RISK_CHIP: Record<string, { label: string; color: any }> = {
  HIGH: { label: '높음', color: 'error' },
  MEDIUM: { label: '보통', color: 'warning' },
  LOW: { label: '낮음', color: 'success' },
};

// 기부 API 는 AG-3 에서 만든다. 그때 true 로 바꾼다 (DEV_ROADMAP P0-3).
const DONATION_ENABLED = false;

const WastePrediction = ({ user }: any) => {
  const theme = useTheme();
  const { storeId, storeLoading } = useMyStore(user);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [donationTarget, setDonationTarget] = useState<any>(null);
  const [donationForm, setDonationForm] = useState({
    donationType: 'INGREDIENT',
    orgName: '',
    orgType: 'FOOD_BANK',
    orgContact: '',
    quantity: '',
    description: '',
  });

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    wastePredictionService.predict(storeId)
      .then((data: any[]) => setRows((data ?? []).map((item: any, idx: number) => ({ ...item, id: item.inventoryId ?? idx }))))
      .catch(() => setError('폐기 예측 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId, storeLoading]);

  const handleDonate = async () => {
    if (!storeId || !donationTarget) return;
    try {
      await donationService.create(storeId, {
        ...donationForm,
        ingredientId: donationTarget.ingredientId,
        ingredientName: donationTarget.ingredientName,
        quantity: donationForm.quantity ? Number(donationForm.quantity) : donationTarget.wastePrediction,
        unit: donationTarget.unit,
      });
      setSuccess(`${donationTarget.ingredientName} 기부 등록이 완료되었습니다.`);
      setDonationTarget(null);
      setDonationForm({ donationType: 'INGREDIENT', orgName: '', orgType: 'FOOD_BANK', orgContact: '', quantity: '', description: '' });
    } catch {
      setError('기부 등록에 실패했습니다.');
    }
  };

  const columns: GridColDef[] = [
    { field: 'ingredientName', headerName: '식자재', flex: 1, minWidth: 120 },
    {
      field: 'currentQty', headerName: '현재 재고', width: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Typography fontSize={13}>{p.value} <span style={{ color: '#999' }}>{p.row.unit}</span></Typography>,
    },
    {
      field: 'expiryDate', headerName: '유통기한', width: 120,
      renderCell: (p) => {
        const days = p.row.daysUntilExpiry;
        const color = days <= 3 ? 'error' : days <= 7 ? 'warning' : 'default';
        return <Chip label={p.value} color={color} size="small" variant="outlined" sx={{ fontWeight: 600 }} />;
      },
    },
    {
      field: 'daysUntilExpiry', headerName: 'D-', width: 80, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Typography fontWeight={700} color={p.value <= 3 ? 'error.main' : p.value <= 7 ? 'warning.main' : 'text.primary'}>
          {p.value < 0 ? '만료' : `D-${p.value}`}
        </Typography>
      ),
    },
    {
      field: 'expectedConsumption', headerName: '소비 예상', width: 110, align: 'right', headerAlign: 'right',
      renderCell: (p) => <Typography fontSize={13}>{p.value} <span style={{ color: '#999' }}>{p.row.unit}</span></Typography>,
    },
    {
      field: 'wastePrediction', headerName: '폐기 예측량', width: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => (
        <Typography fontWeight={700} color={p.value > 0 ? 'error.main' : 'success.main'} fontSize={13}>
          {p.value > 0 ? `+${p.value}` : p.value} <span style={{ color: '#999', fontWeight: 400 }}>{p.row.unit}</span>
        </Typography>
      ),
    },
    {
      field: 'wasteRate', headerName: '폐기율', width: 90, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Chip
          label={`${p.value}%`}
          size="small"
          color={p.value > 50 ? 'error' : p.value > 20 ? 'warning' : 'success'}
          variant="filled"
          sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: 'riskLevel', headerName: '위험도', width: 90, align: 'center', headerAlign: 'center',
      renderCell: (p) => (
        <Chip label={RISK_CHIP[p.value]?.label ?? p.value} color={RISK_CHIP[p.value]?.color ?? 'default'} size="small" />
      ),
    },
    ...(DONATION_ENABLED ? [{
      field: 'actions', headerName: '기부', width: 110, sortable: false,
      // 기한이 오늘이거나 지난 식자재는 기부할 수 없다 (식품 안전)
      renderCell: (p) => p.row.wastePrediction > 0 && p.row.daysUntilExpiry >= 1 ? (
        <Button variant="contained" size="small" color="secondary"
          startIcon={<IconifyIcon icon="mingcute:heart-fill" width={14} />}
          onClick={() => setDonationTarget(p.row)}
          sx={{ borderRadius: 2, fontSize: 11 }}>
          기부 등록
        </Button>
      ) : null,
    } as GridColDef] : []),
  ];

  const wasteItems = rows.filter(r => r.wastePrediction > 0);

  return (
    <Stack gap={3}>
      <Stack direction="row" justifyContent="flex-end" gap={1}>
        <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:robot-line" width={16} />}
          href="/agent-inbox?agent=waste">
          에이전트 제안 보기
        </Button>
        {DONATION_ENABLED && (
          <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:history-line" width={16} />}
            href="/donations">
            기부 이력
          </Button>
        )}
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {/* 요약 카드 */}
      {!loading && wasteItems.length > 0 && (
        <Paper sx={{ p: 2.5, border: `1px solid ${theme.palette.error.light}`, borderRadius: 3, bgcolor: 'error.50' }}>
          <Stack direction="row" gap={1} alignItems="center" mb={0.5}>
            <IconifyIcon icon="mingcute:alert-fill" color={theme.palette.error.main} width={20} />
            <Typography fontWeight={700} color="error.main">
              {wasteItems.length}개 식재료 폐기 위험
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            유통기한 내 소비 예측량보다 재고가 많습니다. 에이전트 제안에서 대응 방법을 확인하세요.
          </Typography>
        </Paper>
      )}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>식재료별 폐기 예측</Typography>
        <Box sx={{ height: 480 }}>
          {loading ? (
            <Stack alignItems="center" justifyContent="center" height="100%">
              <CircularProgress />
            </Stack>
          ) : rows.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
              <IconifyIcon icon="mingcute:leaf-fill" color={theme.palette.success.main} width={48} />
              <Typography color="text.secondary" fontWeight={600}>
                유통기한이 설정된 재고가 없습니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                식자재 보관일수가 설정된 재고가 입고되면 폐기 예측이 활성화됩니다.
              </Typography>
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

      {/* 기부 등록 다이얼로그 */}
      <Dialog open={!!donationTarget} onClose={() => setDonationTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" gap={1} alignItems="center">
            <IconifyIcon icon="mingcute:heart-fill" color={theme.palette.secondary.main} width={20} />
            기부 등록 — {donationTarget?.ingredientName}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              예측 폐기량: <strong>{donationTarget?.wastePrediction} {donationTarget?.unit}</strong>
              (유통기한: {donationTarget?.expiryDate}, D-{donationTarget?.daysUntilExpiry})
            </Alert>
            <TextField select label="기부 유형" value={donationForm.donationType}
              onChange={(e) => setDonationForm(f => ({ ...f, donationType: e.target.value }))} size="small" fullWidth>
              {DONATION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="기관 유형" value={donationForm.orgType}
              onChange={(e) => setDonationForm(f => ({ ...f, orgType: e.target.value }))} size="small" fullWidth>
              {ORG_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField label="기관명" value={donationForm.orgName} required
              onChange={(e) => setDonationForm(f => ({ ...f, orgName: e.target.value }))} size="small" fullWidth />
            <TextField label="연락처 (선택)" value={donationForm.orgContact}
              onChange={(e) => setDonationForm(f => ({ ...f, orgContact: e.target.value }))} size="small" fullWidth />
            <TextField
              label={`기부 수량 (${donationTarget?.unit ?? ''})`}
              value={donationForm.quantity}
              placeholder={`${donationTarget?.wastePrediction}`}
              onChange={(e) => setDonationForm(f => ({ ...f, quantity: e.target.value }))}
              size="small" fullWidth type="number"
            />
            <TextField label="메모 (선택)" value={donationForm.description}
              onChange={(e) => setDonationForm(f => ({ ...f, description: e.target.value }))}
              size="small" fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDonationTarget(null)}>취소</Button>
          <Button variant="contained" color="secondary" onClick={handleDonate}
            disabled={!donationForm.orgName}
            startIcon={<IconifyIcon icon="mingcute:heart-fill" width={14} />}>
            기부 등록
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default WastePrediction;
