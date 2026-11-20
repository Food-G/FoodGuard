import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack, useTheme, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import * as echarts from 'echarts';
import ReactEChart from '../components/base/ReactEChart';
import { wastePredictionService } from '../services/wastePredictionService';
import { donationService } from '../services/donationService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import AlertMessages from '../components/AlertMessages';
import ClearanceCard from '../components/agent/ClearanceCard';

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

  const load = (sid: number) =>
    wastePredictionService.predict(sid)
      .then((data: any[]) => setRows((data ?? []).map((item: any, idx: number) => ({ ...item, id: item.inventoryId ?? idx }))))
      .catch(() => setError('폐기 예측 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    load(storeId);
  }, [storeId, storeLoading]);

  // 기부 수량 기본값 = 폐기 예측량, 상한 = 재고 - 이미 기부 예정인 양
  const donationQty = donationForm.quantity ? Number(donationForm.quantity) : donationTarget?.wastePrediction;
  const donationQtyInvalid = donationTarget != null && (!(donationQty > 0) || donationQty > donationTarget.donatableQty);

  const handleDonate = async () => {
    if (!storeId || !donationTarget) return;
    try {
      await donationService.create(storeId, {
        ...donationForm,
        ingredientId: donationTarget.ingredientId,
        ingredientName: donationTarget.ingredientName,
        quantity: donationQty,
        unit: donationTarget.unit,
      });
      setSuccess(`${donationTarget.ingredientName} 기부 등록이 완료되었습니다.`);
      setDonationTarget(null);
      setDonationForm({ donationType: 'INGREDIENT', orgName: '', orgType: 'FOOD_BANK', orgContact: '', quantity: '', description: '' });
      load(storeId);
    } catch (e: any) {
      try { setError(JSON.parse(e.message).error); } catch { setError('기부 등록에 실패했습니다.'); }
    }
  };

  const wasteItems = rows.filter(r => r.wastePrediction > 0);
  // 폐기 위험부터, 그다음 유통기한이 가까운 순
  const sorted = [...rows].sort((a, b) =>
    Number(b.wastePrediction > 0) - Number(a.wastePrediction > 0) || a.daysUntilExpiry - b.daysUntilExpiry);

  const dayColor = (days: number) =>
    days <= 3 ? theme.palette.error.main : days <= 7 ? theme.palette.warning.main : theme.palette.text.secondary;

  // 유통기한까지 남은 기간별 식자재 수 (토스 도넛 + 범례 목록)
  const groups = [
    { label: '3일 이내', count: rows.filter(r => r.daysUntilExpiry <= 3).length, color: theme.palette.error.main },
    { label: '4~7일', count: rows.filter(r => r.daysUntilExpiry > 3 && r.daysUntilExpiry <= 7).length, color: theme.palette.warning.main },
    { label: '8일 이상', count: rows.filter(r => r.daysUntilExpiry > 7).length, color: '#C9D3CE' },
  ];
  const donutOption = {
    tooltip: { trigger: 'item', formatter: '{b} {c}개' },
    series: [{
      type: 'pie', radius: ['62%', '86%'], label: { show: false }, emphasis: { scale: false },
      itemStyle: { borderColor: theme.palette.background.paper, borderWidth: 3 },
      data: groups.filter(g => g.count > 0).map(g => ({ name: g.label, value: g.count, itemStyle: { color: g.color } })),
    }],
  };

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 + 기부 이력 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>폐기 위험 식자재</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}
            color={wasteItems.length ? 'error.main' : 'text.primary'}>
            {loading ? '-' : `${wasteItems.length}개`}
          </Typography>
          <Typography fontSize={15} color="text.secondary" mt={1}>
            {wasteItems.length
              ? '유통기한 안에 다 쓰지 못할 것으로 보여요. 할인 판매나 기부로 줄여 보세요.'
              : '지금 재고는 유통기한 안에 다 쓸 수 있을 것으로 보여요.'}
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:history-line" width={16} />}
          href="/donations">
          기부 이력
        </Button>
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {storeId && <ClearanceCard storeId={storeId} />}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        {/* 식자재 목록 (토스 목록 행) */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={2}>식자재별 폐기 예측</Typography>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress /></Stack>
          ) : rows.length === 0 ? (
            <Stack alignItems="center" py={8} gap={1}>
              <IconifyIcon icon="mingcute:leaf-fill" color={theme.palette.success.main} width={48} />
              <Typography color="text.secondary" fontWeight={600}>유통기한이 설정된 재고가 없습니다.</Typography>
              <Typography variant="body2" color="text.secondary">
                발주 검수 시 유통기한을 입력하면 폐기 예측이 활성화됩니다.
              </Typography>
            </Stack>
          ) : sorted.map((r) => (
            <Stack key={r.id} direction="row" alignItems="center" gap={3}
              sx={{ py: 3, borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } }}>
              <Box sx={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'background.default',
              }}>
                <Typography fontWeight={700} fontSize={14} sx={{ color: dayColor(r.daysUntilExpiry) }}>D-{r.daysUntilExpiry}</Typography>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={600} fontSize={15} noWrap>{r.ingredientName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  재고 {r.currentQty}{r.unit} · 소비 예상 {r.expectedConsumption}{r.unit}
                  {r.plannedDonation > 0 && ` · 기부 예정 ${r.plannedDonation}${r.unit}`}
                </Typography>
              </Box>
              <Box textAlign="right" sx={{ flexShrink: 0 }}>
                {r.wastePrediction > 0 ? (
                  <>
                    <Typography fontWeight={700} fontSize={16} color="error.main">폐기 {r.wastePrediction}{r.unit}</Typography>
                    <Typography variant="body2" color="text.secondary">폐기율 {r.wasteRate}%</Typography>
                  </>
                ) : (
                  <Typography fontWeight={600} fontSize={15} color="success.main">다 쓸 수 있어요</Typography>
                )}
              </Box>
              {r.wastePrediction > 0 && (
                <Button size="small" color="secondary" onClick={() => setDonationTarget(r)} sx={{ flexShrink: 0 }}>
                  기부
                </Button>
              )}
            </Stack>
          ))}
        </Paper>

        {/* 유통기한까지 남은 기간 */}
        {rows.length > 0 && (
          <Paper sx={{ p: 5 }}>
            <Typography fontSize={18} fontWeight={700} mb={1}>유통기한까지 남은 기간</Typography>
            <Box sx={{ position: 'relative' }}>
              <ReactEChart echarts={echarts} option={donutOption} sx={{ height: 220 }} />
              <Stack sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} alignItems="center" justifyContent="center">
                <Typography fontSize={26} fontWeight={700}>{rows.length}</Typography>
                <Typography variant="body2" color="text.secondary">식자재</Typography>
              </Stack>
            </Box>
            {groups.map((g) => (
              <Stack key={g.label} direction="row" alignItems="center" gap={2} sx={{ py: 2 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: g.color }} />
                <Typography fontSize={15} sx={{ flex: 1 }}>{g.label}</Typography>
                <Typography fontSize={15} fontWeight={700}>{g.count}개</Typography>
              </Stack>
            ))}
          </Paper>
        )}
      </Box>

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
              예측 폐기량(기부 예정 제외): <strong>{donationTarget?.wastePrediction} {donationTarget?.unit}</strong>
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
              error={donationQtyInvalid}
              helperText={`기부 가능 수량: ${donationTarget?.donatableQty ?? 0} ${donationTarget?.unit ?? ''} (재고 - 이미 기부 예정인 양)`}
            />
            <TextField label="메모 (선택)" value={donationForm.description}
              onChange={(e) => setDonationForm(f => ({ ...f, description: e.target.value }))}
              size="small" fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDonationTarget(null)}>취소</Button>
          <Button variant="contained" color="secondary" onClick={handleDonate}
            disabled={!donationForm.orgName || donationQtyInvalid}
            startIcon={<IconifyIcon icon="mingcute:heart-fill" width={14} />}>
            기부 등록
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default WastePrediction;
