import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Stack, Typography, Paper, Chip, Alert,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const STAGES = ['승인됨', '배송중', '배달완료', '검수완료'];
const STAGE_ICONS = ['✅', '🚚', '📦', '🔍'];

const statusToStage: Record<string, number> = {
  APPROVED: 0,
  IN_DELIVERY: 1,
  DELIVERED: 2,
  INSPECTED: 3,
};

const DeliveryDriverGroup = () => {
  const { groupToken } = useParams<{ groupToken: string }>();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [completing, setCompleting] = useState(false);

  const stompClient = useRef<Client | null>(null);
  const watchId = useRef<number | null>(null);
  const sendInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<{ lat: number; lng: number } | null>(null);

  const currentStage = info ? (statusToStage[info.status] ?? 0) : 0;
  const isDone = info?.status === 'DELIVERED' || info?.status === 'INSPECTED';

  const loadInfo = () => {
    if (!groupToken) return;
    fetch(`/api/delivery/group/${groupToken}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        if (data.status === 'IN_DELIVERY') setTracking(true);
      })
      .catch(() => setError('배달 정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInfo();
    return () => stopTracking();
  }, [groupToken]);

  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (sendInterval.current) clearInterval(sendInterval.current);
    stompClient.current?.deactivate();
    watchId.current = null;
    sendInterval.current = null;
  };

  const startDelivery = async () => {
    if (!navigator.geolocation) {
      setError('이 기기는 GPS를 지원하지 않습니다.');
      return;
    }

    try {
      await fetch(`/api/delivery/group/${groupToken}/start`, { method: 'POST' });
    } catch {
      setError('배송 시작 처리에 실패했습니다.');
      return;
    }

    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
    });
    client.activate();
    stompClient.current = client;

    setTracking(true);
    setInfo((prev: any) => ({ ...prev, status: 'IN_DELIVERY' }));

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(loc);
        latestPos.current = loc;
      },
      () => setError('GPS 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해주세요.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    sendInterval.current = setInterval(() => {
      if (latestPos.current && stompClient.current?.connected) {
        stompClient.current.publish({
          destination: `/app/delivery/group/${groupToken}/location`,
          body: JSON.stringify(latestPos.current),
        });
      }
    }, 5000);
  };

  const completeDelivery = async () => {
    setCompleting(true);
    try {
      await fetch(`/api/delivery/group/${groupToken}/complete`, { method: 'POST' });
      stopTracking();
      setInfo((prev: any) => ({ ...prev, status: 'DELIVERED' }));
    } catch {
      setError('완료 처리에 실패했습니다.');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );

  if (error && !info) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">{error}</Alert>
    </Box>
  );

  if (isDone && info?.status === 'DELIVERED') return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
      <Typography fontSize={64}>📦</Typography>
      <Typography variant="h5" fontWeight={800} color="success.main">배달 완료!</Typography>
      <Typography color="text.secondary" textAlign="center">
        {info?.storeName}에 배달이 완료되었습니다.<br />
        가맹점주의 검수 확인을 기다리고 있습니다.
      </Typography>
    </Box>
  );

  if (info?.status === 'INSPECTED') return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
      <Typography fontSize={64}>✅</Typography>
      <Typography variant="h5" fontWeight={800} color="success.main">검수 완료!</Typography>
      <Typography color="text.secondary">{info?.storeName} 검수가 확인되었습니다.</Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', pb: 4 }}>
      {/* 헤더 */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', px: 3, py: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography fontSize={28}>🚚</Typography>
          <Box>
            <Typography fontWeight={800} fontSize={18}>FoodGuard 묶음 배달</Typography>
            <Typography fontSize={13} sx={{ opacity: 0.85 }}>배달기사 전용 페이지</Typography>
          </Box>
        </Stack>
      </Box>

      <Stack gap={2} sx={{ px: 2, pt: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* 배달 진행 단계 */}
        <Paper sx={{ p: 2, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between">
            {STAGES.map((label, i) => (
              <Stack key={i} alignItems="center" gap={0.5} sx={{ flex: 1, opacity: i <= currentStage ? 1 : 0.3 }}>
                <Typography fontSize={20}>{STAGE_ICONS[i]}</Typography>
                <Typography variant="caption" fontWeight={i === currentStage ? 700 : 400}
                  color={i === currentStage ? 'primary.main' : 'text.secondary'} textAlign="center" sx={{ fontSize: 10 }}>
                  {label}
                </Typography>
              </Stack>
            ))}
          </Stack>
          <Box sx={{ height: 5, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden', mt: 1.5 }}>
            <Box sx={{
              height: '100%', bgcolor: 'primary.main', borderRadius: 3,
              width: `${(currentStage / (STAGES.length - 1)) * 100}%`,
              transition: 'width 0.5s',
            }} />
          </Box>
        </Paper>

        {/* 배달지 정보 */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1.5}>배달지 정보</Typography>
          <Stack gap={1}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontSize={20}>🏪</Typography>
              <Box>
                <Typography fontWeight={700}>{info?.storeName}</Typography>
                <Typography variant="body2" color="text.secondary">{info?.storeAddress}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {/* 배달 품목 목록 */}
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography fontSize={18}>📦</Typography>
              <Typography fontWeight={700}>배달 품목 ({info?.items?.length ?? 0}건)</Typography>
            </Stack>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>식자재</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>수량</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(info?.items ?? []).map((item: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell sx={{ fontWeight: 600 }}>{item.ingredientName}</TableCell>
                  <TableCell align="right">
                    {item.quantity}
                    <Typography component="span" variant="caption" color="text.secondary" ml={0.5}>
                      {item.unit}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* 지도 */}
        {position && (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: 280 }}>
              <MapContainer center={[position.lat, position.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[position.lat, position.lng]} icon={truckIcon} />
                <MapRecenter lat={position.lat} lng={position.lng} />
              </MapContainer>
            </Box>
          </Paper>
        )}

        {tracking && position && (
          <Stack direction="row" gap={1} alignItems="center" sx={{ px: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="caption" color="text.secondary">
              GPS 실시간 전송 중 ({position.lat.toFixed(5)}, {position.lng.toFixed(5)})
            </Typography>
          </Stack>
        )}

        {/* 버튼 */}
        {info?.status === 'APPROVED' && (
          <Button
            variant="contained"
            size="large"
            onClick={startDelivery}
            sx={{ borderRadius: 3, py: 2, fontSize: 16, fontWeight: 700 }}
            startIcon={<Typography fontSize={20}>🚀</Typography>}
          >
            배송 시작 ({info?.items?.length ?? 0}건 일괄)
          </Button>
        )}

        {info?.status === 'IN_DELIVERY' && (
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={completeDelivery}
            disabled={completing}
            sx={{ borderRadius: 3, py: 2, fontSize: 16, fontWeight: 700 }}
            startIcon={completing ? <CircularProgress size={20} color="inherit" /> : <Typography fontSize={20}>✅</Typography>}
          >
            {completing ? '처리 중...' : '배달 완료'}
          </Button>
        )}
      </Stack>
    </Box>
  );
};

export default DeliveryDriverGroup;
