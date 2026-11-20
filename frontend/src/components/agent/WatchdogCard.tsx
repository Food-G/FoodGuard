import { useEffect, useState } from 'react';
import { Alert, Paper, Stack, Typography, Chip, useTheme } from '@mui/material';
import { agentService, WatchdogFinding } from '../../services/agentService';

const SEVERITY: Record<string, 'error' | 'warning' | 'info'> = { HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };

// 재고·데이터 점검 결과 (규칙 기반, AI 호출 없음)
const WatchdogCard = ({ storeId, refreshKey }: { storeId: number; refreshKey?: number }) => {
  const theme = useTheme();
  const [findings, setFindings] = useState<WatchdogFinding[] | null>(null);

  useEffect(() => {
    agentService.watchdog(storeId).then(setFindings).catch(() => setFindings(null));
  }, [storeId, refreshKey]);

  if (!findings) return null;

  return (
    <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
      <Stack direction="row" alignItems="center" gap={1} mb={findings.length > 0 ? 2 : 0}>
        <Typography variant="h6" fontWeight={700}>재고·데이터 점검</Typography>
        <Chip size="small" variant="outlined" color={findings.length > 0 ? 'warning' : 'success'}
          label={findings.length > 0 ? `${findings.length}건` : '이상 없음'} />
      </Stack>
      <Stack gap={1} sx={{ maxHeight: 260, overflowY: 'auto' }}>
        {findings.map((f) => (
          <Alert key={f.message} severity={SEVERITY[f.severity]} sx={{ py: 0 }}>{f.message}</Alert>
        ))}
      </Stack>
    </Paper>
  );
};

export default WatchdogCard;
