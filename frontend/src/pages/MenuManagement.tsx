import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Chip, CircularProgress, Collapse, FormControlLabel, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, useTheme,
} from '@mui/material';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import { MenuAgentChange, MenuAgentProposal, menuIngredientService, StoreRecipeItem } from '../services/menuIngredientService';
import { errorText } from '../services/agentService';
import { api } from '../services/api';
import RecipeManualEditor from '../components/agent/RecipeManualEditor';
import IconifyIcon from '../components/base/IconifyIcon';

const EXAMPLES = ['불고기버거 메뉴를 4000원에 추가해줘', '불고기버거 구성 식자재는 소고기 패티 150g, 양상추 20g, 버거빵 1개야', '치즈버거 가격을 8000원으로 바꿔줘'];

const describe = (c: MenuAgentChange) => {
  switch (c.op) {
    case 'ADD_MENU': return `메뉴 추가: ${c.menuName} ₩${c.price?.toLocaleString()}`;
    case 'UPDATE_MENU': return `메뉴 수정: ${c.currentName} ₩${c.currentPrice?.toLocaleString()} → ${c.menuName} ₩${c.price?.toLocaleString()}`;
    case 'DELETE_MENU': return `메뉴 삭제: ${c.menuName} (판매 기록은 유지)`;
    case 'ADD_INGREDIENTS': return `${c.menuName}에 식자재 추가·수정`;
    case 'REMOVE_INGREDIENTS': return `${c.menuName}에서 식자재 빼기: ${c.removeIngredients?.map((r) => r.name).join(', ')}`;
    case 'DELETE_INGREDIENT': return `식자재 삭제: ${c.ingredientName}${c.usedBy?.length ? ` (${c.usedBy.join(', ')} 레시피에서도 빠짐)` : ''}`;
    default: return c.op;
  }
};

// 메뉴 관리: 문자로 메뉴·레시피·식자재를 요청 → AI 해석 → 미리보기 확인(사용량 수정 가능) → 반영. 메뉴를 누르면 구성 식자재를 보여 준다
const MenuManagement = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<StoreRecipeItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [proposal, setProposal] = useState<MenuAgentProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // 비상용 수동 입력 (Claude 를 쓸 수 없을 때)
  const [manual, setManual] = useState(false);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [newMenu, setNewMenu] = useState({ menuName: '', price: '' });

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length > 0) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const load = useCallback(async (sid: number) => {
    try {
      const [m, r, i] = await Promise.all([menuService.getByStore(sid), menuIngredientService.getByStore(sid), api.get(`/ingredients?storeId=${sid}`)]);
      setMenus(m ?? []);
      setRecipes(r ?? []);
      setIngredients(i ?? []);
    } catch (e) {
      setError(errorText(e, '메뉴를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (storeId) load(storeId); }, [storeId, load]);

  const ask = async (text: string) => {
    if (!storeId || !text.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    setProposal(null);
    try {
      setProposal(await menuIngredientService.propose(storeId, text.trim()));
    } catch (e) {
      setError(errorText(e, '요청을 처리하지 못했습니다. 다시 적어 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const updateQty = (changeIndex: number, itemIndex: number, qty: number) => {
    setProposal((p) => p && ({
      ...p,
      changes: p.changes.map((c, i) => (i !== changeIndex ? c : {
        ...c,
        ingredients: c.ingredients?.map((item, j) => (j === itemIndex ? { ...item, qtyPerUnit: qty, estimated: false } : item)),
      })),
    }));
  };

  const apply = async () => {
    if (!storeId || !proposal) return;
    setBusy(true);
    setError('');
    try {
      await menuIngredientService.apply(storeId, proposal.changes);
      setSuccess('반영했습니다.');
      setProposal(null);
      setMessage('');
      await load(storeId);
    } catch (e) {
      setError(errorText(e, '반영하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const addMenuManually = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    setError('');
    try {
      await menuService.create({ storeId, menuName: newMenu.menuName.trim(), price: Number(newMenu.price) });
      setNewMenu({ menuName: '', price: '' });
      setSuccess('메뉴를 추가했습니다.');
      await load(storeId);
    } catch (err) {
      setError(errorText(err, '메뉴를 추가하지 못했습니다.'));
    }
  };

  const recipeOf = (menuId: number) => recipes.filter((r) => r.menuId === menuId);
  const hasEstimate = proposal?.changes.some((c) => c.ingredients?.some((i) => i.estimated));

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={0.5}>메뉴·식자재 요청</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          메뉴 추가·수정·삭제, 구성 식자재 지정, 식자재 삭제를 문자로 요청하세요. 내용을 확인한 뒤에 반영합니다.
        </Typography>
        <Stack component="form" direction="row" gap={1} onSubmit={(e) => { e.preventDefault(); ask(message); }}>
          <TextField fullWidth size="small" value={message} inputProps={{ maxLength: 500 }}
            placeholder={EXAMPLES[0]} onChange={(e) => setMessage(e.target.value)} />
          <Button type="submit" variant="contained" disabled={busy || !storeId || !message.trim()} sx={{ whiteSpace: 'nowrap', px: 3 }}
            startIcon={busy && !proposal ? <CircularProgress size={14} color="inherit" /> : null}>
            {busy && !proposal ? '확인 중' : '요청'}
          </Button>
        </Stack>
        <Stack direction="row" gap={1} mt={1.5} flexWrap="wrap">
          {EXAMPLES.map((e) => <Chip key={e} size="small" variant="outlined" label={e} onClick={() => setMessage(e)} />)}
        </Stack>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
        {proposal?.clarification && <Alert severity="info" sx={{ mt: 2 }}>{proposal.clarification}</Alert>}

        {proposal && proposal.changes.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700} mb={1}>이렇게 바꿀까요?</Typography>
            {hasEstimate && (
              <Alert severity="warning" sx={{ mb: 1.5, py: 0 }}>
                "추정" 사용량은 AI가 넣은 값입니다. 재고 차감과 발주량에 쓰이니 실제 레시피에 맞게 고쳐 주세요.
              </Alert>
            )}
            <Stack gap={2}>
              {proposal.changes.map((c, i) => (
                <Stack key={i} gap={1}>
                  <Typography variant="body2" fontWeight={600}>{describe(c)}</Typography>
                  {c.ingredients?.map((item, j) => (
                    <Stack key={item.name} direction="row" alignItems="center" gap={1} flexWrap="wrap" sx={{ pl: 1 }}>
                      <Typography variant="body2" sx={{ minWidth: 120 }}>{item.name}</Typography>
                      <TextField size="small" type="number" value={item.qtyPerUnit} sx={{ width: 100 }} inputProps={{ min: 0, step: 'any' }}
                        onChange={(e) => updateQty(i, j, Number(e.target.value))} />
                      <Typography variant="body2">{item.unit}</Typography>
                      {item.estimated && <Chip size="small" color="warning" label="추정" />}
                      {item.isNew && <Chip size="small" color="primary" variant="outlined" label="새 식자재" />}
                      {item.previousQty && <Typography variant="caption" color="text.secondary">기존 {item.previousQty}</Typography>}
                    </Stack>
                  ))}
                  {c.op === 'ADD_MENU' && !c.ingredients?.length && (
                    <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>구성 식자재는 나중에 요청할 수 있습니다. 없으면 재고 차감과 발주 계산에서 빠집니다.</Typography>
                  )}
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

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>메뉴</Typography>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <FormControlLabel label={<Typography variant="body2">수동 입력</Typography>} sx={{ mr: 0 }}
              control={<Switch size="small" checked={manual} onChange={(e) => setManual(e.target.checked)} />} />
            <Chip size="small" variant="outlined" color="primary" label={`총 ${menus.length}개`} />
          </Stack>
        </Stack>
        {manual && (
          <Stack component="form" direction="row" gap={1} alignItems="center" flexWrap="wrap" mb={2} onSubmit={addMenuManually}>
            <TextField size="small" label="메뉴 이름" required value={newMenu.menuName} onChange={(e) => setNewMenu({ ...newMenu, menuName: e.target.value })} />
            <TextField size="small" label="가격" type="number" required value={newMenu.price} sx={{ width: 120 }} inputProps={{ min: 0 }}
              onChange={(e) => setNewMenu({ ...newMenu, price: e.target.value })} />
            <Button type="submit" size="small" variant="outlined" disabled={!newMenu.menuName.trim() || newMenu.price === ''}>메뉴 추가</Button>
            <Typography variant="caption" color="text.secondary">AI 요청을 쓸 수 없을 때 사용합니다. 메뉴를 눌러 가격과 구성 식자재를 고칠 수 있습니다.</Typography>
          </Stack>
        )}
        {loading ? (
          <Stack alignItems="center" py={4}><CircularProgress /></Stack>
        ) : menus.length === 0 ? (
          <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>등록된 메뉴가 없습니다. 위에서 요청해 보세요.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>메뉴</TableCell>
                  <TableCell align="right">가격</TableCell>
                  <TableCell align="right">구성 식자재</TableCell>
                  <TableCell padding="checkbox" />
                </TableRow>
              </TableHead>
              <TableBody>
                {menus.map((menu) => {
                  const recipe = recipeOf(menu.id);
                  const open = openMenuId === menu.id;
                  return (
                    <Fragment key={menu.id}>
                      <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setOpenMenuId(open ? null : menu.id)}>
                        <TableCell><Typography variant="body2" fontWeight={600}>{menu.menuName}</Typography></TableCell>
                        <TableCell align="right">₩{menu.price?.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          {recipe.length > 0 ? `${recipe.length}개` : <Chip size="small" color="warning" variant="outlined" label="미등록" />}
                        </TableCell>
                        <TableCell padding="checkbox">
                          <IconifyIcon icon={open ? 'mingcute:up-line' : 'mingcute:down-line'} width={18} />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4} sx={{ py: 0, border: open ? undefined : 'none' }}>
                          <Collapse in={open} unmountOnExit>
                            <Stack sx={{ py: 1.5, pl: 1 }} gap={0.5}>
                              {recipe.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  구성 식자재가 없습니다. 재고 차감과 발주 계산에서 빠집니다. "{menu.menuName} 구성 식자재는 ..."처럼 요청해 주세요.
                                </Typography>
                              ) : recipe.map((r) => (
                                <Stack key={r.id} direction="row" justifyContent="space-between" sx={{ maxWidth: 360 }}>
                                  <Typography variant="body2">{r.ingredientName}</Typography>
                                  <Typography variant="body2" color="text.secondary">1개당 {r.qtyPerUnit} {r.unit}</Typography>
                                </Stack>
                              ))}
                              {manual && storeId && (
                                <RecipeManualEditor key={`${menu.id}-${menu.price}`} storeId={storeId} menu={menu} recipe={recipe} ingredients={ingredients}
                                  onChanged={() => { setError(''); load(storeId); }} onError={setError} />
                              )}
                            </Stack>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Stack>
  );
};

export default MenuManagement;
