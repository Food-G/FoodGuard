import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Divider, Alert, CircularProgress,
  ToggleButtonGroup, ToggleButton, TextField,
  useTheme, alpha,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import MenuSettingsDialog from '../components/MenuSettingsDialog';
import { menuService } from '../services/menuService';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';

interface OrderItem {
  menuId: number;
  menuName: string;
  price: number;
  qty: number;
}

interface Table {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: 'empty' | 'occupied';
  orders: OrderItem[];
  placed: boolean;        // 주방 주문 전송 완료
  guests: number;         // 인원수
  seatedAt: number | null;// 착석 시각(ms)
  takeout: boolean;       // 포장 주문
}

type Discount = { type: 'amount' | 'percent'; value: number };

let nextId = 7;

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;

const elapsedLabel = (seatedAt: number | null, now: number) => {
  if (!seatedAt) return '';
  const min = Math.floor((now - seatedAt) / 60000);
  if (min < 60) return `${min}분`;
  return `${Math.floor(min / 60)}시간 ${min % 60}분`;
};

const defaultTables = (): Table[] => [
  { id: 1, name: '1번', x: 40,  y: 60,  w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
  { id: 2, name: '2번', x: 190, y: 60,  w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
  { id: 3, name: '3번', x: 340, y: 60,  w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
  { id: 4, name: '4번', x: 40,  y: 200, w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
  { id: 5, name: '5번', x: 190, y: 200, w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
  { id: 6, name: '6번', x: 340, y: 200, w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false },
];

// ── 숫자 패드 (현금 결제) ─────────────────────────────────────────────
const Numpad = ({ onInput, onClear, onBackspace }: { onInput: (d: string) => void; onClear: () => void; onBackspace: () => void; }) => {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '00', '0', '←'];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
      {keys.map(k => (
        <Button
          key={k}
          variant="outlined"
          onClick={() => k === '←' ? onBackspace() : onInput(k)}
          sx={{ py: 2, fontSize: 22, fontWeight: 800, borderRadius: 2, color: 'text.primary', borderColor: 'divider' }}
        >
          {k}
        </Button>
      ))}
      <Button variant="outlined" color="error" onClick={onClear} sx={{ gridColumn: '1 / -1', py: 1.2, fontWeight: 800, borderRadius: 2 }}>
        정정 (C)
      </Button>
    </Box>
  );
};

const POS = ({ user }: any) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<'tables' | 'order'>('tables');
  const [tables, setTables] = useState<Table[]>(defaultTables);
  const [selected, setSelected] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [category, setCategory] = useState('전체');
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [now, setNow] = useState(Date.now());

  // 다이얼로그 상태
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ tableName: string; orders: OrderItem[]; subtotal: number; discount: number; total: number; method: string; received?: number; change?: number } | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitWays, setSplitWays] = useState(2);
  const [splitPaid, setSplitPaid] = useState(0);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discounts, setDiscounts] = useState<Record<number, Discount>>({});
  const [discInput, setDiscInput] = useState('');
  const [discType, setDiscType] = useState<'amount' | 'percent'>('amount');
  const [moveOpen, setMoveOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [menuSettingsOpen, setMenuSettingsOpen] = useState(false);
  const [todaySummary, setTodaySummary] = useState<{ revenue: number; qty: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const dragRef = useRef<{ id: number; ox: number; oy: number; tx: number; ty: number } | null>(null);
  const resizeRef = useRef<{ id: number; sx: number; sy: number; ow: number; oh: number } | null>(null);

  const loadMenus = (sid: number) =>
    menuService.getByStore(sid)
      .then((ms: any[]) => ms && setMenus(ms.filter((m: any) => m.isActive !== false && m.isActive !== 0)))
      .catch(() => {});

  const loadSummary = (sid: number) =>
    salesService.getTodaySummary(sid)
      .then((s: any) => s && setTodaySummary({ revenue: s.revenue ?? 0, qty: s.qty ?? 0 }))
      .catch(() => {});

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores: any[]) => {
        if (!stores?.length) { setLoading(false); return; }
        const sid = stores[0].id;
        setStoreId(sid);
        loadSummary(sid);
        return menuService.getByStore(sid);
      })
      .then((ms: any[]) => ms && setMenus(ms.filter((m: any) => m.isActive !== false && m.isActive !== 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  // 실시간 시계 / 경과시간 갱신
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const selectedTable = tables.find(t => t.id === selected) ?? null;
  const subtotal = selectedTable?.orders.reduce((s, o) => s + o.price * o.qty, 0) ?? 0;
  const discount = selectedTable ? discountFor(discounts[selectedTable.id], subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  function discountFor(d: Discount | undefined, base: number) {
    if (!d) return 0;
    return d.type === 'amount' ? Math.min(d.value, base) : Math.round(base * d.value / 100);
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    menus.forEach(m => set.add(m.category || '기타'));
    return ['전체', ...Array.from(set)];
  }, [menus]);

  const visibleMenus = category === '전체' ? menus : menus.filter(m => (m.category || '기타') === category);

  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 2500); };
  const flashErr = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 3000); };

  // ── 테이블 선택 ──────────────────────────────────────────────────────
  const openTable = (id: number) => { setSelected(id); setView('order'); };

  // ── 드래그 / 리사이즈 ────────────────────────────────────────────────
  const onTableMouseDown = (e: React.MouseEvent, id: number) => {
    const t = tables.find(t => t.id === id)!;
    dragRef.current = { id, ox: e.clientX, oy: e.clientY, tx: t.x, ty: t.y };
  };
  const onResizeMouseDown = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const t = tables.find(t => t.id === id)!;
    resizeRef.current = { id, sx: e.clientX, sy: e.clientY, ow: t.w, oh: t.h };
  };
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (dragRef.current) {
      const { id, ox, oy, tx, ty } = dragRef.current;
      const t = tables.find(t => t.id === id)!;
      const maxX = (rect?.width ?? 600) - t.w;
      const maxY = (rect?.height ?? 400) - t.h;
      setTables(prev => prev.map(t =>
        t.id === id
          ? { ...t, x: Math.max(0, Math.min(tx + e.clientX - ox, maxX)), y: Math.max(0, Math.min(ty + e.clientY - oy, maxY)) }
          : t));
    }
    if (resizeRef.current) {
      const { id, sx, sy, ow, oh } = resizeRef.current;
      setTables(prev => prev.map(t =>
        t.id === id ? { ...t, w: Math.max(80, ow + e.clientX - sx), h: Math.max(64, oh + e.clientY - sy) } : t));
    }
  };
  const onCanvasMouseUp = () => { dragRef.current = null; resizeRef.current = null; };

  // ── 주문 담기 ────────────────────────────────────────────────────────
  const addToOrder = (menu: any) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const existing = t.orders.find(o => o.menuId === menu.id);
      const orders = existing
        ? t.orders.map(o => o.menuId === menu.id ? { ...o, qty: o.qty + 1 } : o)
        : [...t.orders, { menuId: menu.id, menuName: menu.menuName, price: menu.price, qty: 1 }];
      return { ...t, status: 'occupied', seatedAt: t.seatedAt ?? Date.now(), guests: t.guests || 1, orders };
    }));
  };
  const changeQty = (menuId: number, delta: number) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const orders = t.orders
        .map(o => o.menuId === menuId ? { ...o, qty: o.qty + delta } : o)
        .filter(o => o.qty > 0);
      return { ...t, status: orders.length ? 'occupied' : 'empty', orders, placed: orders.length ? t.placed : false };
    }));
  };
  const removeLine = (menuId: number) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const orders = t.orders.filter(o => o.menuId !== menuId);
      return { ...t, status: orders.length ? 'occupied' : 'empty', orders, placed: orders.length ? t.placed : false };
    }));
  };
  const clearOrder = () => {
    if (!selectedTable || !selectedTable.orders.length) return;
    if (!window.confirm('현재 테이블의 주문을 전체 취소할까요?')) return;
    setTables(prev => prev.map(t => t.id === selected
      ? { ...t, status: 'empty', orders: [], placed: false, seatedAt: null }
      : t));
    setDiscounts(d => { const c = { ...d }; if (selected) delete c[selected]; return c; });
  };

  // ── 주방 주문 전송 ───────────────────────────────────────────────────
  const sendToKitchen = () => {
    if (!selectedTable || !selectedTable.orders.length) return;
    setTables(prev => prev.map(t => t.id === selected ? { ...t, placed: true } : t));
    flash('주방으로 주문이 전송되었습니다.');
  };

  // ── 인원수 ──────────────────────────────────────────────────────────
  const setGuests = (n: number) => {
    setTables(prev => prev.map(t => t.id === selected ? { ...t, guests: Math.max(0, n) } : t));
  };

  // ── 할인 ────────────────────────────────────────────────────────────
  const applyDiscount = () => {
    const v = parseInt(discInput, 10);
    if (!selected || !v || v <= 0) { setDiscountOpen(false); setDiscInput(''); return; }
    setDiscounts(d => ({ ...d, [selected]: { type: discType, value: v } }));
    setDiscountOpen(false);
    setDiscInput('');
    flash(discType === 'amount' ? `${won(v)} 할인 적용` : `${v}% 할인 적용`);
  };
  const clearDiscount = () => {
    if (!selected) return;
    setDiscounts(d => { const c = { ...d }; delete c[selected]; return c; });
    setDiscountOpen(false);
    setDiscInput('');
  };

  // ── 테이블 이동 ──────────────────────────────────────────────────────
  const moveTable = (targetId: number) => {
    if (!selectedTable) return;
    setTables(prev => {
      const src = prev.find(t => t.id === selected)!;
      return prev.map(t => {
        if (t.id === targetId) return { ...t, status: src.status, orders: src.orders, placed: src.placed, guests: src.guests, seatedAt: src.seatedAt, takeout: src.takeout };
        if (t.id === selected) return { ...t, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false };
        return t;
      });
    });
    setDiscounts(d => {
      const c = { ...d };
      if (selected && c[selected]) { c[targetId] = c[selected]; delete c[selected]; }
      return c;
    });
    setSelected(targetId);
    setMoveOpen(false);
    flash('테이블이 이동되었습니다.');
  };

  // ── 결제 처리 ────────────────────────────────────────────────────────
  const registerSales = async () => {
    if (!selectedTable || !storeId) return;
    const today = new Date().toISOString().split('T')[0];
    await Promise.all(
      selectedTable.orders.map(o =>
        salesService.create({ storeId, menuId: o.menuId, quantity: o.qty, totalPrice: o.price * o.qty, saleDate: today })
      )
    );
  };

  const finalizePayment = async (method: string, received?: number) => {
    if (!selectedTable || !storeId || !selectedTable.orders.length) return;
    setPaying(true);
    try {
      await registerSales();
      setReceipt({
        tableName: selectedTable.takeout ? '포장' : `${selectedTable.name} 테이블`,
        orders: [...selectedTable.orders],
        subtotal, discount, total, method,
        received,
        change: received != null ? received - total : undefined,
      });
      setReceiptOpen(true);
      if (storeId) loadSummary(storeId);
    } catch {
      flashErr('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setPaying(false);
      setCashOpen(false);
      setSplitOpen(false);
    }
  };

  // 카드 결제
  const payCard = () => finalizePayment('카드');

  // 현금 결제
  const openCash = () => { setCashInput(''); setCashOpen(true); };
  const cashReceived = parseInt(cashInput || '0', 10);
  const cashChange = cashReceived - total;
  const confirmCash = () => {
    if (cashReceived < total) { flashErr('받은 금액이 부족합니다.'); return; }
    finalizePayment('현금', cashReceived);
  };

  // 분할 결제
  const openSplit = () => { setSplitWays(Math.max(2, selectedTable?.guests || 2)); setSplitPaid(0); setSplitOpen(true); };
  const splitAmount = Math.ceil(total / splitWays / 10) * 10;
  const paySplitOne = () => {
    const next = splitPaid + 1;
    if (next >= splitWays) {
      finalizePayment(`분할(${splitWays}인)`);
    } else {
      setSplitPaid(next);
    }
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setTables(prev => prev.map(t => t.id === selected
      ? { ...t, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false }
      : t));
    setDiscounts(d => { const c = { ...d }; if (selected) delete c[selected]; return c; });
    setSelected(null);
    setView('tables');
    flash('결제 완료 · 매출이 자동 등록되었습니다.');
  };

  const printReceipt = () => window.print();

  // ── 테이블 관리 ──────────────────────────────────────────────────────
  const addTable = () => {
    const id = nextId++;
    setTables(prev => [...prev, { id, name: `${id}번`, x: 60, y: 60, w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: false }]);
  };
  const addTakeout = () => {
    const id = nextId++;
    setTables(prev => [...prev, { id, name: `포장${id}`, x: 60, y: 320, w: 110, h: 90, status: 'empty', orders: [], placed: false, guests: 0, seatedAt: null, takeout: true }]);
    openTable(id);
  };
  const removeTable = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTables(prev => prev.filter(t => t.id !== id));
    if (selected === id) { setSelected(null); setView('tables'); }
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

  const occupiedCount = tables.filter(t => t.status === 'occupied').length;

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')} sx={{ py: 0.2 }}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg('')} sx={{ py: 0.2 }}>{errorMsg}</Alert>}

      {/* ── 상단 상태바 ── */}
      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, bgcolor: 'primary.dark', color: 'white' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <IconifyIcon icon="mingcute:store-line" width={26} />
            <Typography variant="h5" fontWeight={900}>FoodGuard POS</Typography>
            <Chip size="small" label={new Date(now).toLocaleTimeString('ko-KR')} sx={{ bgcolor: alpha('#fff', 0.18), color: 'white', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
          </Stack>
          <Stack direction="row" alignItems="center" gap={1}>
            <Chip size="small" icon={<IconifyIcon icon="mingcute:fork-spoon-line" width={16} />} label={`사용 ${occupiedCount} / ${tables.length}`} sx={{ bgcolor: alpha('#fff', 0.18), color: 'white', fontWeight: 700, '& .MuiChip-icon': { color: 'white' } }} />
            {todaySummary && (
              <Chip size="small" icon={<IconifyIcon icon="mingcute:currency-won-line" width={16} />} label={`오늘 ${won(todaySummary.revenue)} · ${todaySummary.qty}건`} sx={{ bgcolor: alpha('#fff', 0.18), color: 'white', fontWeight: 700, '& .MuiChip-icon': { color: 'white' } }} />
            )}
            <ToggleButtonGroup
              size="small" exclusive value={view}
              onChange={(_, v) => v && setView(v)}
              sx={{ bgcolor: alpha('#fff', 0.12), borderRadius: 2, '& .MuiToggleButton-root': { color: 'white', border: 'none', px: 1.5, fontWeight: 700 }, '& .Mui-selected': { bgcolor: 'white !important', color: 'primary.dark !important' } }}
            >
              <ToggleButton value="tables"><IconifyIcon icon="mingcute:grid-line" width={18} />&nbsp;테이블</ToggleButton>
              <ToggleButton value="order" disabled={!selectedTable}><IconifyIcon icon="mingcute:bill-line" width={18} />&nbsp;주문</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Paper>

      {/* ══════════════ 테이블 배치도 뷰 ══════════════ */}
      {view === 'tables' && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" gap={1}>
              <Chip size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.15), color: 'success.main', fontWeight: 700 }} label="빈 자리" />
              <Chip size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.15), color: 'warning.main', fontWeight: 700 }} label="사용 중" />
              <Typography variant="caption" color="text.disabled" alignSelf="center" ml={1}>드래그로 이동 · 우하단 핸들로 크기 조절</Typography>
            </Stack>
            <Stack direction="row" gap={1}>
              <Button variant="outlined" size="small" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={addTable}>테이블</Button>
              <Button variant="outlined" size="small" color="secondary" startIcon={<IconifyIcon icon="mingcute:box-3-line" />} onClick={addTakeout}>포장</Button>
              <Button variant="outlined" size="small" startIcon={<IconifyIcon icon="mingcute:settings-3-line" />} onClick={() => setMenuSettingsOpen(true)}>메뉴 설정</Button>
            </Stack>
          </Stack>

          <Paper
            ref={canvasRef}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            elevation={0}
            sx={{
              flex: 1, position: 'relative', overflow: 'hidden',
              bgcolor: alpha(theme.palette.primary.main, 0.02),
              border: `2px dashed ${theme.palette.divider}`, borderRadius: 3, userSelect: 'none',
            }}
          >
            {tables.map(table => {
              const amount = table.orders.reduce((s, o) => s + o.price * o.qty, 0);
              const color = table.status === 'occupied' ? theme.palette.warning.main : theme.palette.success.main;
              return (
                <Box
                  key={table.id}
                  onMouseDown={e => onTableMouseDown(e, table.id)}
                  onClick={() => { if (!dragRef.current) openTable(table.id); }}
                  sx={{
                    position: 'absolute', left: table.x, top: table.y, width: table.w, height: table.h,
                    borderRadius: 2, bgcolor: alpha(color, 0.1), border: `2px solid ${color}`,
                    cursor: 'grab', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 0.3, transition: 'border-color .15s, background-color .15s', '&:active': { cursor: 'grabbing' },
                    '&:hover': { boxShadow: `0 0 0 3px ${alpha(color, 0.25)}` },
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={0.4}>
                    {table.takeout && <IconifyIcon icon="mingcute:box-3-line" width={13} color={color} />}
                    <Typography fontWeight={800} fontSize={14} lineHeight={1}>{table.name}</Typography>
                  </Stack>
                  <Chip size="small" label={table.status === 'occupied' ? (table.placed ? '주문완료' : '주문중') : '빈자리'}
                    sx={{ height: 16, fontSize: 9, fontWeight: 700, bgcolor: alpha(color, 0.2), color, '& .MuiChip-label': { px: 0.8 } }} />
                  {table.status === 'occupied' && (
                    <>
                      <Typography fontSize={12} fontWeight={800} color="text.primary" lineHeight={1.3}>{won(amount)}</Typography>
                      <Typography fontSize={9} color="text.disabled" lineHeight={1}>
                        {table.guests > 0 ? `${table.guests}명 · ` : ''}{elapsedLabel(table.seatedAt, now)}
                      </Typography>
                    </>
                  )}
                  <IconButton size="small" onMouseDown={e => e.stopPropagation()} onClick={e => removeTable(e, table.id)}
                    sx={{ position: 'absolute', top: -8, right: -8, width: 20, height: 20, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`, '&:hover': { bgcolor: 'error.light', color: 'white' } }}>
                    <IconifyIcon icon="mingcute:close-line" width={10} />
                  </IconButton>
                  <Box onMouseDown={e => onResizeMouseDown(e, table.id)}
                    sx={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, cursor: 'se-resize', bgcolor: color, borderRadius: '2px 0 2px 0', opacity: 0.5, '&:hover': { opacity: 1 } }} />
                </Box>
              );
            })}
          </Paper>
        </Box>
      )}

      {/* ══════════════ 주문 / 결제 뷰 ══════════════ */}
      {view === 'order' && selectedTable && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.5 }}>
          {/* 좌측: 메뉴 */}
          <Paper elevation={0} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            {/* 카테고리 탭 */}
            <Box sx={{ display: 'flex', gap: 0.5, p: 1, borderBottom: `1px solid ${theme.palette.divider}`, overflowX: 'auto', flexShrink: 0 }}>
              {categories.map(c => (
                <Button key={c} onClick={() => setCategory(c)} variant={category === c ? 'contained' : 'text'}
                  sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 'auto', px: 2, color: category === c ? 'white' : 'text.secondary' }}>
                  {c}
                </Button>
              ))}
            </Box>
            {/* 메뉴 버튼 그리드 */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
              {visibleMenus.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
                  <IconifyIcon icon="mingcute:bowl-line" width={40} color={theme.palette.text.disabled} />
                  <Typography color="text.disabled">등록된 메뉴가 없습니다</Typography>
                  <Button size="small" variant="outlined" onClick={() => setMenuSettingsOpen(true)}>메뉴 설정 열기</Button>
                </Stack>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1.2 }}>
                  {visibleMenus.map((menu, i) => {
                    const palette = [theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main, theme.palette.info.main, theme.palette.secondary.main];
                    const c = palette[i % palette.length];
                    return (
                      <Box key={menu.id} onClick={() => addToOrder(menu)}
                        sx={{ cursor: 'pointer', borderRadius: 2.5, overflow: 'hidden', border: `1.5px solid ${alpha(c, 0.4)}`, bgcolor: alpha(c, 0.06),
                          display: 'flex', flexDirection: 'column', minHeight: 100, transition: 'transform .1s, box-shadow .1s',
                          '&:hover': { boxShadow: `0 6px 16px ${alpha(c, 0.28)}`, borderColor: c }, '&:active': { transform: 'scale(0.97)' } }}>
                        {menu.imageUrl
                          ? <Box component="img" src={menu.imageUrl} alt={menu.menuName} sx={{ width: '100%', height: 56, objectFit: 'cover' }} />
                          : <Box sx={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(c, 0.12) }}><IconifyIcon icon="mingcute:bowl-line" width={26} color={c} /></Box>}
                        <Box sx={{ p: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography fontWeight={700} fontSize={13} lineHeight={1.2} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{menu.menuName}</Typography>
                          <Typography fontWeight={800} fontSize={13} color={c} mt={0.3}>{won(menu.price)}</Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Paper>

          {/* 우측: 주문 내역 + 기능 버튼 */}
          <Paper elevation={0} sx={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRadius: 3, border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
            {/* 헤더 */}
            <Box sx={{ p: 1.5, bgcolor: 'primary.dark', color: 'white' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    {selectedTable.takeout && <IconifyIcon icon="mingcute:box-3-line" width={18} />}
                    <Typography fontWeight={800} variant="h6" lineHeight={1}>{selectedTable.takeout ? '포장 주문' : `${selectedTable.name} 테이블`}</Typography>
                  </Stack>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    {selectedTable.placed ? '주문완료 · 결제대기' : selectedTable.status === 'occupied' ? '주문 담는 중' : '주문 대기'}
                    {selectedTable.seatedAt ? ` · ${elapsedLabel(selectedTable.seatedAt, now)} 경과` : ''}
                  </Typography>
                </Box>
                <Button size="small" variant="text" onClick={() => setGuestOpen(true)}
                  sx={{ color: 'white', bgcolor: alpha('#fff', 0.15), borderRadius: 2, minWidth: 'auto', px: 1.2, fontWeight: 700 }}>
                  <IconifyIcon icon="mingcute:user-3-line" width={16} />&nbsp;{selectedTable.guests || 0}명
                </Button>
              </Stack>
            </Box>

            {/* 주문 내역 */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.2 }}>
              {selectedTable.orders.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" height="100%" gap={1}>
                  <IconifyIcon icon="mingcute:bill-line" width={36} color={theme.palette.text.disabled} />
                  <Typography variant="body2" color="text.disabled">메뉴를 선택해 주문을 담으세요</Typography>
                </Stack>
              ) : (
                <Stack gap={0.6}>
                  {selectedTable.orders.map(o => (
                    <Stack key={o.menuId} direction="row" alignItems="center" gap={0.5}
                      sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>{o.menuName}</Typography>
                        <Typography variant="caption" color="text.secondary">{won(o.price)}</Typography>
                      </Box>
                      <Stack direction="row" alignItems="center" gap={0.3}>
                        <IconButton size="small" onClick={() => changeQty(o.menuId, -1)} sx={{ width: 24, height: 24, border: `1px solid ${theme.palette.divider}` }}>
                          <IconifyIcon icon="mingcute:minus-line" width={14} />
                        </IconButton>
                        <Typography fontWeight={800} sx={{ minWidth: 22, textAlign: 'center' }}>{o.qty}</Typography>
                        <IconButton size="small" onClick={() => changeQty(o.menuId, 1)} sx={{ width: 24, height: 24, border: `1px solid ${theme.palette.divider}` }}>
                          <IconifyIcon icon="mingcute:add-line" width={14} />
                        </IconButton>
                      </Stack>
                      <Typography variant="body2" color="primary.main" fontWeight={800} sx={{ minWidth: 72, textAlign: 'right' }}>{won(o.price * o.qty)}</Typography>
                      <IconButton size="small" color="error" onClick={() => removeLine(o.menuId)} sx={{ width: 24, height: 24 }}>
                        <IconifyIcon icon="mingcute:close-line" width={14} />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>

            {/* 합계 */}
            <Box sx={{ px: 1.5, py: 1, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="text.secondary">소계</Typography><Typography variant="body2" fontWeight={700}>{won(subtotal)}</Typography></Stack>
              {discount > 0 && (
                <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="error.main">할인</Typography><Typography variant="body2" fontWeight={700} color="error.main">- {won(discount)}</Typography></Stack>
              )}
              <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.3}>
                <Typography fontWeight={800}>합계</Typography>
                <Typography variant="h5" fontWeight={900} color="primary.main">{won(total)}</Typography>
              </Stack>
            </Box>

            {/* 기능 버튼 바 (EasyPOS 스타일) */}
            <Box sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.8 }}>
              <FuncBtn icon="mingcute:send-plane-line" label="주문전송" color={theme.palette.info.main} disabled={!selectedTable.orders.length} onClick={sendToKitchen} />
              <FuncBtn icon="mingcute:discount-line" label="할인" color={theme.palette.secondary.main} disabled={!selectedTable.orders.length} onClick={() => { setDiscType('amount'); setDiscInput(''); setDiscountOpen(true); }} />
              <FuncBtn icon="mingcute:transfer-3-line" label="테이블이동" color={theme.palette.warning.main} disabled={!selectedTable.orders.length} onClick={() => setMoveOpen(true)} />
              <FuncBtn icon="mingcute:delete-2-line" label="전체취소" color={theme.palette.error.main} disabled={!selectedTable.orders.length} onClick={clearOrder} />
              <FuncBtn icon="mingcute:group-line" label="분할결제" color={theme.palette.info.dark} disabled={!selectedTable.orders.length} onClick={openSplit} />
              <FuncBtn icon="mingcute:receipt-line" label="영수증" color={theme.palette.text.secondary} disabled={!selectedTable.orders.length} onClick={() => { if (selectedTable.orders.length) { setReceipt({ tableName: `${selectedTable.name} 테이블`, orders: [...selectedTable.orders], subtotal, discount, total, method: '미결제' }); setReceiptOpen(true); } }} />
            </Box>

            {/* 결제 버튼 (현금/카드) */}
            <Box sx={{ p: 1, pt: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.8 }}>
              <Button variant="contained" color="success" size="large" disabled={paying || !selectedTable.orders.length} onClick={openCash}
                sx={{ borderRadius: 2, fontWeight: 800, py: 1.5, fontSize: 17 }}>
                <IconifyIcon icon="mingcute:cash-line" width={22} />&nbsp;현금결제
              </Button>
              <Button variant="contained" size="large" disabled={paying || !selectedTable.orders.length} onClick={payCard}
                sx={{ borderRadius: 2, fontWeight: 800, py: 1.5, fontSize: 17 }}>
                {paying ? <CircularProgress size={22} color="inherit" /> : <><IconifyIcon icon="mingcute:bank-card-line" width={22} />&nbsp;카드결제</>}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* ── 현금 결제 다이얼로그 ── */}
      <Dialog open={cashOpen} onClose={() => setCashOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>현금 결제</DialogTitle>
        <DialogContent>
          <Stack gap={1.5}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">결제 금액</Typography>
              <Typography variant="h5" fontWeight={900} color="primary.main">{won(total)}</Typography>
            </Box>
            <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">받은 금액</Typography>
              <Typography variant="h5" fontWeight={900}>{won(cashReceived)}</Typography>
              <Divider sx={{ my: 0.8 }} />
              <Typography variant="caption" color="text.secondary">거스름돈</Typography>
              <Typography variant="h6" fontWeight={900} color={cashChange >= 0 ? 'success.main' : 'error.main'}>{won(Math.max(0, cashChange))}</Typography>
            </Box>
            <Stack direction="row" gap={0.8}>
              {[total, 10000, 50000].map((v, i) => (
                <Button key={i} fullWidth variant="outlined" sx={{ fontWeight: 700, borderRadius: 2 }}
                  onClick={() => setCashInput(String((i === 0 ? 0 : cashReceived) + v))}>
                  {i === 0 ? '정확히' : `+${(v / 10000)}만`}
                </Button>
              ))}
            </Stack>
            <Numpad
              onInput={d => setCashInput(p => (p === '0' ? '' : p) + d)}
              onClear={() => setCashInput('')}
              onBackspace={() => setCashInput(p => p.slice(0, -1))}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCashOpen(false)}>취소</Button>
          <Button variant="contained" color="success" disabled={paying || cashReceived < total} onClick={confirmCash} sx={{ fontWeight: 800, px: 3 }}>
            {paying ? <CircularProgress size={20} color="inherit" /> : '결제 완료'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 분할 결제 다이얼로그 ── */}
      <Dialog open={splitOpen} onClose={() => setSplitOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>분할 결제</DialogTitle>
        <DialogContent>
          <Stack gap={1.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">총 {won(total)}을 몇 명으로 나눌까요?</Typography>
            <Stack direction="row" alignItems="center" gap={2}>
              <IconButton onClick={() => { setSplitWays(w => Math.max(2, w - 1)); setSplitPaid(0); }} sx={{ border: `1px solid ${theme.palette.divider}` }}><IconifyIcon icon="mingcute:minus-line" /></IconButton>
              <Typography variant="h4" fontWeight={900}>{splitWays}명</Typography>
              <IconButton onClick={() => { setSplitWays(w => w + 1); setSplitPaid(0); }} sx={{ border: `1px solid ${theme.palette.divider}` }}><IconifyIcon icon="mingcute:add-line" /></IconButton>
            </Stack>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50', textAlign: 'center', width: '100%' }}>
              <Typography variant="caption" color="text.secondary">1인당</Typography>
              <Typography variant="h5" fontWeight={900} color="primary.main">{won(splitAmount)}</Typography>
            </Box>
            <Box sx={{ width: '100%' }}>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">결제 진행</Typography>
                <Typography variant="caption" fontWeight={700}>{splitPaid} / {splitWays}명</Typography>
              </Stack>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {Array.from({ length: splitWays }).map((_, i) => (
                  <Box key={i} sx={{ flex: 1, height: 8, borderRadius: 4, bgcolor: i < splitPaid ? 'success.main' : alpha(theme.palette.text.disabled, 0.2) }} />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSplitOpen(false)}>취소</Button>
          <Button variant="contained" disabled={paying} onClick={paySplitOne} sx={{ fontWeight: 800, px: 3 }}>
            {paying ? <CircularProgress size={20} color="inherit" /> : (splitPaid + 1 >= splitWays ? '마지막 결제 · 완료' : `${splitPaid + 1}번째 결제`)}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 할인 다이얼로그 ── */}
      <Dialog open={discountOpen} onClose={() => setDiscountOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>할인 적용</DialogTitle>
        <DialogContent>
          <Stack gap={1.5}>
            <ToggleButtonGroup exclusive fullWidth value={discType} onChange={(_, v) => v && setDiscType(v)} size="small">
              <ToggleButton value="amount" sx={{ fontWeight: 700 }}>정액(원)</ToggleButton>
              <ToggleButton value="percent" sx={{ fontWeight: 700 }}>정률(%)</ToggleButton>
            </ToggleButtonGroup>
            <TextField fullWidth type="number" autoFocus label={discType === 'amount' ? '할인 금액' : '할인율 (%)'}
              value={discInput} onChange={e => setDiscInput(e.target.value)} />
            <Stack direction="row" gap={0.8}>
              {(discType === 'amount' ? [1000, 3000, 5000] : [5, 10, 20]).map(v => (
                <Button key={v} fullWidth variant="outlined" sx={{ fontWeight: 700, borderRadius: 2 }} onClick={() => setDiscInput(String(v))}>
                  {discType === 'amount' ? `${v / 1000}천` : `${v}%`}
                </Button>
              ))}
            </Stack>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50', textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">예상 할인 후 금액</Typography>
              <Typography variant="h6" fontWeight={900} color="primary.main">
                {won(Math.max(0, subtotal - discountFor({ type: discType, value: parseInt(discInput || '0', 10) }, subtotal)))}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="error" onClick={clearDiscount}>할인 해제</Button>
          <Box flex={1} />
          <Button onClick={() => setDiscountOpen(false)}>취소</Button>
          <Button variant="contained" onClick={applyDiscount} sx={{ fontWeight: 800 }}>적용</Button>
        </DialogActions>
      </Dialog>

      {/* ── 인원수 다이얼로그 ── */}
      <Dialog open={guestOpen} onClose={() => setGuestOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>인원수 설정</DialogTitle>
        <DialogContent>
          <Stack direction="row" alignItems="center" justifyContent="center" gap={3} py={2}>
            <IconButton size="large" onClick={() => setGuests((selectedTable?.guests || 0) - 1)} sx={{ border: `1px solid ${theme.palette.divider}` }}><IconifyIcon icon="mingcute:minus-line" width={24} /></IconButton>
            <Typography variant="h3" fontWeight={900}>{selectedTable?.guests || 0}<Typography component="span" variant="h6">명</Typography></Typography>
            <IconButton size="large" onClick={() => setGuests((selectedTable?.guests || 0) + 1)} sx={{ border: `1px solid ${theme.palette.divider}` }}><IconifyIcon icon="mingcute:add-line" width={24} /></IconButton>
          </Stack>
          <Stack direction="row" gap={0.8} justifyContent="center">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <Button key={n} variant="outlined" onClick={() => setGuests(n)} sx={{ minWidth: 40, fontWeight: 700 }}>{n}</Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" fullWidth onClick={() => setGuestOpen(false)} sx={{ fontWeight: 800 }}>확인</Button>
        </DialogActions>
      </Dialog>

      {/* ── 테이블 이동 다이얼로그 ── */}
      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>테이블 이동 / 합석</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>이동할 빈 테이블을 선택하세요.</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
            {tables.filter(t => t.id !== selected && t.status === 'empty').map(t => (
              <Button key={t.id} variant="outlined" onClick={() => moveTable(t.id)} sx={{ py: 2, fontWeight: 700, borderRadius: 2, flexDirection: 'column' }}>
                {t.takeout && <IconifyIcon icon="mingcute:box-3-line" width={16} />}
                {t.name}
              </Button>
            ))}
            {tables.filter(t => t.id !== selected && t.status === 'empty').length === 0 && (
              <Typography variant="body2" color="text.disabled" gridColumn="1 / -1" textAlign="center" py={2}>이동 가능한 빈 테이블이 없습니다.</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setMoveOpen(false)}>닫기</Button></DialogActions>
      </Dialog>

      {/* ── 영수증 다이얼로그 ── */}
      <Dialog open={receiptOpen} onClose={handleReceiptClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{ p: 1, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.12) }}>
              <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={24} />
            </Box>
            {receipt?.method === '미결제' ? '주문서' : '결제 완료'}
          </Stack>
        </DialogTitle>
        <DialogContent>
          {receipt && (
            <Box id="receipt-print" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, fontFamily: 'monospace' }}>
              <Typography variant="body2" textAlign="center" fontWeight={800} mb={0.5}>FoodGuard</Typography>
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mb={1}>
                {new Date().toLocaleString('ko-KR')} · {receipt.tableName}
              </Typography>
              <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
              <Stack gap={0.5} mb={1.5}>
                {receipt.orders.map(o => (
                  <Stack key={o.menuId} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{o.menuName} × {o.qty}</Typography>
                    <Typography variant="body2">{won(o.price * o.qty)}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ mb: 1, borderStyle: 'dashed' }} />
              <Stack direction="row" justifyContent="space-between"><Typography variant="body2">소계</Typography><Typography variant="body2">{won(receipt.subtotal)}</Typography></Stack>
              {receipt.discount > 0 && <Stack direction="row" justifyContent="space-between"><Typography variant="body2" color="error.main">할인</Typography><Typography variant="body2" color="error.main">- {won(receipt.discount)}</Typography></Stack>}
              <Stack direction="row" justifyContent="space-between" mt={0.5}>
                <Typography fontWeight={800}>합 계</Typography>
                <Typography fontWeight={800} color="primary.main">{won(receipt.total)}</Typography>
              </Stack>
              {receipt.method !== '미결제' && (
                <>
                  <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2">결제수단</Typography><Typography variant="body2" fontWeight={700}>{receipt.method}</Typography></Stack>
                  {receipt.received != null && (
                    <>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2">받은금액</Typography><Typography variant="body2">{won(receipt.received)}</Typography></Stack>
                      <Stack direction="row" justifyContent="space-between"><Typography variant="body2">거스름돈</Typography><Typography variant="body2">{won(Math.max(0, receipt.change ?? 0))}</Typography></Stack>
                    </>
                  )}
                </>
              )}
            </Box>
          )}
          {receipt?.method !== '미결제' && (
            <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>판매 실적이 자동 기록되었습니다.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={printReceipt} variant="outlined" startIcon={<IconifyIcon icon="mingcute:print-line" />} sx={{ borderRadius: 2 }}>인쇄</Button>
          <Button onClick={handleReceiptClose} variant="contained" fullWidth size="large" sx={{ borderRadius: 2, fontWeight: 800 }}>확인</Button>
        </DialogActions>
      </Dialog>

      {/* ── 메뉴 설정 ── */}
      <MenuSettingsDialog
        open={menuSettingsOpen}
        onClose={() => setMenuSettingsOpen(false)}
        storeId={storeId}
        menus={menus}
        onChanged={() => { if (storeId) loadMenus(storeId); }}
      />
    </Box>
  );
};

// ── 기능 버튼 ─────────────────────────────────────────────────────────
const FuncBtn = ({ icon, label, color, onClick, disabled }: { icon: string; label: string; color: string; onClick: () => void; disabled?: boolean }) => (
  <Button onClick={onClick} disabled={disabled}
    sx={{ flexDirection: 'column', gap: 0.3, py: 1, borderRadius: 2, bgcolor: alpha(color, 0.1), color, fontWeight: 700, fontSize: 12,
      border: `1px solid ${alpha(color, 0.25)}`, '&:hover': { bgcolor: alpha(color, 0.2) }, '&.Mui-disabled': { opacity: 0.4 } }}>
    <IconifyIcon icon={icon} width={20} />
    {label}
  </Button>
);

export default POS;
