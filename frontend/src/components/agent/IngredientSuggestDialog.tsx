import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, Checkbox, Chip,
} from '@mui/material';
import { api } from '../../services/api';
import { agentService, errorText, SettingSuggestion } from '../../services/agentService';

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  category?: string;
}

interface Props {
  open: boolean;
  storeId: number;
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}

type Row = SettingSuggestion & { checked: boolean };

// 보관기한·발주 주기·입고 기간 초안. 식품 안전과 관련되므로 점주가 확인한 행만 저장한다
const IngredientSuggestDialog = ({ open, storeId, ingredients, onClose, onSaved }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setRows([]);
    agentService.suggestSettings(storeId)
      .then((res) => {
        setRows(res.items.map((s: SettingSuggestion) => ({ ...s, checked: false })));
        setRemaining(res.remaining ?? 0);
      })
      .catch((e) => setError(errorText(e, '제안을 만들지 못했습니다.')))
      .finally(() => setLoading(false));
  }, [open, storeId]);

  const nameOf = (id: number) => ingredients.find((i) => i.id === id);
  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.checked);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      for (const r of selected) {
        const ing = nameOf(r.ingredientId);
        if (!ing) continue;
        await api.put(`/ingredients/${r.ingredientId}`, {
          name: ing.name, category: ing.category ?? '', unit: ing.unit,
          shelfLifeDays: r.shelfLifeDays, leadTimeDays: r.leadTimeDays, orderCycleDays: r.orderCycleDays,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(errorText(e, '저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const days = (i: number, key: 'shelfLifeDays' | 'orderCycleDays' | 'leadTimeDays', value: number) => (
    <TextField size="small" type="number" value={value} sx={{ width: 76 }}
      onChange={(e) => update(i, { [key]: Number(e.target.value) } as Partial<Row>)} />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle fontWeight={700}>AI 식자재 설정 제안</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {loading && (
            <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">설정이 빈 식자재를 살펴보고 있습니다 (10~30초)</Typography>
            </Stack>
          )}
          {!loading && !error && rows.length === 0 && <Alert severity="info">설정이 빈 식자재가 없습니다.</Alert>}
          {rows.length > 0 && (
            <>
              <Alert severity="warning">
                보관기한은 AI의 일반 상식 추정이며 공식 기준이 아닙니다. 제품 포장의 소비기한과 매장 보관 조건을 확인한 뒤 체크해 주세요.
                {remaining > 0 && ` 이번에 못 본 식자재 ${remaining}개는 저장 후 다시 받을 수 있습니다.`}
              </Alert>
              <TableContainer sx={{ maxHeight: 460 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>식자재</TableCell>
                      <TableCell>보관(일)</TableCell>
                      <TableCell>발주 주기(일)</TableCell>
                      <TableCell>입고(일)</TableCell>
                      <TableCell>근거</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={r.ingredientId}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={r.checked} onChange={(e) => update(i, { checked: e.target.checked })} />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {nameOf(r.ingredientId)?.name} <Chip size="small" variant="outlined" label={r.storage} />
                        </TableCell>
                        <TableCell>{days(i, 'shelfLifeDays', r.shelfLifeDays)}</TableCell>
                        <TableCell>
                          {days(i, 'orderCycleDays', r.orderCycleDays)}
                          {r.cycleSource === 'history' && <Typography variant="caption" display="block" color="text.secondary">발주 이력</Typography>}
                        </TableCell>
                        <TableCell>
                          {days(i, 'leadTimeDays', r.leadTimeDays)}
                          {r.leadSource === 'history' && <Typography variant="caption" display="block" color="text.secondary">입고 이력</Typography>}
                        </TableCell>
                        <TableCell><Typography variant="caption" color="text.secondary">{r.reason}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        <Button variant="contained" disabled={saving || selected.length === 0} onClick={save}>확인한 {selected.length}개 저장</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IngredientSuggestDialog;
