import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, ButtonBase, IconButton, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { salesService } from '../services/salesService';
import { menuService } from '../services/menuService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';
import { TOSS, TossPage, TossCard, ListRow, EmptyState, tossButtonSx } from '../components/TossUI';

// 로컬 날짜 (toISOString 은 UTC 라 한국 오전 9시 전에는 어제 날짜가 된다)
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 판매 등록만 한다. 내역은 '판매 내역' 탭(/sales/history)에서 기간을 골라 본다
const SalesEntry = ({ user }: any) => {
  const navigate = useNavigate();
  const [menus, setMenus] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [saleDate, setSaleDate] = useState(todayYmd());
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [todaySales, setTodaySales] = useState<any[]>([]);

  const loadToday = (sid: number) =>
    salesService.getByDateRange(sid, todayYmd(), todayYmd())
      .then((rows: any[]) => setTodaySales([...rows].sort((a, b) => b.id - a.id)))
      .catch(() => setTodaySales([]));

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) return;
        const stores = await storeService.getMyStores(user.id);
        if (!stores || stores.length === 0) {
          setError('등록된 가게가 없습니다. 가게를 먼저 등록해주세요.');
          return;
        }
        setStoreId(stores[0].id);
        setMenus(await menuService.getByStore(stores[0].id));
        loadToday(stores[0].id);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('데이터를 불러오지 못했습니다.');
      }
    };
    fetchData();
  }, [user]);

  const selected = menus.find((m) => m.id === menuId);
  const total = selected ? selected.price * quantity : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !selected) return;
    setSaving(true);
    setError('');
    try {
      await salesService.create({ storeId, menuId: selected.id, quantity, totalPrice: total, saleDate });
      setSuccess(`${selected.menuName} ${quantity}개 판매를 기록했어요.`);
      setQuantity(1);
      loadToday(storeId);
    } catch (err: any) {
      setError(err?.message || '매출 기록을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const tile = (m: any) => {
    const on = m.id === menuId;
    return (
      <ButtonBase key={m.id} onClick={() => setMenuId(m.id)} aria-pressed={on}
        sx={{
          display: 'block', textAlign: 'left', borderRadius: '18px', p: 1.25, transition: 'all .2s',
          background: on ? `linear-gradient(160deg, ${TOSS.green}24, ${TOSS.green}08)` : TOSS.bg,
          boxShadow: on ? `inset 0 0 0 2px ${TOSS.green}` : 'none',
          '&:hover': { background: on ? undefined : 'rgba(15,30,50,0.07)' },
        }}>
        <Box sx={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: '12px', overflow: 'hidden', mb: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `radial-gradient(circle at 30% 30%, ${TOSS.green}26, ${TOSS.green}0A)` }}>
          {m.imageUrl
            ? <Box component="img" src={m.imageUrl} alt={m.menuName} sx={{ width: 1, height: 1, objectFit: 'cover' }} />
            : <IconifyIcon icon="mingcute:fork-spoon-line" color={TOSS.green} width={32} />}
          {on && (
            <Box sx={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', bgcolor: TOSS.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(29,158,117,.4)' }}>
              <IconifyIcon icon="mingcute:check-line" color="#fff" width={16} />
            </Box>
          )}
        </Box>
        <Typography noWrap sx={{ fontSize: 15, fontWeight: 700, color: TOSS.text }}>{m.menuName}</Typography>
        <Typography sx={{ fontSize: 14, color: TOSS.sub }}>{m.price.toLocaleString()}원</Typography>
      </ButtonBase>
    );
  };

  const todayTotal = todaySales.reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);

  return (
    <TossPage wide>
      {error && <Alert severity="error" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && (
        <Alert severity="success" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setSuccess('')}
          action={<Button color="inherit" size="small" onClick={() => navigate('/sales/history')}>내역 보기</Button>}>
          {success}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px', lg: 'minmax(0, 1fr) 400px' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>

        {/* 왼쪽: 메뉴 고르기 (POS 처럼 타일) */}
        <TossCard title="무엇을 팔았나요?" right={menus.length > 0 ? <Typography sx={{ fontSize: 14, color: TOSS.sub }}>메뉴 {menus.length}개</Typography> : undefined}>
          {menus.length === 0 ? (
            <EmptyState icon="mingcute:fork-spoon-line" title="등록된 메뉴가 없어요" desc="메뉴 관리에서 메뉴를 먼저 추가해 주세요."
              action={<Button variant="outlined" sx={{ borderRadius: '12px' }} onClick={() => navigate('/menus')}>메뉴 관리로 가기</Button>} />
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' } }}>
              {menus.map(tile)}
            </Box>
          )}
        </TossCard>

        {/* 오른쪽: 주문 요약 (스크롤해도 따라온다) + 오늘 기록 */}
        <Box sx={{ position: { md: 'sticky' }, top: { md: 140 } }}>
          <Box sx={{ borderRadius: '24px', p: { xs: 2.5, md: 3 }, position: 'relative', overflow: 'hidden',
            background: `linear-gradient(165deg, rgba(255,255,255,0.9), rgba(242,244,246,0.75)), radial-gradient(circle at 0% 0%, ${TOSS.green}22, transparent 60%)`,
            backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(15,30,50,0.06)' }}>
            <Typography sx={{ fontSize: 14, color: TOSS.sub }}>{selected ? '선택한 메뉴' : '왼쪽에서 메뉴를 골라 주세요'}</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: TOSS.text, mt: 0.25, minHeight: 33 }} noWrap>{selected?.menuName ?? '—'}</Typography>

            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2.5}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: TOSS.text }}>수량</Typography>
              <Stack direction="row" alignItems="center" gap={1} sx={{ bgcolor: '#FFFFFF', borderRadius: '12px', p: 0.5, boxShadow: '0 1px 4px rgba(15,30,50,0.06)' }}>
                <IconButton size="small" aria-label="수량 줄이기" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <IconifyIcon icon="mingcute:minimize-line" />
                </IconButton>
                <TextField variant="standard" value={quantity} inputProps={{ 'aria-label': '수량', inputMode: 'numeric', style: { textAlign: 'center', width: 44, fontSize: 18, fontWeight: 700 } }}
                  InputProps={{ disableUnderline: true }}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                <IconButton size="small" aria-label="수량 늘리기" onClick={() => setQuantity((q) => q + 1)}>
                  <IconifyIcon icon="mingcute:add-line" />
                </IconButton>
              </Stack>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5}>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: TOSS.text }}>판매일</Typography>
              <TextField size="small" type="date" value={saleDate} inputProps={{ max: todayYmd(), 'aria-label': '판매일' }}
                sx={{ '& .MuiInputBase-root': { borderRadius: '12px', bgcolor: '#FFFFFF' }, '& fieldset': { border: 'none' } }}
                onChange={(e) => e.target.value && setSaleDate(e.target.value)} />
            </Stack>

            <Box sx={{ my: 2.5, height: '1px', background: `linear-gradient(90deg, transparent, ${TOSS.line}, transparent)` }} />
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={2}>
              <Typography sx={{ fontSize: 15, color: TOSS.sub }}>{selected ? `${selected.price.toLocaleString()}원 × ${quantity}` : '합계'}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 800, color: TOSS.text, letterSpacing: '-0.02em' }}>{total.toLocaleString()}원</Typography>
            </Stack>
            <Button type="submit" fullWidth variant="contained" disabled={saving || !selected} sx={tossButtonSx}>
              {saving ? '기록하는 중…' : '판매 기록하기'}
            </Button>
          </Box>

          {/* 오늘 기록한 판매: 넓은 화면의 빈 곳을 실제로 쓸모 있는 정보로 */}
          <Box mt={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={0.5}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: TOSS.text }}>오늘 기록</Typography>
              <Typography sx={{ fontSize: 14, color: TOSS.sub }}>{todaySales.length}건 · {todayTotal.toLocaleString()}원</Typography>
            </Stack>
            {todaySales.length === 0 ? (
              <Typography sx={{ fontSize: 14, color: TOSS.sub, py: 1.5 }}>오늘은 아직 기록한 판매가 없어요.</Typography>
            ) : todaySales.slice(0, 5).map((r) => (
              <ListRow key={r.id} icon="mingcute:receive-money-line" iconColor={TOSS.green}
                title={r.menu?.menuName ?? '-'} desc={`${r.quantity}개`} right={`${(r.totalPrice ?? 0).toLocaleString()}원`} />
            ))}
            {todaySales.length > 5 && (
              <Button size="small" onClick={() => navigate('/sales/history')} sx={{ mt: 0.5, color: TOSS.sub, fontWeight: 600 }}>
                {todaySales.length - 5}건 더 보기
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </TossPage>
  );
};

export default SalesEntry;
