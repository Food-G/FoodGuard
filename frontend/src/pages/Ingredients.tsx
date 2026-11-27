import { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, CircularProgress, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { inventoryService } from '../services/inventoryService';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';
import IngredientImage from '../components/IngredientImage';
import IngredientDialog, { IngredientDraft } from '../components/IngredientDialog';
import { TOSS, TossPage, EmptyState } from '../components/TossUI';
import { CATEGORIES, categoryOf } from '../utils/ingredientImage';
import StockLots, { Lot } from '../components/StockLots';

const Ingredients = ({ user }: any) => {
  const confirm = useConfirm();
  const { storeId } = useMyStore(user);

  const [items, setItems] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<number, number>>({});
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [query, setQuery] = useState('');
  // 창: 'new' = 새 식자재 등록, 식자재 객체 = 그 식자재 수정
  const [dialog, setDialog] = useState<'new' | any | null>(null);

  const load = async () => {
    try {
      setItems((await api.get('/ingredients')) ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 타일에 현재 재고를 같이 보여 준다
  useEffect(() => {
    if (!storeId) return;
    inventoryService.getByStore(storeId)
      .then((inv: any[]) => setStock(Object.fromEntries((inv ?? []).map((x) => [x.ingredient?.id, Number(x.currentQty ?? 0)]))))
      .catch(() => setStock({}));
    // 입고 묶음 (마우스를 올리면 주차별·유통기한별로 보여 준다)
    inventoryService.getLots(storeId).then((l: Lot[]) => setLots(l ?? [])).catch(() => setLots([]));
  }, [storeId]);

  const save = async (d: IngredientDraft) => {
    if (dialog === 'new') {
      await api.post('/ingredients', { name: d.name, unit: d.unit, imageUrl: d.imageUrl });
      setSuccess(`${d.name}을(를) 등록했어요.`);
    } else {
      await api.put(`/ingredients/${dialog.id}`, { name: d.name, unit: d.unit, imageUrl: d.imageUrl });
      setSuccess(`${d.name}을(를) 수정했어요.`);
    }
    setDialog(null);
    await load();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!await confirm({ message: `"${name}" 식자재를 삭제하시겠습니까?`, confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await api.delete(`/ingredients/${id}`);
      setSuccess('식자재를 삭제했어요.');
      await load();
    } catch (err: any) {
      setError(err?.message || '식자재 삭제에 실패했습니다.');
    }
  };

  const withStock = items.filter((i) => stock[i.id] > 0).length;
  // 위 요약 띠에서 고른 조건 (누르면 걸러지고, 다시 누르면 풀린다)
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const shown = useMemo(() => items
    .filter((i) => stockFilter === 'ALL' || (stockFilter === 'IN') === (stock[i.id] > 0))
    .filter((i) => !query.trim() || i.name.replace(/\s+/g, '').includes(query.trim().replace(/\s+/g, '')))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko')), [items, query, stockFilter, stock]);
  // 종류별 진열 (사진 규칙으로 자동 분류)
  const sections = useMemo(() => CATEGORIES
    .map((c) => ({ ...c, list: shown.filter((i) => categoryOf(i.name, i.imageUrl) === c.key) }))
    .filter((c) => c.list.length > 0), [shown]);
  // 수정 창에 넣을 처음 값 (창이 열려 있는 동안 다시 만들지 않는다)
  const initial = useMemo(() => (dialog && dialog !== 'new' ? { name: dialog.name, unit: dialog.unit, imageUrl: dialog.imageUrl ?? null } : undefined), [dialog]);
  const fmtQty = (v: number, unit: string) => `${unit === '개' ? Math.round(v) : Math.round(v * 10) / 10}`;

  const statCard = (key: 'ALL' | 'IN' | 'OUT', label: string, value: number, color: string) => {
    const on = stockFilter === key;
    return (
      <ButtonBase key={key} onClick={() => setStockFilter(on && key !== 'ALL' ? 'ALL' : key)} aria-pressed={on}
        sx={{ display: 'block', textAlign: 'left', borderRadius: '18px', p: 2, transition: 'all .15s',
          bgcolor: on ? '#FFFFFF' : TOSS.bg, boxShadow: on ? `inset 0 0 0 2px ${color}, 0 6px 18px rgba(15,30,50,0.06)` : 'none',
          '&:hover': { bgcolor: on ? '#FFFFFF' : 'rgba(15,30,50,0.07)' } }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TOSS.sub }}>{label}</Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: on ? color : TOSS.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {loading ? '…' : value}<Box component="span" sx={{ fontSize: 15, fontWeight: 700, color: TOSS.sub, ml: 0.25 }}>개</Box>
        </Typography>
      </ButtonBase>
    );
  };

  const tile = (ing: any) => {
    const qty = stock[ing.id];
    const has = qty > 0;
    return (
      <Tooltip key={ing.id} placement="right-start" enterDelay={250} enterTouchDelay={600} disableInteractive={false}
        title={<StockLots name={ing.name} unit={ing.unit} lots={lots.filter((l) => l.ingredientId === ing.id)} />}
        componentsProps={{ tooltip: { sx: { bgcolor: '#FFFFFF', color: TOSS.text, borderRadius: '18px', p: 1.5, maxWidth: 'none',
          boxShadow: '0 12px 36px rgba(15,30,50,0.16)' } } }}>
      <Box sx={{ position: 'relative', '& .tile-action': { opacity: { xs: 1, md: 0 }, transition: 'opacity .15s' }, '&:hover .tile-action': { opacity: 1 } }}>
        <ButtonBase onClick={() => setDialog(ing)} aria-label={`${ing.name} 수정`}
          sx={{ width: 1, display: 'block', textAlign: 'left', borderRadius: '20px', p: 1.25, bgcolor: '#FFFFFF',
            boxShadow: '0 1px 2px rgba(15,30,50,0.06), 0 6px 18px rgba(15,30,50,0.06)', transition: 'transform .15s, box-shadow .15s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 2px 4px rgba(15,30,50,0.06), 0 12px 26px rgba(15,30,50,0.10)' } }}>
          <IngredientImage name={ing.name} imageUrl={ing.imageUrl} />
          <Typography noWrap sx={{ fontSize: 16, fontWeight: 800, color: TOSS.text, mt: 1 }}>{ing.name}</Typography>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography sx={{ fontSize: 12, color: TOSS.sub }}>
              {ing.unit}{ing.shelfLifeDays ? ` · 보관 ${ing.shelfLifeDays}일` : ''}
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: has ? TOSS.text : TOSS.sub }}>
              {has ? <>{fmtQty(qty, ing.unit)}<Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: TOSS.sub, ml: 0.25 }}>{ing.unit}</Box></> : '재고 없음'}
            </Typography>
          </Stack>
        </ButtonBase>
        <IconButton className="tile-action" size="small" aria-label={`${ing.name} 삭제`} onClick={() => handleDelete(ing.id, ing.name)}
          sx={{ position: 'absolute', top: 16, right: 16, bgcolor: '#FFFFFFE6', '&:hover': { bgcolor: '#FFF0F1' } }}>
          <IconifyIcon icon="mingcute:delete-2-line" width={16} color={TOSS.red} />
        </IconButton>
      </Box>
      </Tooltip>
    );
  };

  return (
    <TossPage wide>
      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      {/* 제목 + 검색 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} gap={1.5} mb={2}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: TOSS.text, letterSpacing: '-0.02em' }}>우리 매장 식자재</Typography>
          <Typography sx={{ fontSize: 13, color: TOSS.sub }}>타일을 누르면 이름·단위·사진을 고칠 수 있어요.</Typography>
        </Box>
        <TextField size="small" placeholder="이름으로 찾기" value={query} onChange={(e) => setQuery(e.target.value)}
          inputProps={{ 'aria-label': '식자재 검색' }}
          sx={{ width: { sm: 260 }, '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: TOSS.bg }, '& fieldset': { border: 'none' } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconifyIcon icon="mingcute:search-line" color={TOSS.sub} width={18} /></InputAdornment> }} />
      </Stack>

      {/* 요약 띠: 누르면 걸러진다 / 등록은 따로 눈에 띄는 카드 */}
      <Box sx={{ display: 'grid', gap: 1.5, mb: 4, gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr)) 1.4fr' } }}>
        {statCard('ALL', '전체', items.length, TOSS.green)}
        {statCard('IN', '재고 있음', withStock, TOSS.green)}
        {statCard('OUT', '재고 없음', items.length - withStock, '#F59F00')}
        <ButtonBase onClick={() => setDialog('new')} aria-label="새 식자재 등록"
          sx={{ gridColumn: { xs: '1 / -1', md: 'auto' }, borderRadius: '18px', p: 2, justifyContent: 'flex-start', gap: 1.5,
            background: 'linear-gradient(135deg, #22B286, #1D9E75 55%, #178A66)', color: '#FFFFFF',
            boxShadow: '0 8px 20px rgba(29,158,117,0.25)', '&:hover': { boxShadow: '0 12px 26px rgba(29,158,117,0.32)' } }}>
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconifyIcon icon="mingcute:add-line" color="#fff" width={24} />
          </Box>
          <Box sx={{ textAlign: 'left' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 800 }}>새 식자재 등록</Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>이름·단위만 적으면 사진은 자동이에요</Typography>
          </Box>
        </ButtonBase>
      </Box>

      {/* 종류별 진열 */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <EmptyState icon="mingcute:carrot-line" title="아직 등록된 식자재가 없어요" desc="위의 '새 식자재 등록'으로 첫 식자재를 넣어 보세요." />
      ) : sections.length === 0 ? (
        <EmptyState icon="mingcute:search-line" title="찾는 식자재가 없어요" desc="이름이나 위의 조건을 다시 확인해 주세요." />
      ) : sections.map((c) => (
        <Box key={c.key} sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
            <IconifyIcon icon={`fluent-emoji:${c.icon}`} width={26} height={26} />
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: TOSS.text }}>{c.label}</Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: TOSS.green }}>{c.list.length}</Typography>
            <Box sx={{ flex: 1, height: '1px', ml: 1, background: `linear-gradient(90deg, ${TOSS.line}, transparent)` }} />
          </Stack>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {c.list.map(tile)}
          </Box>
        </Box>
      ))}

      <IngredientDialog open={dialog !== null}
        title={dialog === 'new' ? '새 식자재 등록' : '식자재 수정'}
        submitLabel={dialog === 'new' ? '등록하기' : '저장하기'}
        initial={initial}
        onClose={() => setDialog(null)} onSubmit={save} />
    </TossPage>
  );
};

export default Ingredients;
