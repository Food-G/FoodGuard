import { useState } from 'react';
import { Autocomplete, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../services/api';
import { menuService } from '../../services/menuService';
import { menuIngredientService, StoreRecipeItem } from '../../services/menuIngredientService';
import { errorText } from '../../services/agentService';
import { useConfirm } from '../../hooks/useConfirm';
import IconifyIcon from '../base/IconifyIcon';

interface Props {
  storeId: number;
  menu: any;
  recipe: StoreRecipeItem[];
  ingredients: { id: number; name: string; unit: string }[];
  onChanged: () => void;
  onError: (message: string) => void;
}

// 레시피 단위 → 재고 단위. 기존 식자재는 재고 단위에 맞는 레시피 단위만 고를 수 있다
const BASE_UNIT: Record<string, string> = { g: 'kg', ml: 'L', 개: '개' };
const RECIPE_UNIT: Record<string, string> = { kg: 'g', L: 'ml' };

// 비상용 수동 입력: Claude 를 쓸 수 없을 때 가격·삭제·구성 식자재를 직접 고친다
const RecipeManualEditor = ({ storeId, menu, recipe, ingredients, onChanged, onError }: Props) => {
  const confirm = useConfirm();
  const [price, setPrice] = useState(String(menu.price ?? ''));
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [newUnit, setNewUnit] = useState('g');
  const [busy, setBusy] = useState(false);

  const existing = ingredients.find((i) => i.name.replace(/\s+/g, '') === name.trim().replace(/\s+/g, ''));
  const unit = existing ? RECIPE_UNIT[existing.unit] ?? existing.unit : newUnit;

  const run = async (action: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      return true;
    } catch (e) {
      onError(errorText(e, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePrice = () => run(() => menuService.update(menu.id, { menuName: menu.menuName, price: Number(price), category: menu.category }), '가격을 저장하지 못했습니다.');

  const removeMenu = async () => {
    if (!await confirm(`${menu.menuName} 메뉴를 삭제할까요? 판매 기록은 유지됩니다.`)) return;
    await run(() => menuService.deactivate(menu.id), '메뉴를 삭제하지 못했습니다.');
  };

  const addIngredient = async () => {
    const ok = await run(async () => {
      const ingredientId = existing
        ? existing.id
        : (await api.post('/ingredients', { storeId, name: name.trim(), unit: BASE_UNIT[newUnit], category: '' })).id;
      await menuIngredientService.add({ menuId: menu.id, ingredientId, qtyPerUnit: Number(qty), unit });
    }, '식자재를 추가하지 못했습니다.');
    if (ok) { setName(''); setQty(''); }
  };

  return (
    <Stack gap={1.5} sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <TextField size="small" type="number" label="가격" value={price} sx={{ width: 120 }} inputProps={{ min: 0 }}
          onChange={(e) => setPrice(e.target.value)} />
        <Button size="small" variant="outlined" disabled={busy || price === '' || Number(price) < 0} onClick={savePrice}>가격 저장</Button>
        <Button size="small" color="error" disabled={busy} onClick={removeMenu}>메뉴 삭제</Button>
      </Stack>

      {recipe.map((r) => (
        <Stack key={r.id} direction="row" alignItems="center" gap={1} sx={{ maxWidth: 360 }}>
          <Typography variant="body2" sx={{ flexGrow: 1 }}>{r.ingredientName}</Typography>
          <Typography variant="body2" color="text.secondary">{r.qtyPerUnit} {r.unit}</Typography>
          <IconButton size="small" color="error" disabled={busy} aria-label={`${r.ingredientName} 빼기`}
            onClick={() => run(() => menuIngredientService.remove(r.id), '식자재를 빼지 못했습니다.')}>
            <IconifyIcon icon="mingcute:delete-2-line" width={16} />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
        <Autocomplete freeSolo size="small" sx={{ width: 200 }} options={ingredients.map((i) => i.name)} inputValue={name}
          onInputChange={(_, value) => setName(value)}
          renderInput={(params) => <TextField {...params} label="식자재" />} />
        <TextField size="small" type="number" label="1개당 사용량" value={qty} sx={{ width: 120 }} inputProps={{ min: 0, step: 'any' }}
          onChange={(e) => setQty(e.target.value)} />
        {existing ? (
          <Typography variant="body2">{unit}</Typography>
        ) : (
          <TextField select size="small" label="단위" value={newUnit} sx={{ width: 80 }} onChange={(e) => setNewUnit(e.target.value)}>
            {Object.keys(BASE_UNIT).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
          </TextField>
        )}
        <Button size="small" variant="outlined" disabled={busy || !name.trim() || !(Number(qty) > 0)} onClick={addIngredient}>
          {existing ? '추가' : '새 식자재로 추가'}
        </Button>
      </Stack>
    </Stack>
  );
};

export default RecipeManualEditor;
