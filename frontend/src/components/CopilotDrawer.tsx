import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, Drawer, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { agentService, ChatReply } from '../services/agentService';

const OWNER_EXAMPLES = ['이번 주 소고기 발주가 왜 많아?', '폐기 위험 TOP3', '지난주 대비 매출'];
const HQ_EXAMPLES = ['이번 주 매출이 가장 높은 매장은?', '승인 대기 발주 현황', '매장별 주간 매출 비교'];
const MAX_QUESTION = 2000;
const HISTORY_TURNS = 10;

const SOURCE_LABEL: Record<string, string> = {
  stores: '매장', menus: '메뉴', recipe: '레시피', ingredients: '식자재', inventory: '재고', predictions: '수요 예측',
  recommend: '발주 추천', orders: '발주', 'orders-all': '전체 발주', sales: '판매', today: '오늘 매출', weekly: '주간 매출',
  'weekly-all': '전 매장 주간 매출', txns: '재고 원장', lots: '입고 로트', waste: '폐기 위험', accuracy: '예측 오차',
};

type Message = { role: 'user' | 'assistant'; content: string; reply?: ChatReply };

const errorMessage = (e: unknown) => {
  try { return JSON.parse((e as Error).message)?.message ?? '답변을 받지 못했습니다.'; } catch { return (e as Error)?.message || '답변을 받지 못했습니다.'; }
};

const CopilotDrawer = ({ open, onClose, storeId, isHq }: {
  open: boolean; onClose: () => void; storeId: number | null; isHq: boolean;
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;
    setError('');
    setInput('');
    setSending(true);
    const history = messages.slice(-HISTORY_TURNS).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_QUESTION) }));
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    try {
      const reply = await agentService.chat({ question, history, storeId });
      setMessages((prev) => [...prev, { role: 'assistant', content: reply.answer, reply }]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  // 코파일럿은 안내만 한다. 발주안 생성은 사람이 이 버튼을 눌러야 시작되고, 발주는 승인함에서 승인해야 나간다
  const makeOrderPlan = async () => {
    if (!storeId) return;
    try {
      await agentService.run('order_advisor', storeId);
      onClose();
      navigate('/agent-inbox');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 440 } } }}>
      <Stack height="100%">
        <Stack direction="row" alignItems="center" gap={1} p={2} borderBottom={1} borderColor="divider">
          <IconifyIcon icon="mingcute:robot-line" width={22} />
          <Typography fontWeight={700} flex={1}>AI 코파일럿</Typography>
          <IconButton size="small" onClick={onClose} aria-label="닫기"><IconifyIcon icon="mingcute:close-line" width={20} /></IconButton>
        </Stack>

        <Stack flex={1} gap={1.5} p={2} sx={{ overflowY: 'auto' }}>
          <Typography variant="caption" color="text.secondary">
            조회만 할 수 있고 데이터를 바꾸지 않습니다. 합성 데이터 기준이며, 대화 내용은 이 창을 새로고침하면 사라집니다.
          </Typography>
          {messages.length === 0 && (
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {(isHq ? HQ_EXAMPLES : OWNER_EXAMPLES).map((q) => (
                <Chip key={q} label={q} variant="outlined" clickable onClick={() => send(q)} />
              ))}
            </Stack>
          )}
          {messages.map((m, i) => (
            <Box key={i} sx={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', px: 1.5, py: 1, borderRadius: 2,
              bgcolor: m.role === 'user' ? 'primary.main' : 'action.hover',
              color: m.role === 'user' ? 'primary.contrastText' : 'text.primary',
            }}>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
              {m.reply?.denied && (
                <Typography variant="caption" color="warning.main" display="block" mt={0.5}>권한이 없어 조회하지 못한 항목이 있습니다.</Typography>
              )}
              {!!m.reply?.sources.length && (
                <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                  조회: {m.reply.sources.map((s) => SOURCE_LABEL[s] ?? s).join(', ')}
                </Typography>
              )}
              {m.reply?.action === 'order_plan' && (
                <Button size="small" variant="contained" sx={{ mt: 1 }} onClick={makeOrderPlan}>
                  발주안 만들고 승인함으로 이동
                </Button>
              )}
            </Box>
          ))}
          {sending && <CircularProgress size={22} sx={{ alignSelf: 'flex-start' }} />}
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        </Stack>

        <Stack direction="row" gap={1} p={2} borderTop={1} borderColor="divider">
          <TextField size="small" fullWidth multiline maxRows={4} placeholder="무엇이든 물어보세요"
            value={input} inputProps={{ maxLength: MAX_QUESTION }}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); }
            }} />
          <Button variant="contained" disabled={sending || !input.trim()} onClick={() => send(input)}>보내기</Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export default CopilotDrawer;
