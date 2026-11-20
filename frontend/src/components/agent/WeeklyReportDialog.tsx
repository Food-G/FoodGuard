import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Alert, CircularProgress, Paper, Chip,
} from '@mui/material';
import { agentService, errorText, WeeklyReport } from '../../services/agentService';

const FLAG: Record<string, string> = {
  SALES_DROP: '매출 급락', SALES_SURGE: '매출 급증', NO_SALES_INPUT: '판매 입력 없음', WASTE_RECORDED: '폐기 기록',
};

// 본사 주간 리포트: 수치와 이상 표시는 코드가 집계하고, 문장·원인 가설만 AI 가 쓴다
const WeeklyReportDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [data, setData] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setData(null);
    agentService.weeklyReport()
      .then(setData)
      .catch((e) => setError(errorText(e, '리포트를 만들지 못했습니다.')))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>
        AI 주간 리포트{data && <Typography variant="caption" sx={{ ml: 1 }}>{data.facts.periodStart} ~ {data.facts.periodEnd}</Typography>}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {loading && (
            <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">가맹점 수치를 정리하고 있습니다 (10~30초)</Typography>
            </Stack>
          )}
          {data && (
            <>
              <Alert severity="info" icon={false}>{data.report.headline}</Alert>
              {data.report.unverifiedNumbers.length > 0 && (
                <Alert severity="warning">집계에 없는 숫자가 문장에 있습니다. 아래 수치를 기준으로 확인해 주세요: {data.report.unverifiedNumbers.join(', ')}</Alert>
              )}
              {data.report.stores.map((s) => {
                const fact = data.facts.stores.find((f) => f.storeId === s.storeId);
                return (
                  <Paper key={s.storeId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" mb={1}>
                      <Typography fontWeight={700}>{fact?.storeName}</Typography>
                      {fact?.flags.map((f) => <Chip key={f} size="small" color="warning" variant="outlined" label={FLAG[f] ?? f} />)}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        매출 ₩{fact?.revenue.toLocaleString()} (직전 7일 ₩{fact?.previousRevenue.toLocaleString()}{fact?.changePct != null ? `, ${fact.changePct > 0 ? '+' : ''}${fact.changePct}%` : ''})
                      </Typography>
                    </Stack>
                    <Typography variant="body2">{s.finding}</Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>가설: {s.hypothesis}</Typography>
                  </Paper>
                );
              })}
              {data.report.actions.length > 0 && (
                <Stack>
                  <Typography fontWeight={700} mb={0.5}>이번 주 할 일</Typography>
                  {data.report.actions.map((a) => <Typography key={a} variant="body2">• {a}</Typography>)}
                </Stack>
              )}
              <Typography variant="caption" color="text.disabled">수치와 이상 표시는 집계 코드가, 문장과 원인 가설은 AI가 만들었습니다. 가설은 확인이 필요합니다.</Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </Dialog>
  );
};

export default WeeklyReportDialog;
