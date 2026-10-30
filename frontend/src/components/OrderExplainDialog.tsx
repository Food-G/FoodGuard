import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack,
  CircularProgress, Alert, Paper, Chip, Box,
} from '@mui/material';
import { orderService } from '../services/orderService';

interface Recommendation {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  orderQty: number;
  requiredQty: number;
  currentStock: number;
  coverageDays: number;
}

interface Explanation {
  summary: string;
  items: { ingredientId: number; explanation: string }[];
}

// AI 추천 발주량과 근거 설명 (claude CLI 가 계산 데이터를 문장으로 정리, 발주량은 바꾸지 않음)
const OrderExplainDialog = ({ open, storeId, onClose }: { open: boolean; storeId: number; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setExplanation(null);
    orderService.explainRecommend(storeId)
      .then((res: { recommendations: Recommendation[]; explanation: Explanation }) => {
        setRecs(res.recommendations ?? []);
        setExplanation(res.explanation);
      })
      .catch((e: any) => {
        try { setError(JSON.parse(e.message).error); } catch { setError('AI 근거 설명을 만들지 못했습니다.'); }
      })
      .finally(() => setLoading(false));
  }, [open, storeId]);

  const textOf = (id: number) => explanation?.items.find((i) => i.ingredientId === id)?.explanation;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>AI 추천 발주 근거</DialogTitle>
      <DialogContent>
        {loading && (
          <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              AI가 예측·재고·보관기한을 바탕으로 근거를 정리하고 있습니다 (10~20초)
            </Typography>
          </Stack>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && explanation && (
          <Stack gap={2}>
            <Alert severity="info" icon={false}>{explanation.summary}</Alert>
            {recs.map((r) => (
              <Paper key={r.ingredientId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography fontWeight={700}>{r.ingredientName}</Typography>
                  <Stack direction="row" gap={1}>
                    <Chip size="small" variant="outlined" label={`${r.coverageDays}일분`} />
                    <Chip size="small" color="primary" label={`발주 ${r.orderQty}${r.unit}`} />
                  </Stack>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {textOf(r.ingredientId) ?? '설명이 없습니다.'}
                </Typography>
                <Box mt={1}>
                  <Typography variant="caption" color="text.disabled">
                    필요 {r.requiredQty}{r.unit} − 현재 재고 {r.currentStock}{r.unit} (진행 중 발주 차감)
                  </Typography>
                </Box>
              </Paper>
            ))}
            <Typography variant="caption" color="text.disabled">
              발주량은 수요 예측 모델과 발주 규칙으로 계산한 값이고, 설명 문장은 AI(Claude)가 그 계산 근거를 정리한 것입니다.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderExplainDialog;
