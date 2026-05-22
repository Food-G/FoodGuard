import { useEffect, useRef, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Chip, Stack, useTheme, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Divider, Popover,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { orderService } from '../services/orderService';
import { storeService } from '../services/storeService';
import IconifyIcon from '../components/base/IconifyIcon';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const truckIcon = L.divIcon({
  className: '',
  html: `<div style="background:#1976d2;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng]);
  return null;
}

const STAGES = ['승인됨', '픽업 완료', '배송중', '거의 도착'];
const STAGE_ICONS = ['✅', '🏭', '🚚', '📍'];

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: '대기중',
  APPROVED: '승인됨',
  DONE: '완료',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
};
const STATUS_COLOR: Record<string, any> = {
  REQUESTED: 'warning',
  APPROVED: 'info',
  DONE: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const Orders = ({ user }: any) => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancelledCount, setCancelledCount] = useState(0);

  // 배달 추적
  const [deliveryMap, setDeliveryMap] = useState<Record<string, { lat: number; lng: number; stage: number }>>({});
  const stompClients = useRef<Record<string, Client>>({});
  const [approvedOrders, setApprovedOrders] = useState<any[]>([]);

  // 배달 현황 팝오버 (hover)
  const [deliveryAnchor, setDeliveryAnchor] = useState<HTMLElement | null>(null);
  const deliveryCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 발주 추천 미리보기 다이얼로그
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // hover 팝오버 핸들러 (150ms 지연으로 버튼 → 팝오버 이동 시 자연스럽게 유지)
  const openDelivery = (e: React.MouseEvent<HTMLElement>) => {
    if (deliveryCloseTimer.current) clearTimeout(deliveryCloseTimer.current);
    setDeliveryAnchor(e.currentTarget);
  };
  const scheduleCloseDelivery = () => {
    deliveryCloseTimer.current = setTimeout(() => setDeliveryAnchor(null), 150);
  };
  const cancelCloseDelivery = () => {
    if (deliveryCloseTimer.current) clearTimeout(deliveryCloseTimer.current);
  };

  const subscribeDelivery = (token: string) => {
    if (stompClients.current[token]) return;
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/delivery/${token}`, (msg) => {
          const data = JSON.parse(msg.body);
          if (data.type === 'LOCATION') {
            setDeliveryMap((prev) => ({
              ...prev,
              [token]: { lat: data.lat, lng: data.lng, stage: prev[token]?.stage ?? 0 },
            }));
          } else if (data.type === 'DONE') {
            setDeliveryMap((prev) => {
              const next = { ...prev };
              delete next[token];
              return next;
            });
            stompClients.current[token]?.deactivate();
            delete stompClients.current[token];
            if (storeId) loadOrders(storeId);
          }
        });
      },
    });
    client.activate();
    stompClients.current[token] = client;
  };

  const loadOrders = async (sid: number) => {
    try {
      const orders = await orderService.getByStore(sid);
      const all = orders ?? [];
      setCancelledCount(all.filter((o: any) => o.status === 'CANCELLED').length);

      const approved = all.filter((o: any) => o.status === 'APPROVED' && o.deliveryToken);
      setApprovedOrders(approved);
      approved.forEach((o: any) => subscribeDelivery(o.deliveryToken));

      setRows(all
        .filter((item: any) => item.status !== 'CANCELLED' && item.status !== 'DONE')
        .map((item: any) => ({
          id: item.id,
          name: item.ingredient?.name ?? '-',
          quantity: item.orderedQty ?? item.quantity,
          unit: item.ingredient?.unit ?? '',
          status: item.status,
          orderedAt: item.orderedAt ? new Date(item.orderedAt).toLocaleString() : '-',
          deliveryToken: item.deliveryToken ?? null,
        })));
    } catch {
      setError('발주 내역을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    storeService.getMyStores(user.id).then(async (stores: any[]) => {
      if (!stores?.length) { setLoading(false); return; }
      const sid = stores[0].id;
      setStoreId(sid);
      try {
        await loadOrders(sid);
      } catch {
        setError('발주 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, [user]);

  const handleCancel = async (id: number) => {
    if (!window.confirm('발주를 취소하시겠습니까?')) return;
    try {
      await orderService.cancel(id);
      setSuccess('발주가 취소되었습니다.');
      if (storeId) await loadOrders(storeId);
    } catch {
      setError('취소에 실패했습니다.');
    }
  };

  const handleCancelAll = async () => {
    const requestedRows = rows.filter((r) => r.status === 'REQUESTED');
    if (requestedRows.length === 0) return;
    if (!window.confirm(`대기중인 발주 ${requestedRows.length}건을 모두 취소하시겠습니까?`)) return;
    try {
      await Promise.all(requestedRows.map((r) => orderService.cancel(r.id)));
      setSuccess(`${requestedRows.length}건 발주가 모두 취소되었습니다.`);
    } catch {
      setError('전체 취소 중 오류가 발생했습니다.');
    } finally {
      if (storeId) await loadOrders(storeId);
    }
  };

  const handleOpenPreview = async () => {
    if (!storeId) return;
    setPreviewing(true);
    setError('');
    setSuccess('');
    try {
      const recs = await orderService.recommend(storeId);
      const list = Array.isArray(recs) ? recs : [];
      if (list.length === 0) {
        setError('발주가 필요한 식자재가 없거나 AI 예측 데이터가 없습니다. 예측 페이지에서 먼저 예측을 실행해주세요.');
        return;
      }
      setRecommendations(list);
      setSelectedIds(new Set(list.map((r: any) => r.ingredientId)));
      setPreviewOpen(true);
    } catch {
      setError('추천 목록을 불러오지 못했습니다.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recommendations.map((r) => r.ingredientId)));
    }
  };

  const handleToggle = (ingId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(ingId)) next.delete(ingId);
      else next.add(ingId);
      return next;
    });
  };

  const handleConfirmOrder = async () => {
    if (!storeId || selectedIds.size === 0) return;
    setConfirming(true);
    try {
      const selected = recommendations.filter((r) => selectedIds.has(r.ingredientId));
      await Promise.all(
        selected.map((r) =>
          orderService.create({ storeId, ingredientId: r.ingredientId, quantity: r.orderQty })
        )
      );
      setSuccess(`${selected.length}건 발주가 등록되었습니다.`);
      setPreviewOpen(false);
    } catch {
      setError('발주 등록에 실패했습니다.');
    } finally {
      setConfirming(false);
      await loadOrders(storeId);
    }
  };

  const columns: GridColDef[] = [
    { field: 'orderedAt', headerName: '발주 일시', width: 180 },
    { field: 'name', headerName: '식자재명', flex: 1, minWidth: 160 },
    {
      field: 'quantity', headerName: '발주 수량', width: 150, align: 'right', headerAlign: 'right',
      renderCell: (params) => (
        <Typography fontWeight={600} fontSize={14}>
          {params.value} <span style={{ color: '#888', fontWeight: 400 }}>{params.row.unit}</span>
        </Typography>
      ),
    },
    {
      field: 'status', headerName: '상태', width: 110,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABEL[params.value] ?? params.value}
          color={STATUS_COLOR[params.value] ?? 'default'}
          size="small" variant="filled" sx={{ fontWeight: 700 }}
        />
      ),
    },
    {
      field: 'actions', headerName: '관리', width: 90,
      sortable: false, disableColumnMenu: true,
      renderCell: (params) =>
        params.row.status === 'REQUESTED' ? (
          <Button color="error" size="small" variant="outlined"
            onClick={() => handleCancel(params.id as number)} sx={{ borderRadius: 2 }}>
            취소
          </Button>
        ) : null,
    },
  ];

  const allSelected = recommendations.length > 0 && selectedIds.size === recommendations.length;
  const liveCount = Object.keys(deliveryMap).length;

  return (
    <Stack gap={3} sx={{ bgcolor: 'background.default' }}>

      {/* 헤더: 타이틀 | 배달현황 버튼(중앙) | AI 발주 버튼 */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 식자재 발주 시스템</Typography>
        </Box>

        <Stack direction="row" gap={1.5} alignItems="center">
          {/* 배달 현황 hover 버튼 */}
          {approvedOrders.length > 0 && (
            <Button
              variant="outlined"
              color={liveCount > 0 ? 'error' : 'info'}
              onMouseEnter={openDelivery}
              onMouseLeave={scheduleCloseDelivery}
              startIcon={<IconifyIcon icon="mingcute:truck-line" width={18} />}
              sx={{ borderRadius: 3, fontWeight: 700, position: 'relative' }}
            >
              배달 현황
              <Chip
                label={liveCount > 0 ? `🔴 ${liveCount}` : approvedOrders.length}
                size="small"
                color={liveCount > 0 ? 'error' : 'default'}
                sx={{ ml: 1, height: 20, fontSize: 11, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
              />
            </Button>
          )}

          <Button
            variant="contained"
            startIcon={previewing
              ? <CircularProgress size={16} color="inherit" />
              : <IconifyIcon icon="mingcute:sparkles-line" />}
            onClick={handleOpenPreview}
            disabled={previewing}
            sx={{ px: 3, py: 1.5, borderRadius: 3 }}
          >
            {previewing ? '분석 중...' : 'AI 예측 기반 자동 발주'}
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 발주 내역 (배달 현황이 위를 차지하지 않으므로 바로 표시) */}
      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Stack direction="row" alignItems="center" gap={1.5}>
            <Typography variant="h6" fontWeight={700}>발주 내역</Typography>
            {cancelledCount > 0 && (
              <Typography variant="caption" color="text.secondary">
                (취소된 발주 {cancelledCount}건 숨김)
              </Typography>
            )}
          </Stack>
          {rows.some((r) => r.status === 'REQUESTED') && (
            <Button color="error" size="small" variant="outlined" onClick={handleCancelAll} sx={{ borderRadius: 2 }}>
              전체 취소
            </Button>
          )}
        </Stack>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            disableRowSelectionOnClick
            hideFooter
            autoHeight
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 700 },
            }}
          />
        )}
      </Paper>

      {/* 배달 현황 hover 팝오버 */}
      <Popover
        open={Boolean(deliveryAnchor)}
        anchorEl={deliveryAnchor}
        onClose={() => setDeliveryAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableRestoreFocus
        disableScrollLock
        sx={{ pointerEvents: 'none', mt: 1 }}
        PaperProps={{
          onMouseEnter: cancelCloseDelivery,
          onMouseLeave: scheduleCloseDelivery,
          sx: {
            pointerEvents: 'auto',
            width: 480,
            maxHeight: 560,
            overflowY: 'auto',
            borderRadius: 3,
            boxShadow: theme.shadows[8],
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:truck-line" width={18} color={theme.palette.primary.main} />
            <Typography variant="subtitle1" fontWeight={700}>배달 현황</Typography>
            <Typography variant="caption" color="text.secondary">({approvedOrders.length}건)</Typography>
          </Stack>
        </Box>

        <Stack gap={0}>
          {approvedOrders.map((order: any, idx: number) => {
            const loc = deliveryMap[order.deliveryToken];
            const stage = loc?.stage ?? 0;
            return (
              <Box
                key={order.id}
                sx={{
                  p: 2.5,
                  borderTop: idx > 0 ? `1px solid ${theme.palette.divider}` : 'none',
                }}
              >
                {/* 발주 헤더 */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                  <Box>
                    <Typography fontWeight={700} fontSize={14}>{order.ingredient?.name ?? '-'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {order.orderedQty ?? order.quantity} {order.ingredient?.unit}
                    </Typography>
                  </Box>
                  {loc ? (
                    <Chip label="🔴 실시간 추적중" color="error" size="small" sx={{ fontWeight: 700 }} />
                  ) : (
                    <Chip label="배달 준비중" color="default" size="small" />
                  )}
                </Stack>

                {/* 단계 스텝퍼 */}
                <Stack direction="row" justifyContent="space-between" mb={1}>
                  {STAGES.map((label, i) => (
                    <Stack key={i} alignItems="center" gap={0.25} sx={{ flex: 1, opacity: i <= stage ? 1 : 0.3 }}>
                      <Typography fontSize={16}>{STAGE_ICONS[i]}</Typography>
                      <Typography
                        variant="caption"
                        fontWeight={i === stage ? 700 : 400}
                        color={i === stage ? 'primary.main' : 'text.secondary'}
                        textAlign="center"
                        sx={{ fontSize: 10 }}
                      >
                        {label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
                <Box sx={{ height: 5, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden', mb: 1.5 }}>
                  <Box
                    sx={{
                      height: '100%', bgcolor: 'primary.main', borderRadius: 3,
                      width: `${(stage / (STAGES.length - 1)) * 100}%`,
                      transition: 'width 0.5s',
                    }}
                  />
                </Box>

                {/* 지도 (실시간 위치 수신 시에만 표시) */}
                {loc ? (
                  <Box sx={{ borderRadius: 2, overflow: 'hidden', height: 200 }}>
                    <MapContainer center={[loc.lat, loc.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[loc.lat, loc.lng]} icon={truckIcon} />
                      <MapRecenter lat={loc.lat} lng={loc.lng} />
                    </MapContainer>
                  </Box>
                ) : (
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      배달기사가 출발하면 실시간 위치가 여기에 표시됩니다.
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      </Popover>

      {/* AI 추천 발주 미리보기 다이얼로그 */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" gap={1}>
            <IconifyIcon icon="mingcute:sparkles-line" />
            <Typography variant="h6" fontWeight={700}>AI 예측 발주 추천</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            발주할 항목을 선택하고 등록하세요. ({recommendations.length}개 추천)
          </Typography>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ p: 0 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'secondary.light' }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={handleToggleAll}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>식자재명</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>현재 재고</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>7일 필요량</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main' }}>발주 수량</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recommendations.map((rec) => (
                  <TableRow
                    key={rec.ingredientId}
                    hover
                    selected={selectedIds.has(rec.ingredientId)}
                    onClick={() => handleToggle(rec.ingredientId)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedIds.has(rec.ingredientId)}
                        onChange={() => handleToggle(rec.ingredientId)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{rec.ingredientName}</TableCell>
                    <TableCell align="right">
                      {rec.currentStock} <span style={{ color: '#888' }}>{rec.unit}</span>
                    </TableCell>
                    <TableCell align="right">
                      {rec.requiredQty} <span style={{ color: '#888' }}>{rec.unit}</span>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color="primary.main" fontSize={14}>
                        {rec.orderQty} <span style={{ fontWeight: 400, color: '#888' }}>{rec.unit}</span>
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {selectedIds.size}개 선택됨
          </Typography>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" onClick={() => setPreviewOpen(false)} disabled={confirming}>
              취소
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmOrder}
              disabled={confirming || selectedIds.size === 0}
              startIcon={confirming ? <CircularProgress size={14} color="inherit" /> : null}
            >
              {confirming ? '등록 중...' : `${selectedIds.size}건 발주 등록`}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Orders;
