import React, { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, TextField, MenuItem,
  CircularProgress, Alert, Stack, useTheme, IconButton, Chip,
} from '@mui/material';
import { salesService } from '../services/salesService';
import { menuService } from '../services/menuService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import EventNoteCard from '../components/EventNoteCard';
import SalesImportDialog from '../components/agent/SalesImportDialog';
import { localDate } from '../helpers/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dateLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};
const todayIso = () => localDate(new Date());
// 판매 내역은 날짜 묶음으로 조금씩 보여 준다 (전체 이력이 길다)
const DAYS_PER_PAGE = 14;

const SalesEntry = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ menuId: '', quantity: 1, saleDate: todayIso() });
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [flags, setFlags] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [flagForm, setFlagForm] = useState({ flagType: 'SOLD_OUT', menuId: '', flagDate: todayIso() });
  const [shownDays, setShownDays] = useState(DAYS_PER_PAGE);

  const loadFlags = async (sid: number) => {
    try {
      setFlags((await salesService.getFlags(sid)) ?? []);
    } catch {
      setError('휴무·품절 기록을 불러오지 못했습니다.');
    }
  };

  const loadSales = async (sid: number) => {
    try {
      const sales = await salesService.getByStore(sid);
      setRows(sales.map((item: any) => ({
        id: item.id,
        menuName: item.menuName ?? '-',
        quantity: item.quantity,
        totalPrice: (item.unitPrice ?? item.menuPrice ?? 0) * item.quantity,
        saleDate: item.saleDate,
      })));
    } catch (err) {
      console.error('Failed to load sales:', err);
      setError('판매 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) return;
        const stores = await storeService.getMyStores(user.id);
        if (!stores || stores.length === 0) {
          setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.');
          return;
        }
        const firstStoreId = stores[0].id;
        setStoreId(firstStoreId);
        const storeMenus = await menuService.getByStore(firstStoreId);
        setMenus(storeMenus);
        await loadSales(firstStoreId);
        await loadFlags(firstStoreId);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !formData.menuId) return;

    try {
      const selectedMenu: any = menus.find((m: any) => m.id === Number(formData.menuId));
      const totalPrice = selectedMenu ? selectedMenu.price * formData.quantity : 0;

      await salesService.create({
        storeId,
        menuId: formData.menuId,
        quantity: formData.quantity,
        totalPrice,
        saleDate: formData.saleDate,
      });

      await loadSales(storeId);
      setSuccess('매출 기록이 성공적으로 등록되었습니다.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Failed to create sale:', error);
      setError('매출 기록을 저장하지 못했습니다.');
    }
  };

  const handleFlagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || (flagForm.flagType === 'SOLD_OUT' && !flagForm.menuId)) return;
    try {
      await salesService.createFlag({
        storeId,
        flagDate: flagForm.flagDate,
        flagType: flagForm.flagType as 'CLOSED' | 'SOLD_OUT',
        ...(flagForm.flagType === 'SOLD_OUT' ? { menuId: Number(flagForm.menuId) } : {}),
      });
      await loadFlags(storeId);
    } catch {
      setError('휴무·품절 기록에 실패했습니다.');
    }
  };

  const handleFlagDelete = async (id: number) => {
    if (!storeId) return;
    try {
      await salesService.deleteFlag(id);
      await loadFlags(storeId);
    } catch {
      setError('기록 삭제에 실패했습니다.');
    }
  };

  const menuName = (menuId: number) => (menus as any[]).find((m) => m.id === menuId)?.menuName ?? '메뉴';

  // 날짜별 묶음 (최근 날짜부터)
  const byDate = new Map<string, any[]>();
  [...rows].sort((a, b) => String(b.saleDate).localeCompare(String(a.saleDate)))
    .forEach((r) => byDate.set(r.saleDate, [...(byDate.get(r.saleDate) ?? []), r]));
  const days = [...byDate.entries()];
  const todayRows = byDate.get(todayIso()) ?? [];
  const todayQty = todayRows.reduce((s, r) => s + r.quantity, 0);
  const todayAmount = todayRows.reduce((s, r) => s + (r.totalPrice ?? 0), 0);

  const selectedMenu: any = (menus as any[]).find((m) => m.id === Number(formData.menuId));
  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 36, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.default',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 + 파일 등록 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>오늘 판매</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {loading ? '-' : `${todayQty.toLocaleString()}개`}
          </Typography>
          {!loading && (
            <Typography fontSize={15} color="text.secondary" mt={1}>매출 ₩{todayAmount.toLocaleString()}</Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:file-upload-line" />}
          disabled={!storeId} onClick={() => setImportOpen(true)}>
          POS 파일로 등록 (AI)
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '400px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Stack gap={5}>
          {/* 판매 입력 */}
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 5, gap: 4 }}>
            <Typography fontSize={18} fontWeight={700}>판매 입력</Typography>
            <Box>
              <Typography variant="body2" color="text.secondary" mb={1.5}>메뉴</Typography>
              {(menus as any[]).length === 0 ? (
                <Typography variant="body2" color="text.disabled">등록된 메뉴가 없어요</Typography>
              ) : (
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {(menus as any[]).map((m) => pill(m.menuName, String(m.id) === String(formData.menuId),
                    () => setFormData({ ...formData, menuId: String(m.id) })))}
                </Stack>
              )}
            </Box>
            <Stack direction="row" gap={2} alignItems="flex-end">
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" color="text.secondary" mb={1.5}>수량</Typography>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ bgcolor: 'background.default', borderRadius: 3, px: 1, py: 0.5 }}>
                  <IconButton aria-label="수량 줄이기" disabled={formData.quantity <= 1}
                    onClick={() => setFormData({ ...formData, quantity: formData.quantity - 1 })}>
                    <IconifyIcon icon="mingcute:minimize-line" width={18} />
                  </IconButton>
                  <TextField
                    variant="standard" type="number" value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    inputProps={{ min: 1, 'aria-label': '수량', style: { textAlign: 'center', fontSize: 18, fontWeight: 700 } }}
                    InputProps={{ disableUnderline: true }}
                    sx={{ width: 64 }}
                  />
                  <IconButton aria-label="수량 늘리기" onClick={() => setFormData({ ...formData, quantity: formData.quantity + 1 })}>
                    <IconifyIcon icon="mingcute:add-line" width={18} />
                  </IconButton>
                </Stack>
              </Box>
              <TextField
                type="date" label="판매 일자" required size="small"
                InputLabelProps={{ shrink: true }}
                value={formData.saleDate}
                onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Button type="submit" fullWidth size="large" disabled={!formData.menuId} sx={{ py: 2, fontSize: 16 }}>
              {selectedMenu ? `${selectedMenu.menuName} ${formData.quantity}개 기록` : '메뉴를 골라 주세요'}
            </Button>
          </Paper>

          {/* 휴무·품절 기록 */}
          <Paper component="form" onSubmit={handleFlagSubmit} sx={{ p: 5, gap: 3 }}>
            <Box>
              <Typography fontSize={18} fontWeight={700} mb={1}>휴무·품절 기록</Typography>
              <Typography variant="body2" color="text.secondary">
                품절된 날의 판매량은 실제 수요보다 작고, 휴무일에는 판매가 없습니다. 기록하면 AI 예측 학습에서 제외하고, 휴무일은 발주 예측을 0으로 둡니다.
              </Typography>
            </Box>
            <Stack direction="row" gap={1}>
              {pill('메뉴 품절', flagForm.flagType === 'SOLD_OUT', () => setFlagForm({ ...flagForm, flagType: 'SOLD_OUT' }))}
              {pill('매장 휴무', flagForm.flagType === 'CLOSED', () => setFlagForm({ ...flagForm, flagType: 'CLOSED' }))}
            </Stack>
            <Stack direction="row" gap={2}>
              {flagForm.flagType === 'SOLD_OUT' && (
                <TextField
                  select size="small" label="품절 메뉴" required
                  value={flagForm.menuId}
                  onChange={(e) => setFlagForm({ ...flagForm, menuId: e.target.value })}
                  sx={{ flex: 1 }}
                >
                  {menus.map((menu: any) => (
                    <MenuItem key={menu.id} value={menu.id}>{menu.menuName}</MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                type="date" size="small" label="날짜" required
                InputLabelProps={{ shrink: true }}
                value={flagForm.flagDate}
                onChange={(e) => setFlagForm({ ...flagForm, flagDate: e.target.value })}
                sx={{ flex: 1 }}
              />
            </Stack>
            <Button type="submit" variant="outlined" fullWidth>기록</Button>
            {flags.length > 0 && (
              <Box sx={{ maxHeight: 240, overflowY: 'auto' }}>
                {flags.map((f) => (
                  <Stack key={f.id} direction="row" alignItems="center" gap={2} sx={{ py: 2, ...rowSx }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography fontWeight={600} fontSize={15}>{f.flagType === 'CLOSED' ? '매장 휴무' : `${menuName(f.menuId)} 품절`}</Typography>
                      <Typography variant="body2" color="text.secondary">{f.flagDate}</Typography>
                    </Box>
                    <IconButton size="small" aria-label="기록 삭제" onClick={() => handleFlagDelete(f.id)}>
                      <IconifyIcon icon="mingcute:delete-2-line" width={18} color={theme.palette.text.disabled} />
                    </IconButton>
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>

          {storeId && <EventNoteCard storeId={storeId} />}
        </Stack>

        {/* 판매 내역 (날짜별 묶음, 토스 거래 내역처럼) */}
        <Paper sx={{ p: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography fontSize={18} fontWeight={700}>판매 내역</Typography>
            <Typography variant="body2" color="text.secondary">총 {rows.length.toLocaleString()}건</Typography>
          </Stack>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress /></Stack>
          ) : days.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>등록된 판매 내역이 없습니다.</Typography>
          ) : (
            <>
              {days.slice(0, shownDays).map(([date, list]) => (
                <Box key={date} sx={{ mb: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <Typography fontWeight={700} fontSize={15}>{dateLabel(date)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {list.reduce((s, r) => s + r.quantity, 0).toLocaleString()}개 · ₩{list.reduce((s, r) => s + (r.totalPrice ?? 0), 0).toLocaleString()}
                    </Typography>
                  </Stack>
                  {list.map((r) => (
                    <Stack key={r.id} direction="row" alignItems="center" gap={2} sx={{ py: 1.75 }}>
                      <Typography fontSize={15} sx={{ flex: 1, minWidth: 0 }} noWrap>{r.menuName}</Typography>
                      <Typography fontSize={15} color="text.secondary">{r.quantity}개</Typography>
                      <Typography fontSize={15} fontWeight={700} sx={{ minWidth: 96, textAlign: 'right' }}>
                        ₩{r.totalPrice?.toLocaleString() ?? 0}
                      </Typography>
                    </Stack>
                  ))}
                </Box>
              ))}
              {days.length > shownDays && (
                <Button variant="outlined" fullWidth onClick={() => setShownDays(shownDays + DAYS_PER_PAGE)}>
                  이전 {Math.min(DAYS_PER_PAGE, days.length - shownDays)}일 더 보기
                </Button>
              )}
            </>
          )}
        </Paper>
      </Box>
      {storeId && (
        <SalesImportDialog open={importOpen} storeId={storeId} menus={menus} onClose={() => setImportOpen(false)}
          onSaved={() => { loadSales(storeId); setSuccess('판매 파일을 등록했습니다.'); }} />
      )}
    </Stack>
  );
};

export default SalesEntry;
