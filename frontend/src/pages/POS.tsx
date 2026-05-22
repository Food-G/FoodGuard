import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Button, Stack, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Divider, Alert, CircularProgress, Tooltip, Snackbar, Avatar,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { menuService } from '../services/menuService';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

interface PosTable { id: string; name: string; x: number; y: number; }
interface OrderItem { menuId: number; menuName: string; price: number; qty: number; }

const FLOOR_W = 1600;
const FLOOR_H = 1200;
const TABLE_W = 180;
const TABLE_H = 160;

/* ── 공통 주문 아이템 행 ── */
const OrderRow = ({
  item,
  onMinus,
  onPlus,
  onRemove,
}: {
  item: OrderItem;
  onMinus?: () => void;
  onPlus?: () => void;
  onRemove?: () => void;
}) => (
  <Stack direction="row" alignItems="center" gap={1.5} px={1.5} py={1.25}
    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', mb: 0.75 }}>
    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.50', borderRadius: 1.5, flexShrink: 0 }}>
      <IconifyIcon icon="mingcute:fork-spoon-line" color="primary.main" width={18} />
    </Avatar>
    <Box flex={1} minWidth={0}>
      <Typography variant="body2" fontWeight={700} noWrap>{item.menuName}</Typography>
      <Typography variant="caption" color="text.secondary">{item.price.toLocaleString()}원</Typography>
    </Box>
    {onMinus && onPlus ? (
      <Stack direction="row" alignItems="center" gap={0.5}>
        <IconButton size="small" onClick={onMinus}
          sx={{ width: 26, height: 26, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <IconifyIcon icon="mingcute:minus-line" width={12} />
        </IconButton>
        <Typography fontWeight={800} sx={{ minWidth: 24, textAlign: 'center', fontSize: 14 }}>
          {item.qty}
        </Typography>
        <IconButton size="small" onClick={onPlus}
          sx={{ width: 26, height: 26, bgcolor: 'primary.main', color: 'white', borderRadius: 1, '&:hover': { bgcolor: 'primary.dark' } }}>
          <IconifyIcon icon="mingcute:add-line" width={12} />
        </IconButton>
      </Stack>
    ) : (
      <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'primary.main', color: 'white', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
        {item.qty}개
      </Box>
    )}
    <Typography variant="body2" fontWeight={800} color="primary.main"
      sx={{ minWidth: 68, textAlign: 'right', flexShrink: 0 }}>
      {(item.price * item.qty).toLocaleString()}원
    </Typography>
    {onRemove && (
      <IconButton size="small" onClick={onRemove} sx={{ color: 'error.light', '&:hover': { color: 'error.main' } }}>
        <IconifyIcon icon="mingcute:close-line" width={14} />
      </IconButton>
    )}
  </Stack>
);

/* ── 이미지 리사이즈 (canvas) ── */
const resizeImage = (file: File, maxW = 220, maxH = 160): Promise<string> =>
  new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });

const PHOTO_PFX = 'pos_menu_photo_';
const getPhoto  = (id: number) => localStorage.getItem(PHOTO_PFX + id) ?? '';
const savePhoto = (id: number, b64: string) => localStorage.setItem(PHOTO_PFX + id, b64);
const delPhoto  = (id: number) => localStorage.removeItem(PHOTO_PFX + id);

/* ═══════════════════════════════════════════════════════ */
const POS = ({ user }: { user: any }) => {
  const navigate = useNavigate();

  const [storeId, setStoreId]     = useState<number | null>(null);
  const [menus, setMenus]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tables, setTables]       = useState<PosTable[]>([]);
  const [orders, setOrders]       = useState<Record<string, OrderItem[]>>({});

  /* 메뉴 사진 { menuId: base64 } */
  const [menuPhotos, setMenuPhotos] = useState<Record<number, string>>({});
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [editingPhotoId, setEditingPhotoId] = useState<number | null>(null);

  /* 테이블 클릭 → 주문 다이얼로그 */
  const [orderDialog, setOrderDialog]   = useState<PosTable | null>(null);
  /* 다이얼로그 내 추가 중인 항목 */
  const [pending, setPending]           = useState<OrderItem[]>([]);

  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);

  /* dialogs */
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [menuOpen, setMenuOpen]         = useState(false);
  const [payConfirm, setPayConfirm]     = useState(false);
  const [paying, setPaying]             = useState(false);
  const [payMsg, setPayMsg]             = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [menuForm, setMenuForm]         = useState({ menuName: '', price: '' });
  const [menuMsg, setMenuMsg]           = useState('');
  const [snack, setSnack]               = useState('');

  /* ── localStorage ── */
  const tKey = useCallback((sid: number) => `pos_tables_${sid}`, []);

  const loadTables = useCallback((sid: number): PosTable[] => {
    const raw = localStorage.getItem(tKey(sid));
    if (raw) return JSON.parse(raw);
    const def: PosTable[] = [
      { id: '1', name: 'T1', x: 60,  y: 60  },
      { id: '2', name: 'T2', x: 300, y: 60  },
      { id: '3', name: 'T3', x: 540, y: 60  },
    ];
    localStorage.setItem(tKey(sid), JSON.stringify(def));
    return def;
  }, [tKey]);

  const saveTables = useCallback((list: PosTable[], sid: number) => {
    localStorage.setItem(tKey(sid), JSON.stringify(list));
    setTables(list);
  }, [tKey]);

  /* ── Boot ── */
  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (!stores?.length) { setLoading(false); return; }
      const sid: number = stores[0].id;
      setStoreId(sid);
      setTables(loadTables(sid));
      menuService.getByStore(sid)
        .then((d: any[]) => {
          const active = (d ?? []).filter((m: any) => m.isActive !== false);
          setMenus(active);
          const photos: Record<number, string> = {};
          for (const m of active) { const p = getPhoto(m.id); if (p) photos[m.id] = p; }
          setMenuPhotos(photos);
        })
        .finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, [user, loadTables]);

  /* ── Drag ── */
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const t = tables.find(t => t.id === id);
    if (!t) return;
    dragging.current = { id, ox: e.clientX - t.x, oy: e.clientY - t.y };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { id, ox, oy } = dragging.current;
      setTables(prev => prev.map(t =>
        t.id === id
          ? { ...t, x: Math.max(0, Math.min(FLOOR_W - TABLE_W, e.clientX - ox)), y: Math.max(0, Math.min(FLOOR_H - TABLE_H, e.clientY - oy)) }
          : t
      ));
    };
    const onUp = () => {
      if (!dragging.current || !storeId) { dragging.current = null; return; }
      setTables(prev => { localStorage.setItem(tKey(storeId), JSON.stringify(prev)); return prev; });
      dragging.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [storeId, tKey]);

  /* ── Table management ── */
  const handleAddTable = () => {
    if (!newTableName.trim() || !storeId) return;
    let x = 60, y = 60;
    const pos = new Set(tables.map(t => `${Math.round(t.x / 20)},${Math.round(t.y / 20)}`));
    while (pos.has(`${Math.round(x / 20)},${Math.round(y / 20)}`)) {
      x += TABLE_W + 24; if (x + TABLE_W > FLOOR_W) { x = 60; y += TABLE_H + 24; }
    }
    saveTables([...tables, { id: Date.now().toString(), name: newTableName.trim(), x, y }], storeId);
    setNewTableName('');
  };

  const handleDeleteTable = (id: string) => {
    if (!storeId) return;
    saveTables(tables.filter(t => t.id !== id), storeId);
    setOrders(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  /* ── 주문 다이얼로그 열기 ── */
  const openOrderDialog = (table: PosTable) => {
    setOrderDialog(table);
    setPending([]);
    setPayConfirm(false);
    setPayMsg('');
  };

  const closeOrderDialog = () => {
    setOrderDialog(null);
    setPending([]);
    setPayConfirm(false);
    setPayMsg('');
  };

  /* ── Pending (추가 중 항목) ── */
  const addToPending = (menu: any) => {
    setPending(prev => {
      const ex = prev.find(i => i.menuId === menu.id);
      return ex
        ? prev.map(i => i.menuId === menu.id ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { menuId: menu.id, menuName: menu.menuName, price: menu.price, qty: 1 }];
    });
  };

  const changePendingQty = (menuId: number, delta: number) => {
    setPending(prev => prev.map(i => i.menuId === menuId ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const removePending = (menuId: number) => {
    setPending(prev => prev.filter(i => i.menuId !== menuId));
  };

  /* ── 주문 확정 ── */
  const handleOrder = () => {
    if (!orderDialog || !pending.length) return;
    setOrders(prev => {
      const merged = [...(prev[orderDialog.id] ?? [])];
      for (const p of pending) {
        const ex = merged.find(i => i.menuId === p.menuId);
        if (ex) ex.qty += p.qty; else merged.push({ ...p });
      }
      return { ...prev, [orderDialog.id]: merged };
    });
    setPending([]);
    setSnack(`${orderDialog.name}에 주문이 추가됐습니다.`);
  };

  /* ── 결제 ── */
  const dialogOrderItems: OrderItem[] = orderDialog ? (orders[orderDialog.id] ?? []) : [];
  const dialogTotal = dialogOrderItems.reduce((s, i) => s + i.price * i.qty, 0);

  const handlePayment = async () => {
    if (!storeId || !orderDialog || !dialogOrderItems.length) return;
    setPaying(true);
    setPayMsg('');
    try {
      const today = new Date().toISOString().split('T')[0];
      for (const item of dialogOrderItems) {
        await salesService.create({ storeId, menuId: item.menuId, quantity: item.qty, totalPrice: item.price * item.qty, saleDate: today });
      }
      setOrders(prev => ({ ...prev, [orderDialog.id]: [] }));
      setPayMsg('결제 완료!');
      setTimeout(closeOrderDialog, 1600);
    } catch { setPayMsg('결제 중 오류가 발생했습니다.'); }
    finally { setPaying(false); }
  };

  /* ── Menu DB ── */
  const refreshMenus = useCallback(async (sid: number) => {
    const d = await menuService.getByStore(sid);
    const active = (d ?? []).filter((m: any) => m.isActive !== false);
    setMenus(active);
    // sync photos from localStorage
    const photos: Record<number, string> = {};
    for (const m of active) {
      const p = getPhoto(m.id);
      if (p) photos[m.id] = p;
    }
    setMenuPhotos(photos);
  }, []);

  /* ── Menu photo upload ── */
  const handlePhotoClick = (menuId: number) => {
    setEditingPhotoId(menuId);
    photoInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || editingPhotoId == null) return;
    try {
      const b64 = await resizeImage(file);
      savePhoto(editingPhotoId, b64);
      setMenuPhotos(prev => ({ ...prev, [editingPhotoId]: b64 }));
      setMenuMsg('사진이 저장됐습니다.');
    } catch { setMenuMsg('사진 저장 실패'); }
    setEditingPhotoId(null);
  };

  const handlePhotoDelete = (menuId: number) => {
    delPhoto(menuId);
    setMenuPhotos(prev => { const n = { ...prev }; delete n[menuId]; return n; });
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || !menuForm.menuName || !menuForm.price) return;
    setMenuMsg('');
    try {
      await menuService.create({ storeId, menuName: menuForm.menuName, price: parseInt(menuForm.price) });
      setMenuMsg(`"${menuForm.menuName}" 등록 완료`);
      setMenuForm({ menuName: '', price: '' });
      await refreshMenus(storeId);
    } catch { setMenuMsg('등록 실패'); }
  };

  const handleDeleteMenu = async (menuId: number, name: string) => {
    if (!storeId) return;
    try {
      await menuService.deactivate(menuId);
      setMenuMsg(`"${name}" 삭제 완료`);
      await refreshMenus(storeId);
    } catch { setMenuMsg('삭제 실패'); }
  };

  /* ── Helpers ── */
  const tableOrders = (id: string) => orders[id] ?? [];
  const isOccupied  = (id: string) => tableOrders(id).length > 0;
  const totalQty    = (id: string) => tableOrders(id).reduce((s, i) => s + i.qty, 0);
  const totalAmt    = (id: string) => tableOrders(id).reduce((s, i) => s + i.price * i.qty, 0);
  const pendingTotal = pending.reduce((s, i) => s + i.price * i.qty, 0);

  /* ═══════════════ Render ═══════════════ */
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>POS 시스템</Typography>
          <Typography variant="body2" color="text.secondary">테이블 클릭 → 주문 입력 · 드래그 → 자유 배치</Typography>
        </Box>
      </Stack>

      {!storeId && !loading && (
        <Alert severity="warning" sx={{ mb: 2 }}>등록된 가게가 없습니다. 가게를 먼저 등록해주세요.</Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* ── Top buttons (결제 제거) ── */}
          <Stack direction="row" alignItems="center" justifyContent="center" gap={2} mb={3} flexWrap="wrap">
            <Button variant="outlined" startIcon={<IconifyIcon icon="mingcute:calendar-2-line" />}
              onClick={() => navigate('/sales-stats')} sx={{ borderRadius: 2, px: 3 }}>
              날짜별 매출
            </Button>
            <Button variant="contained" startIcon={<IconifyIcon icon="mingcute:add-line" />}
              onClick={() => setAddTableOpen(true)} sx={{ borderRadius: 2, px: 3 }}>
              테이블 추가
            </Button>
            <Button variant="outlined" color="secondary" startIcon={<IconifyIcon icon="mingcute:fork-spoon-line" />}
              onClick={() => { setMenuMsg(''); setMenuOpen(true); }} sx={{ borderRadius: 2, px: 3 }}>
              메뉴 관리
            </Button>
          </Stack>

          {/* ── Floor plan ── */}
          <Paper sx={{
            borderRadius: 3, bgcolor: 'grey.50',
            border: '2px dashed', borderColor: 'divider',
            overflow: 'auto',
            '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
          }}>
            <Box sx={{
              position: 'relative', width: FLOOR_W, height: FLOOR_H,
              backgroundImage: 'radial-gradient(circle, #b8b8b8 1.5px, transparent 1.5px)',
              backgroundSize: '48px 48px',
            }}>
              {tables.length === 0 && (
                <Stack alignItems="center" justifyContent="center"
                  sx={{ position: 'absolute', inset: 0, opacity: 0.2, pointerEvents: 'none' }}>
                  <IconifyIcon icon="mingcute:chair-line" width={72} />
                  <Typography variant="h6" mt={1}>테이블 추가 버튼으로 배치하세요</Typography>
                </Stack>
              )}

              {tables.map(table => {
                const occupied = isOccupied(table.id);
                const qty      = totalQty(table.id);
                const amt      = totalAmt(table.id);
                const items    = tableOrders(table.id);
                return (
                  <Box
                    key={table.id}
                    onMouseDown={e => handleMouseDown(e, table.id)}
                    onClick={() => openOrderDialog(table)}
                    sx={{
                      position: 'absolute', left: table.x, top: table.y,
                      width: TABLE_W, height: TABLE_H,
                      cursor: 'pointer', userSelect: 'none',
                    }}
                  >
                    <Paper elevation={occupied ? 5 : 1} sx={{
                      width: '100%', height: '100%',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'stretch', justifyContent: 'flex-start',
                      border: '2.5px solid',
                      borderColor: occupied ? 'warning.main' : 'divider',
                      bgcolor: occupied ? '#fffde7' : 'background.paper',
                      borderRadius: 3, overflow: 'hidden',
                      transition: 'all 0.14s',
                      '&:hover': { borderColor: 'primary.main', boxShadow: 6, transform: 'translateY(-3px)' },
                    }}>
                      {/* Header strip */}
                      <Box sx={{
                        px: 1.5, py: 0.75,
                        bgcolor: occupied ? 'warning.main' : 'grey.100',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <Stack direction="row" alignItems="center" gap={0.75}>
                          <IconifyIcon icon="mingcute:chair-line" width={18}
                            sx={{ color: occupied ? 'white' : 'text.secondary' }} />
                          <Typography variant="h6" fontWeight={900}
                            sx={{ color: occupied ? 'white' : 'text.primary', fontSize: 16 }}>
                            {table.name}
                          </Typography>
                        </Stack>
                        <Chip
                          label={occupied ? '손님중' : '빈자리'}
                          size="small"
                          sx={{
                            height: 20, fontSize: 10, fontWeight: 700,
                            bgcolor: occupied ? 'rgba(255,255,255,0.25)' : 'transparent',
                            color: occupied ? 'white' : 'text.disabled',
                            border: occupied ? '1px solid rgba(255,255,255,0.5)' : '1px solid',
                            borderColor: occupied ? 'transparent' : 'divider',
                          }}
                        />
                      </Box>

                      {/* Order list on card */}
                      <Box sx={{ flex: 1, px: 1.25, py: 1, overflow: 'hidden' }}>
                        {items.length === 0 ? (
                          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%', opacity: 0.35 }}>
                            <Typography variant="body2" color="text.disabled" fontSize={12}>
                              클릭해서 주문
                            </Typography>
                          </Stack>
                        ) : (
                          <>
                            {items.slice(0, 3).map(item => (
                              <Stack key={item.menuId} direction="row" alignItems="center" justifyContent="space-between"
                                sx={{ mb: 0.4 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 600, flex: 1, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.menuName}
                                </Typography>
                                <Box sx={{
                                  ml: 0.75, px: 0.9, py: 0.2,
                                  borderRadius: 1, bgcolor: 'primary.main',
                                  color: 'white', fontSize: 11, fontWeight: 800, flexShrink: 0,
                                }}>
                                  {item.qty}
                                </Box>
                              </Stack>
                            ))}
                            {items.length > 3 && (
                              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right' }}>
                                +{items.length - 3}종 더
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>

                      {/* Footer: total qty + amount */}
                      {occupied && (
                        <Box sx={{
                          px: 1.5, py: 0.75,
                          bgcolor: 'warning.50',
                          borderTop: '1px solid', borderColor: 'warning.light',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <Stack direction="row" alignItems="center" gap={0.5}>
                            <IconifyIcon icon="mingcute:shopping-bag-1-line" width={14} color="warning.dark" />
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'warning.dark' }}>
                              {qty}개
                            </Typography>
                          </Stack>
                          <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'warning.dark' }}>
                            {amt.toLocaleString()}원
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </>
      )}

      {/* ══════════════ 주문 다이얼로그 ══════════════ */}
      <Dialog
        open={!!orderDialog}
        onClose={() => !paying && closeOrderDialog()}
        maxWidth="xl"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '92vh' } }}
      >
        {orderDialog && (
          <>
            <DialogTitle sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconifyIcon icon="mingcute:chair-line" sx={{ color: 'white' }} width={22} />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={900}>{orderDialog.name}</Typography>
                    <Typography variant="caption" color="text.secondary">메뉴를 선택하고 주문하기를 눌러주세요</Typography>
                  </Box>
                  {isOccupied(orderDialog.id) && (
                    <Chip label={`${totalQty(orderDialog.id)}개 주문중`} color="warning" size="small" sx={{ fontWeight: 700 }} />
                  )}
                </Stack>
                <IconButton onClick={closeOrderDialog} disabled={paying}>
                  <IconifyIcon icon="mingcute:close-line" width={20} />
                </IconButton>
              </Stack>
            </DialogTitle>

            {payMsg ? (
              <DialogContent>
                <Stack alignItems="center" py={6} gap={2}>
                  <IconifyIcon icon="mingcute:check-circle-fill" color="success.main" width={72} />
                  <Typography variant="h4" fontWeight={800} color="success.main">{payMsg}</Typography>
                </Stack>
              </DialogContent>
            ) : payConfirm ? (
              /* ── 결제 확인 화면 ── */
              <DialogContent sx={{ pt: 2 }}>
                <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
                  <IconButton size="small" onClick={() => setPayConfirm(false)}>
                    <IconifyIcon icon="mingcute:arrow-left-line" width={18} />
                  </IconButton>
                  <Typography variant="h6" fontWeight={800}>결제 확인</Typography>
                </Stack>
                {dialogOrderItems.map(item => (
                  <OrderRow key={item.menuId} item={item} />
                ))}
                <Box sx={{ mt: 2.5, p: 2.5, borderRadius: 2.5, bgcolor: 'success.50', border: '1.5px solid', borderColor: 'success.light' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography fontWeight={700} color="success.dark">총 합계</Typography>
                      <Typography variant="caption" color="text.secondary">{dialogOrderItems.reduce((s, i) => s + i.qty, 0)}개 항목</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight={900} color="success.dark">{dialogTotal.toLocaleString()}원</Typography>
                  </Stack>
                </Box>
              </DialogContent>
            ) : (
              /* ── 주문 입력 화면 (2열) ── */
              <DialogContent sx={{ p: 0 }}>
                <Grid container sx={{ minHeight: 540 }}>
                  {/* Left: 메뉴 선택 — 정사각형 그리드 */}
                  <Grid item xs={12} md={7} sx={{ borderRight: '1px solid', borderColor: 'divider', p: 2.5 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} mb={2}>
                      <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: 'primary.main' }} />
                      <Typography variant="h6" fontWeight={800}>메뉴 선택</Typography>
                      <Chip label={`${menus.length}개`} size="small" variant="outlined" />
                    </Stack>

                    {/* 정사각형 그리드 — 카드 크기 = TABLE_W × TABLE_H */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fill, ${TABLE_W}px)`,
                      gap: 1.5,
                      maxHeight: 520,
                      overflowY: 'auto',
                      '&::-webkit-scrollbar': { display: 'none' },
                      scrollbarWidth: 'none',
                    }}>
                      {menus.map(menu => {
                        const pItem  = pending.find(i => i.menuId === menu.id);
                        const mPhoto = menuPhotos[menu.id];
                        return (
                          <Paper
                            key={menu.id}
                            elevation={pItem ? 4 : 1}
                            onClick={() => addToPending(menu)}
                            sx={{
                              width: TABLE_W,
                              height: TABLE_H,
                              cursor: 'pointer',
                              border: '2px solid',
                              borderColor: pItem ? 'primary.main' : 'divider',
                              borderRadius: 3,
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              transition: 'all 0.14s',
                              '&:hover': { borderColor: 'primary.main', boxShadow: 4, transform: 'translateY(-2px)' },
                              position: 'relative',
                            }}
                          >
                            {/* Photo / icon area (~60% height) */}
                            <Box sx={{
                              flex: '0 0 92px',
                              overflow: 'hidden',
                              bgcolor: pItem ? 'primary.50' : 'grey.50',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {mPhoto ? (
                                <img src={mPhoto} alt={menu.menuName}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <IconifyIcon
                                  icon="mingcute:fork-spoon-line"
                                  width={38}
                                  sx={{ color: pItem ? 'primary.main' : 'text.disabled', opacity: 0.6 }}
                                />
                              )}
                            </Box>

                            {/* Name + price area */}
                            <Box sx={{ flex: 1, px: 1.25, pt: 0.75, pb: 0.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                              <Typography variant="body2" fontWeight={800} noWrap sx={{ lineHeight: 1.3 }}>
                                {menu.menuName}
                              </Typography>
                              <Typography variant="caption" fontWeight={700} color="primary.main">
                                {menu.price?.toLocaleString()}원
                              </Typography>
                            </Box>

                            {/* Qty controls — overlay at bottom when selected */}
                            {pItem && (
                              <Stack
                                direction="row"
                                alignItems="center"
                                justifyContent="center"
                                gap={0.75}
                                onClick={e => e.stopPropagation()}
                                sx={{
                                  px: 1, pb: 0.75,
                                  bgcolor: 'background.paper',
                                }}
                              >
                                <IconButton size="small" onClick={() => changePendingQty(menu.id, -1)}
                                  sx={{ width: 26, height: 26, border: '1px solid', borderColor: 'primary.light', borderRadius: 1 }}>
                                  <IconifyIcon icon="mingcute:minus-line" width={12} />
                                </IconButton>
                                <Typography fontWeight={900} color="primary.main"
                                  sx={{ minWidth: 24, textAlign: 'center', fontSize: 15 }}>
                                  {pItem.qty}
                                </Typography>
                                <IconButton size="small" onClick={() => changePendingQty(menu.id, 1)}
                                  sx={{ width: 26, height: 26, bgcolor: 'primary.main', color: 'white', borderRadius: 1, '&:hover': { bgcolor: 'primary.dark' } }}>
                                  <IconifyIcon icon="mingcute:add-line" width={12} />
                                </IconButton>
                              </Stack>
                            )}

                            {/* Add badge when not selected */}
                            {!pItem && (
                              <Box sx={{
                                position: 'absolute', bottom: 6, right: 6,
                                width: 22, height: 22, borderRadius: '50%',
                                bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <IconifyIcon icon="mingcute:add-line" sx={{ color: 'white' }} width={13} />
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                      {menus.length === 0 && (
                        <Typography color="text.disabled" textAlign="center" py={4}
                          sx={{ gridColumn: '1 / -1' }}>
                          메뉴가 없습니다. 상단 메뉴 관리에서 추가하세요.
                        </Typography>
                      )}
                    </Box>

                    {/* Pending subtotal */}
                    {pending.length > 0 && (
                      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.light' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={700} color="warning.dark">
                            선택 중 · {pending.reduce((s, i) => s + i.qty, 0)}개
                          </Typography>
                          <Typography variant="body1" fontWeight={800} color="warning.dark">
                            {pendingTotal.toLocaleString()}원
                          </Typography>
                        </Stack>
                      </Box>
                    )}
                  </Grid>

                  {/* Right: 주문 내역 */}
                  <Grid item xs={12} md={5} sx={{ p: 2.5, display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                      <Stack direction="row" alignItems="center" gap={0.75}>
                        <Box sx={{ width: 4, height: 18, borderRadius: 1, bgcolor: 'success.main' }} />
                        <Typography variant="h6" fontWeight={800}>주문 내역</Typography>
                        {dialogOrderItems.length > 0 && (
                          <Chip label={`${totalQty(orderDialog.id)}개`} color="success" size="small" sx={{ fontWeight: 700 }} />
                        )}
                      </Stack>
                      {dialogOrderItems.length > 0 && (
                        <Button size="small" color="error" variant="outlined" sx={{ borderRadius: 1.5, fontSize: 11, py: 0.25 }}
                          onClick={() => setOrders(prev => ({ ...prev, [orderDialog.id]: [] }))}>
                          전체 취소
                        </Button>
                      )}
                    </Stack>

                    {/* Added pending items (not yet ordered) */}
                    {pending.length > 0 && (
                      <Box mb={1.5}>
                        <Typography variant="caption" fontWeight={700} color="warning.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', display: 'inline-block' }} />
                          추가 예정
                        </Typography>
                        {pending.map(item => (
                          <OrderRow
                            key={item.menuId}
                            item={item}
                            onMinus={() => changePendingQty(item.menuId, -1)}
                            onPlus={() => changePendingQty(item.menuId, 1)}
                            onRemove={() => removePending(item.menuId)}
                          />
                        ))}
                        <Divider sx={{ my: 1.5 }} />
                      </Box>
                    )}

                    {/* Placed orders */}
                    <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
                      {dialogOrderItems.length === 0 && pending.length === 0 ? (
                        <Stack alignItems="center" justifyContent="center" sx={{ height: 160, opacity: 0.35 }}>
                          <IconifyIcon icon="mingcute:fork-spoon-line" width={40} />
                          <Typography variant="body2" mt={1}>메뉴를 선택하세요</Typography>
                        </Stack>
                      ) : (
                        dialogOrderItems.map(item => (
                          <OrderRow key={item.menuId} item={item} />
                        ))
                      )}
                    </Box>

                    {/* Total + buttons */}
                    {(dialogOrderItems.length > 0 || pending.length > 0) && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                          <Typography variant="body1" fontWeight={700} color="text.secondary">합계</Typography>
                          <Typography variant="h5" fontWeight={900} color="primary.main">
                            {(dialogTotal + pendingTotal).toLocaleString()}원
                          </Typography>
                        </Stack>
                        <Stack direction="row" gap={1}>
                          <Button
                            variant="contained" size="large" disabled={!pending.length}
                            onClick={handleOrder}
                            startIcon={<IconifyIcon icon="mingcute:check-circle-fill" />}
                            sx={{ flex: 1, borderRadius: 2, fontWeight: 800 }}
                          >
                            주문하기 {pending.length > 0 && `(${pending.reduce((s, i) => s + i.qty, 0)}개)`}
                          </Button>
                          <Button
                            variant="contained" color="success" size="large"
                            disabled={dialogOrderItems.length === 0}
                            onClick={() => setPayConfirm(true)}
                            startIcon={<IconifyIcon icon="mingcute:bank-card-fill" />}
                            sx={{ flex: 1, borderRadius: 2, fontWeight: 800 }}
                          >
                            결제하기
                          </Button>
                        </Stack>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </DialogContent>
            )}

            {payConfirm && !payMsg && (
              <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={() => setPayConfirm(false)} variant="outlined" sx={{ borderRadius: 2 }}>이전</Button>
                <Button onClick={handlePayment} variant="contained" color="success" disabled={paying}
                  startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <IconifyIcon icon="mingcute:bank-card-fill" />}
                  sx={{ borderRadius: 2, px: 5, fontWeight: 800 }}>
                  결제 완료
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>

      {/* ══ Add Table Dialog ══ */}
      <Dialog open={addTableOpen} onClose={() => setAddTableOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:add-circle-fill" color="primary.main" />테이블 추가 / 관리
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 420 }}>
          <Stack gap={3}>
            <Stack direction="row" gap={1.5} alignItems="center">
              <TextField label="테이블 이름 (예: T4, VIP룸)" value={newTableName}
                onChange={e => setNewTableName(e.target.value)} fullWidth
                onKeyDown={e => e.key === 'Enter' && handleAddTable()} />
              <Button variant="contained" size="large" onClick={handleAddTable}
                disabled={!newTableName.trim()} sx={{ whiteSpace: 'nowrap', px: 4, borderRadius: 2, height: 56 }}
                startIcon={<IconifyIcon icon="mingcute:add-line" />}>
                추가
              </Button>
            </Stack>
            <Divider />
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6" fontWeight={700}>등록된 테이블</Typography>
                <Chip label={`${tables.length}개`} color="primary" size="small" variant="outlined" />
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2, maxHeight: 320, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
                {tables.map(t => (
                  <Paper key={t.id} variant="outlined" sx={{ p: 2, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <IconifyIcon icon="mingcute:chair-line" width={22} color="primary.main" />
                      <Box>
                        <Typography variant="body1" fontWeight={700}>{t.name}</Typography>
                        <Chip label={isOccupied(t.id) ? '손님중' : '빈자리'} size="small" color={isOccupied(t.id) ? 'warning' : 'success'} sx={{ height: 18 }} />
                      </Box>
                    </Stack>
                    <Tooltip title="삭제"><span>
                      <IconButton size="small" color="error" onClick={() => handleDeleteTable(t.id)} disabled={isOccupied(t.id)}>
                        <IconifyIcon icon="mingcute:delete-2-line" width={16} />
                      </IconButton>
                    </span></Tooltip>
                  </Paper>
                ))}
                {tables.length === 0 && <Typography color="text.disabled" sx={{ gridColumn: '1/-1', textAlign: 'center', py: 4 }}>위에서 테이블을 추가하세요.</Typography>}
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAddTableOpen(false)} variant="contained" sx={{ borderRadius: 2, px: 4 }}>완료</Button>
        </DialogActions>
      </Dialog>

      {/* ══ Menu Management Dialog ══ */}
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:fork-spoon-line" color="primary.main" />메뉴 관리
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 420 }}>
          {menuMsg && <Alert severity={menuMsg.includes('실패') ? 'error' : 'success'} onClose={() => setMenuMsg('')} sx={{ mb: 2, borderRadius: 2 }}>{menuMsg}</Alert>}
          <Stack component="form" onSubmit={handleAddMenu} direction="row" gap={1.5} mb={3} alignItems="center">
            <TextField label="메뉴명" value={menuForm.menuName} onChange={e => setMenuForm(p => ({ ...p, menuName: e.target.value }))} size="small" sx={{ flex: 2 }} required />
            <TextField label="가격 (원)" type="number" value={menuForm.price} onChange={e => setMenuForm(p => ({ ...p, price: e.target.value }))} size="small" sx={{ flex: 1 }} required />
            <Button type="submit" variant="contained" sx={{ borderRadius: 2, whiteSpace: 'nowrap', height: 40 }}>등록</Button>
          </Stack>
          {/* hidden file input for photo upload */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />

          <Divider sx={{ mb: 2 }} />
          <Stack gap={1.25} sx={{ maxHeight: 360, overflowY: 'auto', '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none' }}>
            {menus.length === 0 ? (
              <Typography color="text.disabled" textAlign="center" py={4}>등록된 메뉴가 없습니다.</Typography>
            ) : menus.map(menu => {
              const photo = menuPhotos[menu.id];
              return (
                <Stack key={menu.id} direction="row" alignItems="center" justifyContent="space-between"
                  px={1.5} py={1.25} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, gap: 1.5 }}>
                  {/* Thumbnail or default icon */}
                  {photo ? (
                    <Box sx={{
                      width: 52, height: 40, borderRadius: 1.5, overflow: 'hidden',
                      border: '1.5px solid', borderColor: 'primary.light', flexShrink: 0,
                    }}>
                      <img src={photo} alt={menu.menuName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </Box>
                  ) : (
                    <Avatar sx={{ width: 40, height: 40, bgcolor: 'grey.100', borderRadius: 1.5, flexShrink: 0 }}>
                      <IconifyIcon icon="mingcute:fork-spoon-line" color="text.disabled" width={18} />
                    </Avatar>
                  )}

                  {/* Name + price */}
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={700} noWrap>{menu.menuName}</Typography>
                    <Typography variant="caption" color="primary.main" fontWeight={600}>{menu.price?.toLocaleString()}원</Typography>
                  </Box>

                  {/* Action buttons */}
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Tooltip title={photo ? '사진 변경' : '사진 추가'}>
                      <IconButton size="small" color="primary" onClick={() => handlePhotoClick(menu.id)}>
                        <IconifyIcon icon={photo ? 'mingcute:camera-fill' : 'mingcute:camera-line'} width={17} />
                      </IconButton>
                    </Tooltip>
                    {photo && (
                      <Tooltip title="사진 삭제">
                        <IconButton size="small" sx={{ color: 'text.disabled' }} onClick={() => handlePhotoDelete(menu.id)}>
                          <IconifyIcon icon="mingcute:close-circle-line" width={15} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="메뉴 삭제">
                      <IconButton size="small" color="error" onClick={() => handleDeleteMenu(menu.id, menu.menuName)}>
                        <IconifyIcon icon="mingcute:delete-2-line" width={17} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMenuOpen(false)} variant="contained" sx={{ borderRadius: 2, px: 4 }}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2200} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
};

export default POS;
