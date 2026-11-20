import { useEffect, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography, useTheme } from '@mui/material';
import { storeService } from '../services/storeService';
import { agentService, errorText } from '../services/agentService';

interface Turn {
  question: string;
  answer: string;
  answerable: boolean;
  unverifiedNumbers: string[];
}

const EXAMPLES = ['이번 주 뭐가 부족해?', '내일 뭐가 제일 많이 팔릴까?', '유통기한 임박한 재고 있어?', '지금 진행 중인 발주 알려줘'];

// 점주 질문 답변: 이 매장의 현재 데이터만 근거로 답한다. 조회만 하고 발주·수정은 하지 않는다
const Assistant = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores: any[]) => {
        if (stores?.length) setStoreId(stores[0].id);
        else setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.');
      })
      .catch(() => setError('가게 정보를 불러오지 못했습니다.'));
  }, [user]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || !storeId || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await agentService.ask(storeId, q);
      setTurns((prev) => [{ question: q, ...res }, ...prev]);
      setQuestion('');
    } catch (e) {
      setError(errorText(e, '답변을 받지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={0.5}>AI 운영 비서</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          우리 매장의 판매·예측·재고·발주 데이터로 답합니다. 조회만 하며 발주나 수정은 하지 않습니다.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Stack component="form" direction="row" gap={1} onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <TextField fullWidth size="small" placeholder="질문을 입력하세요" value={question} inputProps={{ maxLength: 300 }}
            onChange={(e) => setQuestion(e.target.value)} />
          <Button type="submit" variant="contained" disabled={busy || !storeId || !question.trim()} sx={{ whiteSpace: 'nowrap', px: 3 }}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}>
            {busy ? '확인 중' : '질문'}
          </Button>
        </Stack>
        <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
          {EXAMPLES.map((e) => <Chip key={e} size="small" variant="outlined" label={e} onClick={() => ask(e)} disabled={busy || !storeId} />)}
        </Stack>
      </Paper>

      {turns.map((t, i) => (
        <Paper key={turns.length - i} sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="body2" color="text.secondary" mb={1}>{t.question}</Typography>
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{t.answer}</Typography>
          {t.unverifiedNumbers?.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              매장 데이터에서 확인되지 않은 숫자가 있습니다: {t.unverifiedNumbers.join(', ')}. 해당 화면에서 확인해 주세요.
            </Alert>
          )}
        </Paper>
      ))}
    </Stack>
  );
};

export default Assistant;
