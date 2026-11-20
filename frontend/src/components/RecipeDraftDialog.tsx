import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack,
  CircularProgress, Alert, Checkbox, TextField,
} from '@mui/material';
import { menuIngredientService } from '../services/menuIngredientService';

interface DraftItem { ingredientId: number; qtyPerUnit: number; reason: string }
interface Missing { name: string; qtyPerUnit: number; unit: string }
interface Row { ingredientId: number; name: string; unit: string; qty: string; reason: string; checked: boolean }

// AI 레시피 초안: claude 가 메뉴명으로 이 매장 식자재와 1개당 사용량을 제안하고, 점주가 고치고 고른 것만 저장한다
const RecipeDraftDialog = ({ open, menu, ingredients, toRecipeUnit, onClose, onSaved }: {
  open: boolean;
  menu: { id: number; menuName: string };
  ingredients: { id: number; name: string; unit: string }[];
  toRecipeUnit: (base: string) => string;
  onClose: () => void;
  onSaved: (count: number) => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [missing, setMissing] = useState<Missing[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError('');
    setRows([]);
    setMissing([]);
    menuIngredientService.draft(menu.id)
      .then((res: { items: DraftItem[]; missing: Missing[] }) => {
        setRows((res.items ?? []).flatMap((it) => {
          const ing = ingredients.find((i) => i.id === it.ingredientId);
          return ing ? [{
            ingredientId: it.ingredientId, name: ing.name, unit: toRecipeUnit(ing.unit),
            qty: String(it.qtyPerUnit), reason: it.reason, checked: true,
          }] : [];
        }));
        setMissing(res.missing ?? []);
      })
      .catch((e: any) => {
        try { setError(JSON.parse(e.message).error); } catch { setError('AI 레시피 초안을 만들지 못했습니다.'); }
      })
      .finally(() => setLoading(false));
  }, [open, menu.id]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.ingredientId === id ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.checked && Number(r.qty) > 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    let saved = 0;
    try {
      for (const r of selected) {
        await menuIngredientService.add({ menuId: menu.id, ingredientId: r.ingredientId, qtyPerUnit: Number(r.qty), unit: r.unit });
        saved++;
      }
      onSaved(saved);
    } catch {
      setError(`${saved}개 저장 후 실패했습니다. 목록을 확인하세요.`);
      if (saved > 0) onSaved(saved);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>{menu.menuName} AI 레시피 초안</DialogTitle>
      <DialogContent>
        {loading && (
          <Stack alignItems="center" gap={2} sx={{ py: 6 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              AI가 등록된 식자재로 1개당 사용량 초안을 만들고 있습니다 (10~20초)
            </Typography>
          </Stack>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && !error && rows.length === 0 && missing.length === 0 && (
          <Typography variant="body2" color="text.secondary">제안할 식자재가 없습니다.</Typography>
        )}
        {!loading && rows.length > 0 && (
          <Stack gap={1}>
            {rows.map((r) => (
              <Stack key={r.ingredientId} direction="row" alignItems="center" gap={1}>
                <Checkbox checked={r.checked} onChange={(e) => update(r.ingredientId, { checked: e.target.checked })} />
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600}>{r.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.reason}</Typography>
                </Stack>
                <TextField
                  size="small" type="number" value={r.qty}
                  onChange={(e) => update(r.ingredientId, { qty: e.target.value })}
                  sx={{ width: 110 }} inputProps={{ step: '0.01', min: '0' }}
                />
                <Typography sx={{ width: 28 }}>{r.unit}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
        {!loading && missing.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            등록된 식자재에 없는 주재료입니다. 식자재로 먼저 등록한 뒤 다시 연결하세요:{' '}
            {missing.map((m) => `${m.name} ${m.qtyPerUnit}${m.unit}`).join(', ')}
          </Alert>
        )}
        {!loading && (rows.length > 0 || missing.length > 0) && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 2 }}>
            사용량은 AI(Claude)가 일반적인 1인분 기준으로 추정한 초안입니다. 매장 레시피에 맞게 고친 뒤 저장하세요.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={loading || saving || selected.length === 0}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : null}
        >
          선택한 {selected.length}개 저장
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipeDraftDialog;
