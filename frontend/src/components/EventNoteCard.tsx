import { useEffect, useState } from 'react';
import {
  Paper, Typography, Stack, TextField, Button, Alert, Chip, IconButton, Tooltip, CircularProgress, useTheme,
} from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { salesService } from '../services/salesService';

const TYPE_LABEL: Record<string, string> = {
  RESERVATION: '단체 예약', LOCAL_EVENT: '주변 행사', PROMOTION: '판촉', WEATHER: '날씨', SUPPLY: '재료·판매 제한', OTHER: '기타',
};

// 날짜별 특이사항 메모 → AI(claude)가 유형·예상 증감 배율로 바꿔 저장 → 다음 AI 수요 예측의 피처로 사용
const EventNoteCard = ({ storeId }: { storeId: number }) => {
  const theme = useTheme();
  const [notes, setNotes] = useState<any[]>([]);
  const [form, setForm] = useState({ eventDate: new Date().toISOString().split('T')[0], note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => salesService.getEventNotes(storeId).then((d: any[]) => setNotes(d ?? [])).catch(() => {});
  useEffect(() => { load(); }, [storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.note.trim()) return;
    setSaving(true);
    setError('');
    try {
      await salesService.createEventNote({ storeId, ...form });
      setForm((f) => ({ ...f, note: '' }));
      await load();
    } catch (err: any) {
      try { setError(JSON.parse(err.message).error); } catch { setError('특이사항 저장에 실패했습니다.'); }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await salesService.deleteEventNote(id).catch(() => setError('삭제에 실패했습니다.'));
    await load();
  };

  return (
    <Paper sx={{ p: 4, mt: 3.5, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, borderRadius: 5 }}>
      <Typography variant="h6" color="text.primary" fontWeight={700} sx={{ mb: 1 }}>특이사항</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        단체 예약·주변 행사·궂은 날씨처럼 판매에 영향을 줄 일을 적으면 AI가 예상 증감으로 바꿔 수요 예측에 반영합니다.
        예측 모델이 과거 특이사항 날의 실제 판매로 얼마나 믿을지 배우므로, 지난 일도 적어 두면 정확해집니다.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Stack component="form" onSubmit={handleSubmit} gap={2}>
        <TextField
          fullWidth variant="filled" type="date" label="날짜" required InputLabelProps={{ shrink: true }}
          value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
        />
        <TextField
          fullWidth variant="filled" label="내용 (예: 점심 단체 예약 30명)" required inputProps={{ maxLength: 500 }}
          value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <Button
          type="submit" fullWidth variant="outlined" size="large" sx={{ borderRadius: 3 }}
          disabled={saving || !form.note.trim()}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {saving ? 'AI 분석 중...' : '기록'}
        </Button>
      </Stack>
      {notes.length > 0 && (
        <Stack gap={1} sx={{ mt: 3, maxHeight: 280, overflowY: 'auto' }}>
          {notes.map((n) => (
            <Stack key={n.id} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="body2" color="text.primary" noWrap>{n.eventDate} · {n.note}</Typography>
                <Stack direction="row" gap={0.5} mt={0.5}>
                  <Chip size="small" variant="outlined" label={TYPE_LABEL[n.eventType] ?? n.eventType} />
                  <Tooltip title={n.reason ?? ''}>
                    <Chip
                      size="small"
                      color={Number(n.eventLift) > 1 ? 'primary' : Number(n.eventLift) < 1 ? 'warning' : 'default'}
                      label={`평소 × ${Number(n.eventLift).toFixed(2)}`}
                    />
                  </Tooltip>
                </Stack>
              </Stack>
              <IconButton size="small" color="error" onClick={() => handleDelete(n.id)}>
                <IconifyIcon icon="mingcute:delete-2-line" width={18} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
};

export default EventNoteCard;
