import { useEffect, useState } from 'react';
import {
  Typography, Paper, Stack, TextField, Button, Alert, LinearProgress, Chip, Box, useTheme,
} from '@mui/material';
import { salesPlanService, SalesPlan } from '../services/salesPlanService';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const won = (v: number) => `₩${Math.round(v).toLocaleString()}`;

// 매출 계획 수립 지원: 이번 주 목표 매출과 (지난 날 실제 + 남은 날 AI 예측) 매출 비교
const SalesPlanCard = ({ storeId, refreshKey }: { storeId: number; refreshKey?: unknown }) => {
  const theme = useTheme();
  const [plan, setPlan] = useState<SalesPlan | null>(null);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () =>
    salesPlanService.get(storeId)
      .then((p) => { setPlan(p); setTarget(p.targetAmount ? String(p.targetAmount) : ''); })
      .catch(() => setError('매출 계획을 불러오지 못했습니다.'));

  useEffect(() => { load(); }, [storeId, refreshKey]);

  const handleSave = async () => {
    if (!plan || !(Number(target) > 0)) return;
    setSaving(true);
    setError('');
    try {
      await salesPlanService.saveTarget(storeId, plan.weekStart, Number(target));
      await load();
    } catch {
      setError('목표 매출 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (!plan) return error ? <Alert severity="error">{error}</Alert> : null;

  const rate = plan.achievementRate;
  const missingForecast = plan.days.some((d) => d.type === 'NONE');
  const maxAmount = Math.max(1, ...plan.days.map((d) => d.amount));

  return (
    <Paper sx={{ p: 4, border: `1px solid ${theme.palette.divider}` }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={700}>이번 주 매출 계획</Typography>
        <Chip label={`${plan.weekStart} 주`} size="small" variant="outlined" />
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems={{ sm: 'center' }} mb={3}>
        <TextField
          label="주간 목표 매출(원)" size="small" type="number" value={target}
          onChange={(e) => setTarget(e.target.value)} inputProps={{ min: 1 }} sx={{ width: 220 }}
        />
        <Button variant="contained" onClick={handleSave} disabled={saving || !(Number(target) > 0)}>
          목표 저장
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={3} mb={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">지난 날 실제 매출</Typography>
          <Typography variant="h6" fontWeight={700}>{won(plan.actualToDate)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">남은 날 AI 예측 매출</Typography>
          <Typography variant="h6" fontWeight={700}>{won(plan.forecastRemaining)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">이번 주 예상 매출</Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">{won(plan.expectedTotal)}</Typography>
        </Box>
      </Stack>

      {rate !== null && plan.gap !== null ? (
        <>
          <LinearProgress
            variant="determinate" value={Math.min(rate, 100)}
            color={rate >= 100 ? 'success' : 'warning'} sx={{ height: 8, borderRadius: 4, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            목표 대비 {rate}% ·{' '}
            {plan.gap >= 0
              ? `목표보다 ${won(plan.gap)} 많을 것으로 예상됩니다.`
              : `목표까지 ${won(-plan.gap)} 부족할 것으로 예상됩니다. 남은 날 판촉이나 메뉴 구성을 검토해 보세요.`}
          </Typography>
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">목표 매출을 입력하면 예상 달성률을 보여드립니다.</Typography>
      )}

      <Stack direction="row" gap={1} mt={3} alignItems="flex-end" sx={{ height: 90 }}>
        {plan.days.map((d) => (
          <Stack key={d.date} alignItems="center" sx={{ flex: 1 }}>
            <Box
              title={`${d.date} ${won(d.amount)}`}
              sx={{
                width: '100%', height: `${(d.amount / maxAmount) * 60}px`, minHeight: 2, borderRadius: 1,
                bgcolor: d.type === 'ACTUAL' ? 'grey.500' : d.type === 'FORECAST' ? 'primary.main' : 'grey.200',
              }}
            />
            <Typography variant="caption" color="text.secondary">{DAY_LABELS[new Date(d.date).getDay()]}</Typography>
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        회색: 실제 매출 · 파란색: AI 예측 매출 (예측 판매량 × 메뉴 가격)
        {missingForecast && ' · 예측이 없는 날은 0으로 계산했습니다. AI 예측을 실행하면 채워집니다.'}
      </Typography>
    </Paper>
  );
};

export default SalesPlanCard;
