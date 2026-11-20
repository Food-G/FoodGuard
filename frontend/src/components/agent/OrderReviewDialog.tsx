import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Alert, CircularProgress,
  Paper, Chip, TextField, Checkbox,
} from '@mui/material';
import { agentService, errorText, OrderReview } from '../../services/agentService';

interface Recommendation {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  orderQty: number;
  requiredQty: number;
  currentStock: number;
  pendingQty: number;
}

const VERDICT: Record<string, { label: string; color: 'success' | 'warning' | 'default' }> = {
  approve: { label: '그대로', color: 'success' },
  reduce: { label: '줄이기 제안', color: 'warning' },
  hold: { label: '보류 제안', color: 'default' },
};

const ADVICE: Record<string, { label: string; severity: 'success' | 'warning' | 'error' }> = {
  execute: { label: '승인 권장', severity: 'success' },
  revise: { label: '조정 후 승인 권장', severity: 'warning' },
  wait: { label: '지금은 발주하지 않기를 권장', severity: 'error' },
};

// 발주 참모: 계산된 추천을 AI 가 검토하고, 점주가 체크·수정한 항목만 발주한다. AI 는 늘리자고 제안할 수 없다
const OrderReviewDialog = ({ open, storeId, onClose, onOrdered }: { open: boolean; storeId: number; onClose: () => void; onOrdered: () => void }) => {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [review, setReview] = useState<OrderReview | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setReview(null);
    agentService.reviewOrder(storeId)
      .then((res: { recommendations: Recommendation[]; review: OrderReview }) => {
        setRecs(res.recommendations ?? []);
        setReview(res.review);
        setQty(Object.fromEntries(res.review.items.map((i) => [i.ingredientId, i.suggestedQty])));
        setChecked(Object.fromEntries(res.review.items.map((i) => [i.ingredientId, i.verdict !== 'hold'])));
      })
      .catch((e) => setError(errorText(e, 'AI 검토를 받지 못했습니다.')))
      .finally(() => setLoading(false));
  }, [open, storeId]);

  const selected = recs.filter((r) => checked[r.ingredientId] && qty[r.ingredientId] > 0);

  const order = async () => {
    setSaving(true);
    setError('');
    try {
      await agentService.agentOrder(storeId, selected.map((r) => ({ ingredientId: r.ingredientId, quantity: qty[r.ingredientId] })));
      onOrdered();
      onClose();
    } catch (e) {
      setError(errorText(e, '발주하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const advice = review ? ADVICE[review.recommendation] : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>AI 발주 참모</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {loading && (
            <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">추천 발주량과 재고·경고를 검토하고 있습니다 (10~30초)</Typography>
            </Stack>
          )}
          {review && advice && (
            <>
              <Alert severity={advice.severity} icon={false}>
                <Typography fontWeight={700} mb={0.5}>{advice.label}</Typography>
                {review.summary}
              </Alert>
              {review.concerns.length > 0 && (
                <Alert severity="warning" icon={false}>
                  {review.concerns.map((c) => <Typography key={c} variant="body2">• {c}</Typography>)}
                </Alert>
              )}
              {recs.map((r) => {
                const item = review.items.find((i) => i.ingredientId === r.ingredientId);
                const verdict = VERDICT[item?.verdict ?? 'approve'];
                return (
                  <Paper key={r.ingredientId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Checkbox size="small" checked={!!checked[r.ingredientId]}
                        onChange={(e) => setChecked({ ...checked, [r.ingredientId]: e.target.checked })} />
                      <Typography fontWeight={700} sx={{ flexGrow: 1 }}>{r.ingredientName}</Typography>
                      <Chip size="small" color={verdict.color} label={verdict.label} />
                      <TextField size="small" type="number" label={`발주량(${r.unit})`} value={qty[r.ingredientId] ?? 0} sx={{ width: 120 }}
                        onChange={(e) => setQty({ ...qty, [r.ingredientId]: Number(e.target.value) })} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={1}>{item?.reason}</Typography>
                    <Typography variant="caption" color="text.disabled">
                      계산 추천 {r.orderQty}{r.unit} = 필요 {r.requiredQty} − 재고 {r.currentStock} − 진행 중 발주 {r.pendingQty}
                    </Typography>
                  </Paper>
                );
              })}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        {recs.length > 0 && (
          <Button variant="contained" disabled={saving || selected.length === 0} onClick={order}>
            선택한 {selected.length}건 발주 승인
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default OrderReviewDialog;
