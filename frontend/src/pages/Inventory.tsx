import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Box, Button, CircularProgress, Stack, TextField, MenuItem, IconButton, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  TOSS, TossPage, TwoColumn, SidePanel, BigStat, Segmented, EmptyState, tossButtonSx, tossSubButtonSx, GroupList, ColumnHeader,
} from '../components/TossUI';
import { inventoryService } from '../services/inventoryService';
import { wasteService } from '../services/wasteService';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { menuIngredientService, MenuIngredient } from '../services/menuIngredientService';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';

const WASTE_REASONS = [
  { value: 'EXPIRED', label: '유통기한 경과' },
  { value: 'DAMAGED', label: '파손·변질' },
  { value: 'OVERPREP', label: '과다 조리' },
  { value: 'OTHER', label: '기타' },
];

const Inventory = ({ user }: any) => {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [stockFilter, setStockFilter] = useState<'ALL' | 'URGENT' | 'LOW' | 'OK'>('ALL');

  // 재고 현황
  const [rows, setRows] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);

  // 메뉴 식자재 구성
  const [menus, setMenus] = useState<any[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<any | null>(null);
  const [menuIngredients, setMenuIngredients] = useState<MenuIngredient[]>([]);
  const [loadingMI, setLoadingMI] = useState(false);
  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 메뉴-식자재 연결 추가 폼
  const [form, setForm] = useState({ ingredientId: '', qtyPerUnit: '', unit: '' });
  const [submitting, setSubmitting] = useState(false);

  // 폐기 등록 다이얼로그
  const [wasteTarget, setWasteTarget] = useState<any | null>(null);
  const [wasteForm, setWasteForm] = useState({ quantity: '', reason: 'EXPIRED' });

  // 발주 단위 → 레시피 소단위 변환
  const toRecipeUnit = (base: string) => base === 'kg' ? 'g' : base === 'L' ? 'ml' : '개';

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (!stores?.length) return;
      const sid = stores[0].id;
      setStoreId(sid);
      loadInventory(sid);
      menuService.getByStore(sid).then((m: any[]) => setMenus(m ?? []));
    }).catch(console.error);

    loadAllIngredients();
  }, [user]);

  const loadInventory = (sid: number) => {
    setLoadingInventory(true);
    inventoryService.getByStore(sid).then((data: any[]) => {
      setRows((data ?? []).map((item: any) => ({
        id: item.id,
        ingredientId: item.ingredient?.id,
        name: item.ingredient?.name ?? '',
        quantity: Number(item.currentQty ?? item.quantity ?? 0),
        minThreshold: Number(item.minThreshold ?? 0),
        unit: item.ingredient?.unit ?? item.unit ?? '',
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-',
      })));
    }).catch(console.error).finally(() => setLoadingInventory(false));
  };

  const loadMenuIngredients = useCallback(async (menuId: number) => {
    setLoadingMI(true);
    try {
      const data = await menuIngredientService.getByMenu(menuId);
      setMenuIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    } finally {
      setLoadingMI(false);
    }
  }, []);

  const handleSelectMenu = (menu: any) => {
    setSelectedMenu(menu);
    setForm({ ingredientId: '', qtyPerUnit: '', unit: '' });
    setError('');
    setSuccess('');
    loadMenuIngredients(menu.id);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenu || !form.ingredientId || !form.qtyPerUnit || !form.unit) return;
    setSubmitting(true);
    setError('');
    try {
      await menuIngredientService.add({
        menuId: selectedMenu.id,
        ingredientId: Number(form.ingredientId),
        qtyPerUnit: Number(form.qtyPerUnit),
        unit: form.unit,
      });
      setSuccess('식자재가 추가되었습니다.');
      setForm({ ingredientId: '', qtyPerUnit: '', unit: '' });
      await loadMenuIngredients(selectedMenu.id);
    } catch {
      setError('식자재 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirm('이 식자재 연결을 삭제하시겠습니까?')) return;
    try {
      await menuIngredientService.delete(id);
      setMenuIngredients((prev) => prev.filter((mi) => mi.id !== id));
      setSuccess('삭제되었습니다.');
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  const loadAllIngredients = async () => {
    try {
      const data = await api.get('/ingredients');
      setAllIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    }
  };

  const handleClearInventory = async () => {
    if (!storeId) return;
    if (!await confirm({ message: '전체 재고를 모두 삭제하시겠습니까?', confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await inventoryService.clearByStore(storeId);
      setSuccess('전체 재고가 삭제되었습니다.');
      loadInventory(storeId);
    } catch {
      setError('재고 삭제에 실패했습니다.');
    }
  };

  const handleWaste = async () => {
    if (!storeId || !wasteTarget) return;
    try {
      await wasteService.create(storeId, {
        ingredientId: wasteTarget.ingredientId,
        quantity: Number(wasteForm.quantity),
        reason: wasteForm.reason,
      });
      setSuccess(`${wasteTarget.name} ${wasteForm.quantity}${wasteTarget.unit} 폐기를 등록했습니다.`);
      setWasteTarget(null);
      setWasteForm({ quantity: '', reason: 'EXPIRED' });
      loadInventory(storeId);
    } catch (e) {
      setError((e as Error)?.message || '폐기 등록에 실패했습니다.');
    }
  };

  const handleIngredientSelect = (ingredientId: string) => {
    const ing = allIngredients.find((i) => String(i.id) === ingredientId);
    setForm((prev) => ({ ...prev, ingredientId, unit: toRecipeUnit(ing?.unit ?? '') }));
  };

  // 재고 긴급도: 현재고 / 최소 보유량 비율 (par 기준 3단계: 긴급·부족·충분)
  const urgencyOf = (q: number, min: number) => {
    const ratio = min > 0 ? q / min : (q <= 0 ? 0 : 99);
    if (q <= 0 || ratio <= 1) return { key: 'URGENT', level: '긴급', color: TOSS.red, sort: ratio - (q <= 0 ? 1 : 0) };
    if (ratio <= 2) return { key: 'LOW', level: '부족', color: '#F59F00', sort: ratio };
    return { key: 'OK', level: '충분', color: TOSS.green, sort: ratio };
  };
  // 급한(현재고 적은) 순으로 상단 정렬
  const sortedRows = [...rows].sort((a, b) => urgencyOf(a.quantity, a.minThreshold).sort - urgencyOf(b.quantity, b.minThreshold).sort);
  const countOf = (k: string) => rows.filter((r) => urgencyOf(r.quantity, r.minThreshold).key === k).length;
  const shownRows = sortedRows.filter((r) => stockFilter === 'ALL' || urgencyOf(r.quantity, r.minThreshold).key === stockFilter);
  const urgent = countOf('URGENT');
  const fmtQty = (v: number, unit: string) => `${unit === '개' ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;
  const fieldSx = { '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: '#FFFFFF' }, '& fieldset': { border: 'none' } };

  const side = (
    <SidePanel glow={urgent > 0 ? TOSS.red : TOSS.green}>
      <BigStat label="지금 채워야 할 식자재" value={loadingInventory ? '…' : `${urgent}개`} color={urgent > 0 ? TOSS.red : undefined} />
      <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
        {loadingInventory ? '' : urgent > 0 ? '최소 보유량보다 적거나 다 떨어졌어요.' : '모든 식자재가 최소 보유량 이상이에요.'}
      </Typography>

      <Stack direction="row" gap={1} mt={3}>
        <Button variant="contained" onClick={() => navigate('/orders')} startIcon={<IconifyIcon icon="mingcute:sparkles-line" width={18} />}
          sx={{ ...tossButtonSx, py: 1.1, fontSize: 15, flex: 1 }}>
          발주하러 가기
        </Button>
        <Button onClick={() => navigate('/waste-prediction')} sx={{ ...tossSubButtonSx, py: 1.1, fontSize: 15, flex: 1, bgcolor: '#FFFFFF' }}>
          폐기 예측
        </Button>
      </Stack>
      <Button variant="text" size="small" onClick={handleClearInventory} disabled={rows.length === 0}
        sx={{ mt: 1.5, color: TOSS.sub, bgcolor: 'transparent', boxShadow: 'none', fontWeight: 600, '&:hover': { color: TOSS.red, bgcolor: 'transparent' } }}>
        전체 재고 비우기
      </Button>
    </SidePanel>
  );

  const main = (
    <Box>
      {error && <Alert severity="error" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, mb: 1.5, letterSpacing: '-0.02em' }}>재고 현황</Typography>
      <Segmented value={stockFilter} onChange={setStockFilter} options={[
        { value: 'ALL', label: `전체 ${rows.length}` },
        { value: 'URGENT', label: `긴급 ${urgent}` },
        { value: 'LOW', label: `부족 ${countOf('LOW')}` },
        { value: 'OK', label: `충분 ${countOf('OK')}` },
      ]} />
      <Box mt={1.5}>
        {loadingInventory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : shownRows.length === 0 ? (
          <EmptyState icon="mingcute:box-3-line"
            title={rows.length === 0 ? '등록된 재고가 없어요' : '이 상태의 식자재가 없어요'}
            desc={rows.length === 0 ? '발주한 식자재를 검수하면 재고가 생겨요.' : undefined} />
        ) : (
        <GroupList header={<ColumnHeader left="식자재" right="재고" actionWidth={56} />}>
        {shownRows.map((row) => {
          const u = urgencyOf(row.quantity, row.minThreshold);
          return (
            <Stack key={row.id} className="group-row" direction="row" alignItems="center" gap={2}
              sx={{ py: 1.5, '& .row-action': { opacity: { xs: 1, md: 0 }, transition: 'opacity .15s' }, '&:hover .row-action': { opacity: 1 } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography noWrap sx={{ fontSize: 16, fontWeight: 600, color: TOSS.text }}>{row.name}</Typography>
                  {u.key !== 'OK' && (
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: u.color, bgcolor: `${u.color}14`, px: 0.75, py: 0.1, borderRadius: '6px' }}>{u.level}</Typography>
                  )}
                </Stack>
                {row.minThreshold > 0 && (
                  <Typography sx={{ fontSize: 13, color: TOSS.sub }}>최소 {fmtQty(row.minThreshold, row.unit)}</Typography>
                )}
              </Box>
              <Typography sx={{ width: 110, textAlign: 'right', fontSize: 16, fontWeight: 700, color: u.key === 'OK' ? TOSS.text : u.color, flexShrink: 0 }}>
                {fmtQty(row.quantity, row.unit)}
              </Typography>
              <Box sx={{ width: 56, textAlign: 'right', flexShrink: 0 }}>
                <Button className="row-action" size="small" disabled={row.quantity <= 0} onClick={() => setWasteTarget(row)}
                  sx={{ borderRadius: '8px', px: 1.25, py: 0.25, minWidth: 0, fontSize: 13, fontWeight: 700, bgcolor: TOSS.bg, color: TOSS.sub,
                    '&:hover': { bgcolor: '#FFF0F1', color: TOSS.red } }}>
                  폐기
                </Button>
              </Box>
            </Stack>
          );
        })}
        </GroupList>
        )}
      </Box>

      {/* 메뉴별 식자재 구성 (레시피) */}
      <Box sx={{ mt: 5, pt: 4, backgroundImage: `linear-gradient(90deg, transparent, ${TOSS.line} 18%, ${TOSS.line} 82%, transparent)`, backgroundSize: '100% 1px', backgroundRepeat: 'no-repeat' }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, mb: 0.5, letterSpacing: '-0.02em' }}>메뉴별 식자재 구성</Typography>
        <Typography sx={{ fontSize: 14, color: TOSS.sub, mb: 1.5 }}>메뉴 하나에 들어가는 식자재와 양이에요. 판매하면 이만큼 재고에서 빠져요.</Typography>
        {menus.length === 0 ? (
          <Typography sx={{ fontSize: 14, color: TOSS.sub }}>등록된 메뉴가 없습니다.</Typography>
        ) : (
          <Stack direction="row" gap={1} flexWrap="wrap" mb={1.5}>
            {menus.map((menu) => {
              const on = selectedMenu?.id === menu.id;
              return (
                <Button key={menu.id} onClick={() => handleSelectMenu(menu)}
                  sx={{ borderRadius: '12px', px: 1.75, py: 0.75, fontSize: 14, fontWeight: on ? 700 : 500,
                    color: on ? '#fff' : TOSS.text, background: on ? 'linear-gradient(135deg, #22B286, #1D9E75)' : TOSS.bg,
                    '&:hover': { background: on ? undefined : 'rgba(15,30,50,0.08)' } }}>
                  {menu.menuName}
                </Button>
              );
            })}
          </Stack>
        )}

        {!selectedMenu && menus.length > 0 && (
          <Typography sx={{ fontSize: 14, color: TOSS.sub }}>메뉴를 고르면 들어가는 식자재가 나와요.</Typography>
        )}

        {selectedMenu && (
          <>
            {loadingMI ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : menuIngredients.length === 0 ? (
              <Typography sx={{ fontSize: 14, color: TOSS.sub, py: 1.5 }}>아직 연결된 식자재가 없어요. 아래에서 추가해 주세요.</Typography>
            ) : (
            <GroupList header={<ColumnHeader left="식자재" right="1개당" actionWidth={56} />}>
            {menuIngredients.map((mi) => (
              <Stack key={mi.id} className="group-row" direction="row" alignItems="center" gap={2}
                sx={{ py: 1, '& .row-action': { opacity: { xs: 1, md: 0 }, transition: 'opacity .15s' }, '&:hover .row-action': { opacity: 1 } }}>
                <Typography sx={{ flex: 1, fontSize: 15, color: TOSS.text }}>{mi.ingredient.name}</Typography>
                <Typography sx={{ width: 110, textAlign: 'right', fontSize: 15, fontWeight: 700, color: TOSS.text }}>{mi.qtyPerUnit}{mi.unit}</Typography>
                <Box sx={{ width: 56, textAlign: 'right' }}>
                  <IconButton className="row-action" size="small" aria-label={`${mi.ingredient.name} 빼기`} onClick={() => handleDelete(mi.id)}>
                    <IconifyIcon icon="mingcute:delete-2-line" width={18} color={TOSS.red} />
                  </IconButton>
                </Box>
              </Stack>
            ))}
            </GroupList>
            )}

            <Box component="form" onSubmit={handleAddIngredient} sx={{ mt: 1.5, p: 1.5, borderRadius: '16px', bgcolor: TOSS.bg }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <TextField select size="small" required value={form.ingredientId} sx={{ minWidth: 180, flex: 1, ...fieldSx }}
                  SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': '추가할 식자재' }}
                  onChange={(e) => handleIngredientSelect(e.target.value)}>
                  <MenuItem value="" disabled>식자재 선택</MenuItem>
                  {allIngredients.map((ing) => (
                    <MenuItem key={ing.id} value={String(ing.id)}>{ing.name} ({ing.unit})</MenuItem>
                  ))}
                </TextField>
                <TextField size="small" type="number" required placeholder="1개당 양" value={form.qtyPerUnit} sx={{ width: { sm: 120 }, ...fieldSx }}
                  inputProps={{ step: '0.01', min: '0', 'aria-label': '1개당 사용량' }}
                  InputProps={{ endAdornment: form.unit ? <Typography sx={{ fontSize: 14, color: TOSS.sub }}>{form.unit}</Typography> : undefined }}
                  onChange={(e) => setForm((p) => ({ ...p, qtyPerUnit: e.target.value }))} />
                <Button type="submit" variant="contained" disabled={submitting || !form.ingredientId || !form.qtyPerUnit}
                  sx={{ ...tossButtonSx, py: 0.9, px: 2.5, fontSize: 14 }}>
                  {submitting ? '추가 중…' : `${selectedMenu.menuName}에 추가`}
                </Button>
              </Stack>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />

      <Dialog open={!!wasteTarget} onClose={() => setWasteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: TOSS.radius, p: 1, bgcolor: '#FFFFFF', backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>폐기 등록 — {wasteTarget?.name}</DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              현재 재고 {wasteTarget?.quantity}{wasteTarget?.unit}. 등록하면 재고에서 바로 차감됩니다.
            </Typography>
            <TextField label={`폐기량 (${wasteTarget?.unit ?? ''})`} type="number" size="small" fullWidth required
              value={wasteForm.quantity}
              onChange={(e) => setWasteForm((f) => ({ ...f, quantity: e.target.value }))}
              inputProps={{ step: '0.01', min: '0', max: wasteTarget?.quantity }} />
            <TextField select label="사유" size="small" fullWidth value={wasteForm.reason}
              onChange={(e) => setWasteForm((f) => ({ ...f, reason: e.target.value }))}>
              {WASTE_REASONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWasteTarget(null)} sx={{ ...tossSubButtonSx, py: 1, px: 3, fontSize: 15 }}>취소</Button>
          <Button variant="contained" onClick={handleWaste} disabled={!(Number(wasteForm.quantity) > 0)}
            sx={{ ...tossButtonSx, py: 1, px: 3, fontSize: 15, backgroundImage: 'linear-gradient(135deg, #F25C68, #F04452)' }}>
            폐기 등록
          </Button>
        </DialogActions>
      </Dialog>
    </TossPage>
  );
};

export default Inventory;
