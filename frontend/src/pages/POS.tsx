import { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Stack, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Divider, Alert, CircularProgress,
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
  placed: boolean;
}

let nextId = 7;

const defaultTables = (): Table[] => [
  { id: 1, name: '1번', x: 40,  y: 60,  w: 100, h: 80, status: 'empty', orders: [], placed: false },
  { id: 2, name: '2번', x: 180, y: 60,  w: 100, h: 80, status: 'empty', orders: [], placed: false },
  { id: 3, name: '3번', x: 320, y: 60,  w: 100, h: 80, status: 'empty', orders: [], placed: false },
  { id: 4, name: '4번', x: 40,  y: 190, w: 100, h: 80, status: 'empty', orders: [], placed: false },
  { id: 5, name: '5번', x: 180, y: 190, w: 100, h: 80, status: 'empty', orders: [], placed: false },
  { id: 6, name: '6번', x: 320, y: 190, w: 100, h: 80, status: 'empty', orders: [], placed: false },
];

const POS = ({ user }: any) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tables, setTables] = useState<Table[]>(defaultTables);
  const [selected, setSelected] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ tableName: string; orders: OrderItem[]; total: number } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [menuSettingsOpen, setMenuSettingsOpen] = useState(false);

  const loadMenus = (sid: number) =>
    menuService.getByStore(sid)
      .then((ms: any[]) => ms && setMenus(ms.filter((m: any) => m.isActive !== false && m.isActive !== 0)))
      .catch(() => {});

  const dragRef = useRef<{ id: number; ox: number; oy: number; tx: number; ty: number } | null>(null);
  const resizeRef = useRef<{ id: number; sx: number; sy: number; ow: number; oh: number } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id)
      .then((stores: any[]) => {
        if (!stores?.length) { setLoading(false); return; }
        const sid = stores[0].id;
        setStoreId(sid);
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
  const addToOrder = (menu: any) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const existing = t.orders.find(o => o.menuId === menu.id);
      const orders = existing
        ? t.orders.map(o => o.menuId === menu.id ? { ...o, qty: o.qty + 1 } : o)
        : [...t.orders, { menuId: menu.id, menuName: menu.menuName, price: menu.price, qty: 1 }];
      return { ...t, status: 'occupied', orders };
    }));
  };

  const changeQty = (menuId: number, delta: number) => {
    setTables(prev => prev.map(t => {
      if (t.id !== selected) return t;
      const orders = t.orders
        .map(o => o.menuId === menuId ? { ...o, qty: o.qty + delta } : o)
        .filter(o => o.qty > 0);
      return { ...t, status: orders.length > 0 ? 'occupied' : 'empty', orders, placed: orders.length > 0 ? t.placed : false };
    }));
  };

  // ── 주문하기 (주문 확정) ─────────────────────────────────────────────
  const placeOrder = () => {
    if (!selectedTable || selectedTable.orders.length === 0) return;
    setTables(prev => prev.map(t => t.id === selected ? { ...t, placed: true } : t));
  };

  // ── 결제 ────────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!selectedTable || !storeId || selectedTable.orders.length === 0) return;
    setPaying(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all(
        selectedTable.orders.map(o =>
          salesService.create({ storeId, menuId: o.menuId, quantity: o.qty, saleDate: today })
        )
      );
      setReceipt({ tableName: selectedTable.name, orders: [...selectedTable.orders], total: totalPrice });
      setReceiptOpen(true);
    } catch {
      setSuccessMsg('결제 처리 중 오류가 발생했습니다.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setPaying(false);
    }
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setTables(prev => prev.map(t => t.id === selected ? { ...t, status: 'empty', orders: [], placed: false } : t));
    setSelected(null);
    setSuccessMsg('결제 완료. 판매 실적이 기록되었습니다.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // ── 테이블 관리 ──────────────────────────────────────────────────────
  const addTable = () => {
    const id = nextId++;
    setTables(prev => [...prev, { id, name: `${id}번`, x: 60, y: 60, w: 100, h: 80, status: 'empty', orders: [], placed: false }]);
  };

  const removeTable = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setTables(prev => prev.filter(t => t.id !== id));
    if (selected === id) setSelected(null);
  };

  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>;

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight={800}>
          POS 시스템
        </Typography>
        <Stack direction="row" gap={1} alignItems="center">
          <Stack direction="row" gap={1}>
            <Chip size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.15), color: 'success.main' }} label="빈 자리" />
            <Chip size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.15), color: 'warning.main' }} label="사용 중" />
          </Stack>
          <Button variant="outlined" size="small" startIcon={<IconifyIcon icon="mingcute:add-line" />} onClick={addTable}>
            테이블 추가
          </Button>
          <Button variant="outlined" size="small" startIcon={<IconifyIcon icon="mingcute:settings-3-line" />} onClick={() => setMenuSettingsOpen(true)}>
            메뉴 설정
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* ── 플로어 플랜 ── */}
        <Paper
          ref={canvasRef}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          elevation={0}
          sx={{
            flex: '1 1 0',
            position: 'relative',
            overflow: 'hidden',
            bgcolor: alpha(theme.palette.primary.main, 0.02),
            border: `2px dashed ${theme.palette.divider}`,
            borderRadius: 3,
            userSelect: 'none',
          }}
        >
          <Typography variant="caption" color="text.disabled" sx={{ position: 'absolute', top: 14, left: 16 }}>
            드래그로 테이블 이동 · 우하단 핸들로 크기 조절
          </Typography>

          {tables.map(table => {
            const isSelected = selected === table.id;
            const color = isSelected
              ? theme.palette.primary.main
              : table.status === 'occupied'
                ? theme.palette.warning.main
                : theme.palette.success.main;

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
                  borderRadius: 2,
                  bgcolor: alpha(color, isSelected ? 0.18 : 0.1),
                  border: `2px solid ${color}`,
                  cursor: 'grab',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.3,
                  transition: 'border-color 0.15s, background-color 0.15s',
                  boxShadow: isSelected ? `0 0 0 3px ${alpha(color, 0.2)}` : 'none',
                  '&:active': { cursor: 'grabbing' },
                }}
              >
                <Typography fontWeight={700} fontSize={13} lineHeight={1}>{table.name}</Typography>
                <Chip
                  size="small"
                  label={table.status === 'occupied' ? '사용 중' : '빈 자리'}
                  sx={{
                    height: 16, fontSize: 9, fontWeight: 700,
                    bgcolor: alpha(color, 0.2), color,
                    '& .MuiChip-label': { px: 0.8 },
                  }}
                />
                {table.orders.length > 0 && (
                  <Box sx={{ width: '100%', px: 0.5, overflow: 'hidden' }}>
                    <Stack gap={0.1} alignItems="center">
                      {table.orders.map(o => (
                        <Typography key={o.menuId} fontSize={10} color="text.secondary" lineHeight={1.25} noWrap sx={{ maxWidth: '100%' }}>
                          {o.menuName} ×{o.qty}
                        </Typography>
                      ))}
                      <Typography fontSize={9} fontWeight={700} lineHeight={1.4} color={table.placed ? 'warning.main' : 'text.disabled'}>
                        {table.placed ? '주문 완료' : '담는 중'}
                      </Typography>
                    </Stack>
                  </Box>
                )}

                {/* 삭제 버튼 */}
                <IconButton
                  size="small"
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => removeTable(e, table.id)}
                  sx={{
                    position: 'absolute', top: -8, right: -8,
                    width: 20, height: 20,
                    bgcolor: 'background.paper',
                    border: `1px solid ${theme.palette.divider}`,
                    '&:hover': { bgcolor: 'error.light', color: 'white' },
                  }}
                >
                  <IconifyIcon icon="mingcute:close-line" width={10} />
                </IconButton>

                {/* 리사이즈 핸들 */}
                <Box
                  onMouseDown={e => onResizeMouseDown(e, table.id)}
                  sx={{
                    position: 'absolute', bottom: 2, right: 2,
                    width: 10, height: 10,
                    cursor: 'se-resize',
                    bgcolor: color,
                    borderRadius: '2px 0 2px 0',
                    opacity: 0.5,
                    '&:hover': { opacity: 1 },
                  }}
                />
              </Box>
            );
          })}
        </Paper>

        {/* ── 주문 패널 ── */}
        <Paper
          elevation={0}
          sx={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          }}
        >
          {!selectedTable ? (
            <Box display="flex" alignItems="center" justifyContent="center" flex={1}>
              <Stack alignItems="center" gap={2} p={4}>
                <Box sx={{ p: 3, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                  <IconifyIcon icon="mingcute:table-2-line" width={40} color={theme.palette.primary.main} />
                </Box>
                <Typography color="text.secondary" textAlign="center">
                  테이블을 선택하면<br />주문 패널이 열립니다
                </Typography>
              </Stack>
            </Box>
          ) : (
            <>
              {/* 헤더 */}
              <Box sx={{ p: 2, bgcolor: 'primary.dark', color: 'white' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={800} variant="h6" lineHeight={1}>{selectedTable.name} 테이블</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.75 }}>
                      {selectedTable.placed ? '주문 완료 · 결제 대기' : selectedTable.status === 'occupied' ? '주문 담는 중' : '주문 대기'}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setSelected(null)} sx={{ color: 'white' }}>
                    <IconifyIcon icon="mingcute:close-line" width={18} />
                  </IconButton>
                </Stack>
              </Box>

              {/* 메뉴 목록 */}
              <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, display: 'block', mb: 1 }}>
                  메뉴 추가
                </Typography>
                <Stack gap={0.5} sx={{ maxHeight: 180, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                  {menus.length === 0 ? (
                    <Typography variant="body2" color="text.disabled" p={1}>등록된 메뉴 없음</Typography>
                  ) : menus.map(menu => (
                    <Stack
                      key={menu.id}
                      direction="row"
                      alignItems="center"
                      gap={1.2}
                      onClick={() => addToOrder(menu)}
                      sx={{
                        p: 1.2, borderRadius: 2,
                        border: `1px solid ${theme.palette.divider}`,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: theme.palette.primary.light },
                      }}
                    >
                      <Box
                        sx={{
                          width: 44, height: 44, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden',
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {menu.imageUrl ? (
                          <Box component="img" src={menu.imageUrl} alt={menu.menuName}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <IconifyIcon icon="mingcute:bowl-line" width={22} color={theme.palette.text.disabled} />
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} lineHeight={1.2} noWrap>{menu.menuName}</Typography>
                        <Typography variant="caption" color="text.secondary">₩{menu.price?.toLocaleString()}</Typography>
                      </Box>
                      <IconifyIcon icon="mingcute:add-circle-line" color={theme.palette.primary.main} width={22} />
                    </Stack>
                  ))}
                </Stack>
              </Box>

              {/* 주문 내역 */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, display: 'block', mb: 1 }}>
                  주문 내역
                </Typography>
                {selectedTable.orders.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" p={1}>주문 내역 없음</Typography>
                ) : (
                  <Stack gap={0.5}>
                    {selectedTable.orders.map(o => (
                      <Stack key={o.menuId} direction="row" alignItems="center" justifyContent="space-between"
                        sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.04) }}
                      >
                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{o.menuName}</Typography>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <IconButton size="small" onClick={() => changeQty(o.menuId, -1)} sx={{ width: 22, height: 22 }}>
                            <IconifyIcon icon="mingcute:minus-line" width={14} />
                          </IconButton>
                          <Typography variant="body2" fontWeight={800} sx={{ minWidth: 20, textAlign: 'center' }}>{o.qty}</Typography>
                          <IconButton size="small" onClick={() => changeQty(o.menuId, 1)} sx={{ width: 22, height: 22 }}>
                            <IconifyIcon icon="mingcute:add-line" width={14} />
                          </IconButton>
                        </Stack>
                        <Typography variant="body2" color="primary.main" fontWeight={700} sx={{ minWidth: 70, textAlign: 'right' }}>
                          ₩{(o.price * o.qty).toLocaleString()}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* 결제 영역 */}
              <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Typography fontWeight={700}>합계</Typography>
                  <Typography variant="h6" fontWeight={900} color="primary.main">
                    ₩{totalPrice.toLocaleString()}
                  </Typography>
                </Stack>
                {!selectedTable.placed ? (
                  <Button
                    fullWidth variant="contained" size="large"
                    disabled={selectedTable.orders.length === 0}
                    onClick={placeOrder}
                    sx={{ borderRadius: 2, fontWeight: 700, py: 1.5, fontSize: 16 }}
                  >
                    주문하기
                  </Button>
                ) : (
                  <Button
                    fullWidth variant="contained" color="success" size="large"
                    disabled={paying}
                    onClick={handlePay}
                    sx={{ borderRadius: 2, fontWeight: 700, py: 1.5, fontSize: 16 }}
                  >
                    {paying ? <CircularProgress size={22} color="inherit" /> : '결제하기'}
                  </Button>
                )}
              </Box>
            </>
          )}
        </Paper>
      </Box>

      {/* ── 영수증 다이얼로그 ── */}
      <Dialog open={receiptOpen} onClose={handleReceiptClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <Box sx={{ p: 1, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.12) }}>
              <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={24} />
            </Box>
            결제 완료
          </Stack>
        </DialogTitle>
        <DialogContent>
          {receipt && (
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2, fontFamily: 'monospace' }}>
              <Typography variant="body2" textAlign="center" fontWeight={700} mb={0.5}>FoodGuard</Typography>
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mb={1}>
                {new Date().toLocaleString('ko-KR')} · {receipt.tableName} 테이블
              </Typography>
              <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
              <Stack gap={0.5} mb={1.5}>
                {receipt.orders.map(o => (
                  <Stack key={o.menuId} direction="row" justifyContent="space-between">
                    <Typography variant="body2">{o.menuName} × {o.qty}</Typography>
                    <Typography variant="body2">₩{(o.price * o.qty).toLocaleString()}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
              <Stack direction="row" justifyContent="space-between">
                <Typography fontWeight={800}>합 계</Typography>
                <Typography fontWeight={800} color="primary.main">₩{receipt.total.toLocaleString()}</Typography>
              </Stack>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
            판매 실적이 자동 기록되었습니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleReceiptClose} variant="contained" fullWidth size="large" sx={{ borderRadius: 2 }}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── 메뉴 설정 다이얼로그 ── */}
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

export default POS;
