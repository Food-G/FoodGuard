import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Button, Stack, useTheme, Chip, CircularProgress,
} from '@mui/material';
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
  const navigate = useNavigate();
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<string | null>(null);

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

  const completed = rows.filter((r) => r.status === 'COMPLETED').length;
  const planned = rows.filter((r) => r.status === 'PLANNED').length;
  const shown = [...rows]
    .filter((r) => !filter || r.status === filter)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  const statusColor = (s: string) =>
    s === 'COMPLETED' ? theme.palette.success.main : s === 'PLANNED' ? theme.palette.primary.main : theme.palette.text.disabled;
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.default',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>기부 완료</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `${completed}건`}
          </Typography>
          {planned > 0 && (
            <Typography fontSize={15} color="primary.main" mt={1}>기부 예정 {planned}건이 남아 있어요. 전달했으면 완료로 바꿔 주세요.</Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:leaf-line" width={16} />} onClick={() => navigate('/waste-prediction')}>
          폐기 예측 보기
        </Button>
      </Stack>

      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      <Paper sx={{ p: 5 }}>
        <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
          {pill(`전체 ${rows.length}`, filter === null, () => setFilter(null))}
          {pill(`기부 예정 ${planned}`, filter === 'PLANNED', () => setFilter('PLANNED'))}
          {pill(`기부 완료 ${completed}`, filter === 'COMPLETED', () => setFilter('COMPLETED'))}
        </Stack>

        {loading ? (
          <Stack alignItems="center" py={8}><CircularProgress /></Stack>
        ) : shown.length === 0 ? (
          <Stack alignItems="center" py={8} gap={1}>
            <IconifyIcon icon="mingcute:heart-line" color={theme.palette.text.disabled} width={44} />
            <Typography color="text.secondary" fontWeight={600}>기부 내역이 없습니다.</Typography>
            <Typography variant="body2" color="text.secondary">폐기 예측 화면에서 버려질 식자재를 기부로 등록할 수 있어요.</Typography>
          </Stack>
        ) : shown.map((r) => (
          <Stack key={r.id} direction="row" alignItems="center" gap={3} sx={{ py: 3, ...rowSx, opacity: r.status === 'CANCELLED' ? 0.5 : 1 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'primary.light', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconifyIcon icon="mingcute:heart-line" width={20} color={theme.palette.primary.main} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={600} fontSize={15} noWrap>
                {r.ingredientName ?? '-'}{r.quantity ? <Box component="span" fontWeight={700}> {r.quantity}{r.unit}</Box> : null}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {r.orgName} · {ORG_TYPE_LABEL[r.orgType] ?? r.orgType} · {DONATION_TYPE_LABEL[r.donationType] ?? r.donationType}
                {r.createdAt && ` · ${new Date(r.createdAt).toLocaleDateString()}`}
              </Typography>
            </Box>
            <Typography fontWeight={700} fontSize={14} sx={{ color: statusColor(r.status), whiteSpace: 'nowrap' }}>
              {STATUS_LABEL[r.status] ?? r.status}
            </Typography>
            {r.status === 'PLANNED' && (
              <Stack direction="row" gap={1}>
                <Button size="small" variant="text" color="error" onClick={() => handleCancel(r.id)}>취소</Button>
                <Button size="small" onClick={() => handleComplete(r.id)}>완료</Button>
              </Stack>
            )}
          </Stack>
        ))}
      </Paper>
    </Stack>
  );
};

export default DonationHistory;
