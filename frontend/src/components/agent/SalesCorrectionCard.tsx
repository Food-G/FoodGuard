import { useState } from 'react';
import {
  Alert, Button, CircularProgress, Paper, Stack, TextField, Typography, useTheme,
} from '@mui/material';
import { salesService, SalesCorrectionProposal } from '../../services/salesService';
import { errorText } from '../../services/agentService';

const money = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}₩${Math.abs(v).toLocaleString()}`;

// 문자로 판매 수정·취소 요청 → AI 가 해석 → 코드가 계산한 변경 내용을 확인 → 점주가 눌러야 반영된다
const SalesCorrectionCard = ({ storeId, onApplied }: { storeId: number; onApplied: () => void }) => {
  const theme = useTheme();
  const [message, setMessage] = useState('');
  const [sentMessage, setSentMessage] = useState('');
  const [proposal, setProposal] = useState<SalesCorrectionProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError('');
    setDone('');
    setProposal(null);
    try {
      setProposal(await salesService.proposeCorrection(storeId, message.trim()));
      setSentMessage(message.trim());
    } catch (err) {
      setError(errorText(err, '요청을 이해하지 못했습니다. 날짜와 메뉴를 적어 다시 요청해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      await salesService.applyCorrection(storeId, proposal.changes, sentMessage);
      setDone('판매를 수정했습니다. 수정 내용은 알림에도 남습니다.');
      setProposal(null);
      setMessage('');
      onApplied();
    } catch (err) {
      setError(errorText(err, '반영하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
      <Typography variant="h6" fontWeight={700} mb={0.5}>판매 수정·취소 요청</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        잘못 결제한 판매를 문자로 요청하세요. 최근 14일 판매를 고칠 수 있고, 내용을 확인한 뒤에 반영합니다.
      </Typography>
      <Stack component="form" direction="row" gap={1} onSubmit={ask}>
        <TextField fullWidth size="small" value={message} inputProps={{ maxLength: 300 }}
          placeholder="예: 오늘 치즈버거 1개 잘못 결제했어, 취소해줘"
          onChange={(e) => setMessage(e.target.value)} />
        <Button type="submit" variant="outlined" disabled={busy || !message.trim()} sx={{ whiteSpace: 'nowrap', px: 3 }}
          startIcon={busy && !proposal ? <CircularProgress size={14} /> : null}>
          {busy && !proposal ? '확인 중' : '요청'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {done && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      {proposal?.clarification && <Alert severity="info" sx={{ mt: 2 }}>{proposal.clarification}</Alert>}

      {proposal && proposal.changes.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={700} mb={1}>이렇게 바꿀까요?</Typography>
          <Stack gap={1.5}>
            {proposal.changes.map((c) => (
              <Stack key={`${c.saleDate}-${c.menuId}`}>
                <Typography variant="body2">
                  {c.saleDate} <b>{c.menuName}</b> {c.currentTotal}개 → <b>{c.newTotal === 0 ? '전체 취소' : `${c.newTotal}개`}</b>
                  <Typography component="span" variant="body2" color="text.secondary"> (매출 {money(c.amountChange)})</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {c.stockChanges.length > 0
                    ? `재고: ${c.stockChanges.map((s) => `${s.ingredient} ${s.change > 0 ? '+' : ''}${s.change}${s.unit}`).join(', ')}`
                    : '재고 변화 없음 (POS 결제가 아닌 판매)'}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" gap={1} mt={2}>
            <Button variant="contained" size="small" disabled={busy} onClick={apply}>확인하고 반영</Button>
            <Button size="small" disabled={busy} onClick={() => setProposal(null)}>취소</Button>
          </Stack>
        </Paper>
      )}
    </Paper>
  );
};

export default SalesCorrectionCard;
