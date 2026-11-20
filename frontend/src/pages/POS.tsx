import { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Stack,
  Dialog, DialogContent, DialogActions,
  IconButton, Divider, Alert, CircularProgress,
  useTheme, alpha,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { menuService } from '../services/menuService';
import { discountService, errorText, ActiveDiscount } from '../services/agentService';
import { storeService } from '../services/storeService';
import { posTableService } from '../services/posTableService';

interface OrderItem {
  menuId: number;
  menuName: string;
  price: number;
  qty: number;
  listPrice?: number;
  discountPct?: number | null;
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
  seats: number;   // 좌석 수 (배치와 함께 저장)
  guests: number;  // 착석 인원 (주문처럼 화면 상태로만)
}

let nextId = 7;

const defaultTables = (): Table[] => [
  { id: 1, name: '1번', seats: 4, guests: 0, x: 40,  y: 60,  w: 100, h: 80, status: 'empty', orders: [] },
  { id: 2, name: '2번', seats: 4, guests: 0, x: 180, y: 60,  w: 100, h: 80, status: 'empty', orders: [] },
  { id: 3, name: '3번', seats: 4, guests: 0, x: 320, y: 60,  w: 100, h: 80, status: 'empty', orders: [] },
  { id: 4, name: '4번', seats: 4, guests: 0, x: 40,  y: 190, w: 100, h: 80, status: 'empty', orders: [] },
  { id: 5, name: '5번', seats: 4, guests: 0, x: 180, y: 190, w: 100, h: 80, status: 'empty', orders: [] },
  { id: 6, name: '6번', seats: 4, guests: 0, x: 320, y: 190, w: 100, h: 80, status: 'empty', orders: [] },
];

const POS = ({ user }: any) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tables, setTables] = useState<Table[]>(defaultTables);
  const [selected, setSelected] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<ActiveDiscount[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ tableName: string; orders: OrderItem[]; total: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [savingLayout, setSavingLayout] = useState(false);

  const dragRef = useRef<{ id: number; ox: number; oy: number; tx: number; ty: number } | null>(null);
  const resizeRef = useRef<{ id: number; sx: number; sy: number; ow: number; oh: number } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores: any[]) => {
        if (!stores?.length) { setLoading(false); return; }
        const sid = stores[0].id;
        setStoreId(sid);
        // 저장된 배치가 있으면 기본 배치 대신 쓴다
        posTableService.getByStore(sid).then(saved => {
          if (!saved?.length) return;
          setTables(saved.map((t, i) => ({ id: i + 1, name: t.name, x: t.x, y: t.y, w: t.w, h: t.h, seats: t.seats, guests: 0, status: 'empty', orders: [] })));
          nextId = saved.length + 1;
        }).catch(() => {});
        discountService.active(sid).then(setDiscounts).catch(() => {});
        return menuService.getByStore(sid);
      })
      .then((ms: any[]) => ms && setMenus(ms.filter((m: any) => m.isActive !== false && m.isActive !== 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const selectedTable = tables.find(t => t.id === selected) ?? null;
  const totalPrice = selectedTable?.orders.reduce((s, o) => s + o.price * o.qty, 0) ?? 0;

  // ── 드래그 ──────────────────────────────────────────────────────────
  const onTableMouseDown = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    const t = tables.find(t => t.id === id)!;
    dragRef.current = { id, ox: e.clientX, oy: e.clientY, tx: t.x, ty: t.y };
  };

  const onResizeMouseDown = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
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
          : t
      ));
    }
    if (resizeRef.current) {
      const { id, sx, sy, ow, oh } = resizeRef.current;
      setTables(prev => prev.map(t =>
        t.id === id
          ? { ...t, w: Math.max(70, ow + e.clientX - sx), h: Math.max(56, oh + e.clientY - sy) }
          : t
      ));
    }
  };

  const onCanvasMouseUp = () => { dragRef.current = null; resizeRef.current = null; };

  // ── 주문 ────────────────────────────────────────────────────────────
  const discountOf = (menuId: number) => discounts.find(d => d.menuId === menuId);

  const addToOrder = (menu: any) => {
    const discount = discountOf(menu.id);
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const existing = t.orders.find(o => o.menuId === menu.id);
      const orders = existing
        ? t.orders.map(o => o.menuId === menu.id ? { ...o, qty: o.qty + 1 } : o)
        : [...t.orders, {
            menuId: menu.id, menuName: menu.menuName, qty: 1, listPrice: menu.price,
            price: discount ? discount.discountedPrice : menu.price, discountPct: discount?.discountPct,
          }];
      return { ...t, status: 'occupied', orders };
    }));
  };

  const changeQty = (menuId: number, delta: number) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const orders = t.orders
        .map(o => o.menuId === menuId ? { ...o, qty: o.qty + delta } : o)
        .filter(o => o.qty > 0);
      return { ...t, status: orders.length > 0 || t.guests > 0 ? 'occupied' : 'empty', orders };
    }));
  };

  // ── 결제 ────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedTable || !storeId || selectedTable.orders.length === 0) return;
    setPaying(true);
    try {
      // 가격은 서버가 오늘 할인으로 다시 계산한다. 영수증은 서버 결과로 그린다
      const result = await discountService.checkout(storeId, selectedTable.orders.map(o => ({ menuId: o.menuId, quantity: o.qty })));
      setReceipt({
        tableName: selectedTable.name,
        total: result.total,
        orders: result.lines.map(l => ({ menuId: l.menuId, menuName: l.menuName, price: l.unitPrice, qty: l.quantity, listPrice: l.listPrice, discountPct: l.discountPct })),
      });
      setReceiptOpen(true);
    } catch (e) {
      setErrorMsg(errorText(e, '결제 처리 중 오류가 발생했습니다.'));
    } finally {
      setPaying(false);
    }
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setTables(prev => prev.map(t => t.id === selected ? { ...t, status: 'empty', orders: [], guests: 0 } : t));
    setSelected(null);
    setSuccessMsg('결제 완료. 판매 실적이 기록되었습니다.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── 테이블 관리 ──────────────────────────────────────────────────────
  const addTable = () => {
    const id = nextId++;
    setTables(prev => [...prev, { id, name: `${id}번`, seats: 4, guests: 0, x: 60, y: 60, w: 100, h: 80, status: 'empty', orders: [] }]);
  };

  // 선택한 테이블의 좌석 수·착석 인원 (0 미만 불가, 좌석은 1 이상)
  const updateSelected = (patch: Partial<Pick<Table, 'seats' | 'guests'>>) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const next = { ...t, ...patch };
      return { ...next, status: next.orders.length > 0 || next.guests > 0 ? 'occupied' : 'empty' };
    }));
  };

  const saveLayout = async () => {
    if (!storeId) return;
    setSavingLayout(true);
    try {
      await posTableService.save(storeId, tables.map(({ name, x, y, w, h, seats }) => ({ name, x, y, w, h, seats })));
      setSuccessMsg('테이블 배치와 좌석 수를 저장했습니다.');
    } catch (e) {
      setErrorMsg(errorText(e, '테이블 배치를 저장하지 못했습니다.'));
    } finally {
      setSavingLayout(false);
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  const removeTable = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTables(prev => prev.filter(t => t.id !== id));
    if (selected === id) setSelected(null);
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

  const occupiedCount = tables.filter(t => t.status === 'occupied').length;
  const tableTotal = (t: Table) => t.orders.reduce((s, o) => s + o.price * o.qty, 0);
  const sectionLabel = (text: string) => (
    <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 1.5 }}>{text}</Typography>
  );

  return (
    <Box sx={{ height: { md: 'calc(100vh - 120px)' }, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {errorMsg && <Alert severity="error" onClose={() => setErrorMsg('')}>{errorMsg}</Alert>}

      {/* 큰 숫자 요약 + 테이블 관리 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>사용 중인 테이블</Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {occupiedCount}<Box component="span" color="text.secondary" fontSize={{ xs: 22, md: 26 }} fontWeight={600}> / {tables.length}개</Box>
          </Typography>
        </Box>
        <Stack direction="row" gap={1.5}>
          <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={addTable}>
            테이블 추가
          </Button>
          <Button startIcon={<IconifyIcon icon="mingcute:save-2-line" />} onClick={saveLayout} disabled={!storeId || savingLayout}>
            {savingLayout ? '저장 중…' : '배치 저장'}
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, flex: 1, minHeight: 0 }}>
        {/* ── 매장 배치도 ── */}
        <Paper
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          sx={{
            flex: '1 1 0',
            minHeight: { xs: 420, md: 0 },
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none',
            // 바닥 격자 점
            backgroundImage: `radial-gradient(${theme.palette.divider} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        >
          <Stack direction="row" gap={3} sx={{ position: 'absolute', top: 16, left: 20 }}>
            {[
              { label: '빈 자리', color: theme.palette.text.disabled },
              { label: '사용 중', color: theme.palette.primary.main },
            ].map(l => (
              <Stack key={l.label} direction="row" alignItems="center" gap={1}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: l.color }} />
                <Typography variant="body2" color="text.secondary">{l.label}</Typography>
              </Stack>
            ))}
            <Typography variant="body2" color="text.disabled">끌어서 옮기기 · 오른쪽 아래 모서리로 크기 조절</Typography>
          </Stack>

          {tables.map(table => {
            const isSelected = selected === table.id;
            const occupied = table.status === 'occupied';
            const total = tableTotal(table);

            return (
              <Box
                key={table.id}
                onMouseDown={e => { setSelected(table.id); onTableMouseDown(e, table.id); }}
                sx={{
                  position: 'absolute',
                  left: table.x,
                  top: table.y,
                  width: table.w,
                  height: table.h,
                  borderRadius: 4,
                  bgcolor: occupied ? 'primary.light' : 'background.paper',
                  border: `${isSelected ? 2 : 1.5}px solid ${isSelected || occupied ? theme.palette.primary.main : theme.palette.divider}`,
                  boxShadow: isSelected ? `0 8px 20px ${alpha(theme.palette.primary.main, 0.18)}` : '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  transition: 'border-color 0.15s, background-color 0.15s, box-shadow 0.15s',
                  '&:active': { cursor: 'grabbing' },
                  '&:hover .table-remove': { opacity: 1 },
                }}
              >
                <Typography fontWeight={700} fontSize={15} lineHeight={1.2} color={occupied ? 'primary.main' : 'text.primary'}>
                  {table.name}
                </Typography>
                <Typography fontSize={12} lineHeight={1.3} color={table.guests > table.seats ? 'error.main' : 'text.secondary'}>
                  {table.guests > 0 ? `${table.guests}/${table.seats}명` : `${table.seats}인석`}
                </Typography>
                {total > 0 && (
                  <Typography fontSize={13} fontWeight={700} lineHeight={1.3} color="text.primary">
                    ₩{total.toLocaleString()}
                  </Typography>
                )}

                {/* 삭제 (마우스를 올렸을 때만) */}
                <IconButton
                  className="table-remove"
                  size="small"
                  aria-label={`${table.name} 테이블 삭제`}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => removeTable(e, table.id)}
                  sx={{
                    position: 'absolute', top: -9, right: -9,
                    width: 22, height: 22, opacity: isSelected ? 1 : 0,
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`,
                    transition: 'opacity 0.15s',
                    '&:hover': { bgcolor: 'error.main', color: 'common.white', borderColor: 'error.main' },
                  }}
                >
                  <IconifyIcon icon="mingcute:close-line" width={12} />
                </IconButton>

                {/* 크기 조절 핸들 */}
                <Box
                  onMouseDown={e => onResizeMouseDown(e, table.id)}
                  sx={{
                    position: 'absolute', bottom: 4, right: 4,
                    width: 10, height: 10,
                    cursor: 'se-resize',
                    borderRight: `2px solid ${theme.palette.text.disabled}`,
                    borderBottom: `2px solid ${theme.palette.text.disabled}`,
                    borderBottomRightRadius: 3,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 },
                  }}
                />
              </Box>
            );
          })}
        </Paper>

        {/* ── 주문 패널 ── */}
        <Paper sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0, overflow: 'hidden' }}>
          {!selectedTable ? (
            <Stack alignItems="center" justifyContent="center" gap={2} sx={{ flex: 1, p: 6, minHeight: 240 }}>
              <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconifyIcon icon="mingcute:table-2-line" width={32} color={theme.palette.primary.main} />
              </Box>
              <Typography color="text.secondary" textAlign="center" fontSize={15}>
                테이블을 누르면<br />주문을 받을 수 있어요
              </Typography>
            </Stack>
          ) : (
            <>
              {/* 헤더 */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ px: 5, pt: 5, pb: 3 }}>
                <Box>
                  <Typography fontSize={22} fontWeight={700} lineHeight={1.3}>{selectedTable.name} 테이블</Typography>
                  <Typography variant="body2" color={selectedTable.status === 'occupied' ? 'primary.main' : 'text.secondary'}>
                    {selectedTable.status === 'occupied' ? '주문 진행 중' : '주문 대기'}
                  </Typography>
                </Box>
                <IconButton size="small" aria-label="주문 패널 닫기" onClick={() => setSelected(null)}>
                  <IconifyIcon icon="mingcute:close-line" width={20} />
                </IconButton>
              </Stack>

              {/* 착석 인원 · 좌석 수 */}
              <Stack direction="row" gap={2} sx={{ px: 5, pb: 3 }}>
                {([
                  { key: 'guests', label: '착석 인원', min: 0 },
                  { key: 'seats', label: '좌석 수', min: 1 },
                ] as const).map(({ key, label, min }) => (
                  <Box key={key} sx={{ flex: 1, bgcolor: 'background.default', borderRadius: 3, px: 2, py: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <IconButton size="small" aria-label={`${label} 줄이기`} disabled={selectedTable[key] <= min}
                        onClick={() => updateSelected({ [key]: selectedTable[key] - 1 })}>
                        <IconifyIcon icon="mingcute:minimize-line" width={16} />
                      </IconButton>
                      <Typography fontWeight={700} fontSize={17} color={key === 'guests' && selectedTable.guests > selectedTable.seats ? 'error.main' : 'text.primary'}>
                        {selectedTable[key]}명
                      </Typography>
                      <IconButton size="small" aria-label={`${label} 늘리기`} onClick={() => updateSelected({ [key]: selectedTable[key] + 1 })}>
                        <IconifyIcon icon="mingcute:add-line" width={16} />
                      </IconButton>
                    </Stack>
                  </Box>
                ))}
              </Stack>
              {selectedTable.guests > selectedTable.seats && (
                <Alert severity="warning" sx={{ mx: 5, mb: 2, py: 0 }}>착석 인원이 좌석 수보다 많습니다.</Alert>
              )}

              {/* 메뉴 (누르면 담김) */}
              <Box sx={{ px: 5, pb: 3 }}>
                {sectionLabel('메뉴')}
                {menus.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">등록된 메뉴가 없어요</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, maxHeight: 200, overflowY: 'auto' }}>
                    {menus.map(menu => {
                      const d = discountOf(menu.id);
                      return (
                        <Box
                          key={menu.id}
                          onClick={() => addToOrder(menu)}
                          sx={{
                            p: 2.5, borderRadius: 3, cursor: 'pointer', position: 'relative',
                            bgcolor: 'background.default', transition: 'background-color 0.15s',
                            '&:hover': { bgcolor: 'primary.light' }, '&:active': { transform: 'scale(0.98)' },
                          }}
                        >
                          <Typography fontWeight={600} fontSize={14} lineHeight={1.3} noWrap>{menu.menuName}</Typography>
                          {d ? (
                            <Typography fontSize={13} fontWeight={700} color="error.main">
                              ₩{d.discountedPrice.toLocaleString()} <Box component="span" fontWeight={500}>{d.discountPct}%</Box>
                            </Typography>
                          ) : (
                            <Typography fontSize={13} color="text.secondary">₩{menu.price?.toLocaleString()}</Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>

              {/* 주문 내역 */}
              <Box sx={{ flex: 1, overflowY: 'auto', px: 5, pb: 2, borderTop: `1px solid ${theme.palette.divider}`, pt: 3 }}>
                {sectionLabel('주문 내역')}
                {selectedTable.orders.length === 0 ? (
                  <Typography variant="body2" color="text.disabled">메뉴를 누르면 여기에 담겨요</Typography>
                ) : selectedTable.orders.map(o => (
                  <Stack key={o.menuId} direction="row" alignItems="center" gap={1.5} sx={{ py: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={600} fontSize={15} noWrap>{o.menuName}</Typography>
                      {o.discountPct ? <Typography variant="body2" color="error.main">{o.discountPct}% 할인</Typography> : null}
                    </Box>
                    <Stack direction="row" alignItems="center" sx={{ bgcolor: 'background.default', borderRadius: 999 }}>
                      <IconButton size="small" aria-label={`${o.menuName} 하나 빼기`} onClick={() => changeQty(o.menuId, -1)}>
                        <IconifyIcon icon="mingcute:minimize-line" width={14} />
                      </IconButton>
                      <Typography fontWeight={700} fontSize={14} sx={{ minWidth: 18, textAlign: 'center' }}>{o.qty}</Typography>
                      <IconButton size="small" aria-label={`${o.menuName} 하나 더`} onClick={() => changeQty(o.menuId, 1)}>
                        <IconifyIcon icon="mingcute:add-line" width={14} />
                      </IconButton>
                    </Stack>
                    <Typography fontWeight={700} fontSize={15} sx={{ minWidth: 76, textAlign: 'right' }}>
                      ₩{(o.price * o.qty).toLocaleString()}
                    </Typography>
                  </Stack>
                ))}
              </Box>

              {/* 결제 */}
              <Box sx={{ px: 5, py: 4, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={3}>
                  <Typography color="text.secondary" fontSize={15}>합계</Typography>
                  <Typography fontSize={26} fontWeight={700}>₩{totalPrice.toLocaleString()}</Typography>
                </Stack>
                <Button
                  fullWidth size="large"
                  disabled={selectedTable.orders.length === 0 || paying}
                  onClick={handlePay}
                  sx={{ py: 2, fontSize: 16 }}
                >
                  {paying ? <CircularProgress size={22} color="inherit" /> : `₩${totalPrice.toLocaleString()} 결제하기`}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      {/* ── 영수증 ── */}
      <Dialog open={receiptOpen} onClose={handleReceiptClose} maxWidth="xs" fullWidth>
        <DialogContent sx={{ pt: 6 }}>
          <Stack alignItems="center" gap={1.5} mb={4}>
            <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={48} />
            <Typography fontSize={20} fontWeight={700}>결제 완료</Typography>
            {receipt && (
              <Typography variant="body2" color="text.secondary">
                {new Date().toLocaleString('ko-KR')} · {receipt.tableName} 테이블
              </Typography>
            )}
          </Stack>
          {receipt && (
            <Box sx={{ p: 4, bgcolor: 'background.default', borderRadius: 3 }}>
              <Stack gap={1.5} mb={2}>
                {receipt.orders.map(o => (
                  <Stack key={o.menuId} direction="row" justifyContent="space-between">
                    <Typography fontSize={15}>
                      {o.menuName} × {o.qty}
                      {o.discountPct ? <Box component="span" color="error.main" fontSize={13}> {o.discountPct}%</Box> : null}
                    </Typography>
                    <Typography fontSize={15}>₩{(o.price * o.qty).toLocaleString()}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ mb: 2 }} />
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography fontWeight={700}>합계</Typography>
                <Typography fontSize={22} fontWeight={700}>₩{receipt.total.toLocaleString()}</Typography>
              </Stack>
            </Box>
          )}
          <Typography variant="body2" color="text.secondary" display="block" textAlign="center" mt={3}>
            판매 실적이 자동으로 기록됐어요.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 5, pb: 5 }}>
          <Button onClick={handleReceiptClose} fullWidth size="large">
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default POS;
