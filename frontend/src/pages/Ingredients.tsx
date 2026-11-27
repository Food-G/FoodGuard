import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { inventoryService } from '../services/inventoryService';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';
import {
  TOSS, TossPage, TwoColumn, SidePanel, PanelTitle, BigStat, Segmented, EmptyState, tossButtonSx, tossSubButtonSx, GroupList, ColumnHeader,
} from '../components/TossUI';

const UNIT_OPTIONS = ['kg', 'L', '개'] as const;

const fieldSx = { '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: '#FFFFFF' }, '& fieldset': { border: 'none' } };

const Ingredients = ({ user }: any) => {
  const confirm = useConfirm();
  const { storeId } = useMyStore(user);

  const [items, setItems] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [query, setQuery] = useState('');
  const [unitFilter, setUnitFilter] = useState<'ALL' | (typeof UNIT_OPTIONS)[number]>('ALL');
  const [form, setForm] = useState({ name: '', unit: 'kg' });
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  // 목록 옆에 현재 재고를 같이 보여 준다
  useEffect(() => {
    if (!storeId) return;
    inventoryService.getByStore(storeId)
      .then((inv: any[]) => setStock(Object.fromEntries((inv ?? []).map((x) => [x.ingredient?.id, Number(x.currentQty ?? 0)]))))
      .catch(() => setStock({}));
  }, [storeId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/ingredients', { name: form.name.trim(), unit: form.unit });
      setSuccess(`${form.name.trim()}을(를) 등록했어요.`);
      setForm((f) => ({ ...f, name: '' }));
      await load();
    } catch (err: any) {
      setError(err?.message || '식자재 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing?.name?.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.put(`/ingredients/${editing.id}`, { name: editing.name.trim(), unit: editing.unit });
      setSuccess('식자재를 수정했어요.');
      setEditing(null);
      await load();
    } catch (err: any) {
      setError(err?.message || '식자재 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
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

  const countOf = (u: string) => items.filter((i) => i.unit === u).length;
  const noStock = items.filter((i) => !(stock[i.id] > 0)).length;
  const shown = useMemo(() => items
    .filter((i) => unitFilter === 'ALL' || i.unit === unitFilter)
    .filter((i) => !query.trim() || i.name.replace(/\s+/g, '').includes(query.trim().replace(/\s+/g, '')))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko')), [items, unitFilter, query]);

  const side = (
    <SidePanel>
      <BigStat label="등록된 식자재" value={loading ? '…' : `${items.length}개`} />
      <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
        {loading ? '' : `kg ${countOf('kg')} · L ${countOf('L')} · 개 ${countOf('개')}${noStock ? ` · 재고 없음 ${noStock}` : ''}`}
      </Typography>

      <PanelTitle>새 식자재</PanelTitle>
      <Box component="form" onSubmit={handleCreate}>
        <TextField fullWidth size="small" placeholder="식자재 이름 (예: 양상추)" value={form.name} sx={fieldSx}
          inputProps={{ 'aria-label': '식자재 이름' }}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Typography sx={{ fontSize: 13, color: TOSS.sub, mt: 1.5, mb: 0.75 }}>재고·발주 단위</Typography>
        <Segmented value={form.unit as any} onChange={(u: string) => setForm((f) => ({ ...f, unit: u }))}
          options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))} />
        <Typography sx={{ fontSize: 12, color: TOSS.sub, mt: 0.75 }}>레시피에는 g·ml 로 넣어도 kg·L 로 바꿔 계산해요.</Typography>
        <Button type="submit" fullWidth variant="contained" disabled={submitting || !form.name.trim()}
          sx={{ ...tossButtonSx, py: 1.2, fontSize: 15, mt: 2 }}>
          {submitting ? '등록 중…' : '등록하기'}
        </Button>
      </Box>
    </SidePanel>
  );

  const main = (
    <Box>
      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5} mb={1.5}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, letterSpacing: '-0.02em' }}>식자재 목록</Typography>
        <TextField size="small" placeholder="이름으로 찾기" value={query} onChange={(e) => setQuery(e.target.value)}
          inputProps={{ 'aria-label': '식자재 검색' }}
          sx={{ width: { sm: 240 }, '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: TOSS.bg }, '& fieldset': { border: 'none' } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><IconifyIcon icon="mingcute:search-line" color={TOSS.sub} width={18} /></InputAdornment> }} />
      </Stack>
      <Segmented value={unitFilter} onChange={setUnitFilter} options={[
        { value: 'ALL', label: `전체 ${items.length}` },
        ...UNIT_OPTIONS.map((u) => ({ value: u, label: `${u} ${countOf(u)}` })),
      ]} />
      <Box mt={1.5}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : shown.length === 0 ? (
          <EmptyState icon="mingcute:carrot-line"
            title={items.length === 0 ? '등록된 식자재가 없어요' : '찾는 식자재가 없어요'}
            desc={items.length === 0 ? '오른쪽에서 이름과 단위를 넣어 등록해 주세요.' : '이름을 다시 확인하거나 오른쪽에서 새로 등록해 주세요.'} />
        ) : (
        <GroupList header={<ColumnHeader left="식자재" right="재고" actionWidth={72} />}>
        {shown.map((ing) => {
          const isEditing = editing?.id === ing.id;
          const qty = stock[ing.id];
          return (
            <Stack key={ing.id} className="group-row" direction="row" alignItems="center" gap={2}
              sx={{ py: 1.5, '& .row-action': { opacity: { xs: 1, md: 0 }, transition: 'opacity .15s' }, '&:hover .row-action': { opacity: 1 } }}>
              {isEditing ? (
                <>
                  <TextField size="small" value={editing.name} autoFocus sx={{ flex: 1, '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: TOSS.bg }, '& fieldset': { border: 'none' } }}
                    inputProps={{ 'aria-label': '식자재 이름 수정' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditing(null); }}
                    onChange={(e) => setEditing((p: any) => ({ ...p, name: e.target.value }))} />
                  <Box sx={{ width: 190, flexShrink: 0 }}>
                    <Segmented value={editing.unit} onChange={(u: string) => setEditing((p: any) => ({ ...p, unit: u }))}
                      options={UNIT_OPTIONS.map((u) => ({ value: u, label: u }))} />
                  </Box>
                  <Button size="small" onClick={handleUpdate} disabled={submitting}
                    sx={{ ...tossButtonSx, py: 0.6, px: 1.5, fontSize: 13, minWidth: 0 }} variant="contained">저장</Button>
                  <Button size="small" onClick={() => setEditing(null)}
                    sx={{ ...tossSubButtonSx, py: 0.6, px: 1.5, fontSize: 13, minWidth: 0 }}>취소</Button>
                </>
              ) : (
                <>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 16, fontWeight: 600, color: TOSS.text }}>{ing.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: TOSS.sub }}>
                      {ing.unit} 단위{ing.shelfLifeDays ? ` · 보관 ${ing.shelfLifeDays}일` : ''}
                    </Typography>
                  </Box>
                  <Typography sx={{ width: 110, textAlign: 'right', fontSize: 16, fontWeight: qty > 0 ? 700 : 500, color: qty > 0 ? TOSS.text : TOSS.sub, flexShrink: 0 }}>
                    {qty > 0 ? `${ing.unit === '개' ? Math.round(qty) : Math.round(qty * 10) / 10}${ing.unit}` : '재고 없음'}
                  </Typography>
                  <Stack direction="row" className="row-action" sx={{ width: 72, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <IconButton size="small" aria-label={`${ing.name} 수정`} onClick={() => setEditing({ ...ing })}>
                      <IconifyIcon icon="mingcute:edit-2-line" width={18} color={TOSS.sub} />
                    </IconButton>
                    <IconButton size="small" aria-label={`${ing.name} 삭제`} onClick={() => handleDelete(ing.id, ing.name)}>
                      <IconifyIcon icon="mingcute:delete-2-line" width={18} color={TOSS.red} />
                    </IconButton>
                  </Stack>
                </>
              )}
            </Stack>
          );
        })}
        </GroupList>
        )}
      </Box>
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />
    </TossPage>
  );
};

export default Ingredients;
