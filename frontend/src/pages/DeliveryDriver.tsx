import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography, Paper, Chip, Alert } from '@mui/material';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// leaflet 기본 마커 아이콘 fix
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

const STAGE_LABELS = ['배송 준비중', '픽업 완료', '배송중', '거의 도착'];
const STAGE_ICONS = ['📦', '🏭', '🚚', '📍'];

const DeliveryDriver = () => {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [done, setDone] = useState(false);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [stage, setStage] = useState(0);
  const [completing, setCompleting] = useState(false);

  const stompClient = useRef<Client | null>(null);
  const watchId = useRef<number | null>(null);
  const sendInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPos = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/delivery/${token}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        if (data.status === 'DONE') setDone(true);
      })
      .catch(() => setError('배달 정보를 불러올 수 없습니다.'))
      .finally(() => setLoading(false));

    return () => stopTracking();
  }, [token]);

  const connectWs = (onConnected?: () => void) => {
    const client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: onConnected,
    });
    client.activate();
    stompClient.current = client;
  };

  const stopTracking = () => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (sendInterval.current) clearInterval(sendInterval.current);
    stompClient.current?.deactivate();
    watchId.current = null;
    sendInterval.current = null;
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('이 기기는 GPS를 지원하지 않습니다.');
      return;
    }
    // WebSocket 연결 후 START 이벤트 전송 → 관리자 화면에서 승인됨 → 완료 탭으로 이동
    connectWs(() => {
      stompClient.current?.publish({
        destination: `/app/delivery/${token}/start`,
        body: JSON.stringify({}),
      });
    });
    setTracking(true);
    setStage(1);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(loc);
        latestPos.current = loc;
      },
      () => setError('GPS 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해주세요.'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // 5초마다 WebSocket으로 위치 전송
    sendInterval.current = setInterval(() => {
      if (latestPos.current && stompClient.current?.connected) {
        stompClient.current.publish({
          destination: `/app/delivery/${token}/location`,
          body: JSON.stringify(latestPos.current),
        });
      }
    }, 5000);

    // 시간 기반 단계 자동 진행 (시연용)
    setTimeout(() => setStage(2), 60000);   // 1분 후 배송중
    setTimeout(() => setStage(3), 180000);  // 3분 후 거의 도착
  };

  const completeDelivery = async () => {
    setCompleting(true);
    try {
      await fetch(`/api/delivery/${token}/complete`, { method: 'POST' });
      stopTracking();
      setDone(true);
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

  if (done) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
      <Typography fontSize={64}>✅</Typography>
      <Typography variant="h5" fontWeight={800} color="success.main">배달 완료!</Typography>
      <Typography color="text.secondary">{info?.storeName}에 배달이 완료되었습니다.</Typography>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50', pb: 4 }}>
      {/* 헤더 */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', px: 3, py: 2.5 }}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Typography fontSize={28}>🚚</Typography>
          <Box>
            <Typography fontWeight={800} fontSize={18}>FoodGuard 배달</Typography>
            <Typography fontSize={13} sx={{ opacity: 0.85 }}>배달기사 전용 페이지</Typography>
          </Box>
        </Stack>
      </Box>

      <Stack gap={2} sx={{ px: 2, pt: 2 }}>
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* 배달 정보 */}
        <Paper sx={{ p: 2.5, borderRadius: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1.5}>배달 정보</Typography>
          <Stack gap={1.5}>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontSize={20}>🏪</Typography>
              <Box>
                <Typography fontWeight={700}>{info?.storeName}</Typography>
                <Typography variant="body2" color="text.secondary">{info?.storeAddress}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" gap={1} alignItems="center">
              <Typography fontSize={20}>📦</Typography>
              <Typography fontWeight={600}>
                {info?.ingredientName} — {info?.quantity} {info?.unit}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {/* 배송 단계 */}
        {tracking && (
          <Paper sx={{ p: 2, borderRadius: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              {STAGE_LABELS.map((label, i) => (
                <Stack key={i} alignItems="center" gap={0.5} sx={{ flex: 1, opacity: i <= stage ? 1 : 0.35 }}>
                  <Typography fontSize={22}>{STAGE_ICONS[i]}</Typography>
                  <Typography variant="caption" fontWeight={i === stage ? 700 : 400}
                    color={i === stage ? 'primary.main' : 'text.secondary'} textAlign="center">
                    {label}
                  </Typography>
                  {i < STAGE_LABELS.length - 1 && (
                    <Box sx={{ position: 'absolute' }} />
                  )}
                </Stack>
              ))}
            </Stack>
            <Chip
              label={STAGE_LABELS[stage]}
              color="primary"
              sx={{ mt: 1.5, width: '100%', fontWeight: 700, borderRadius: 2 }}
            />
          </Paper>
        )}

        {/* 지도 */}
        {position && (
          <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ height: 300 }}>
              <MapContainer center={[position.lat, position.lng]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[position.lat, position.lng]} icon={truckIcon} />
                <MapRecenter lat={position.lat} lng={position.lng} />
              </MapContainer>
            </Box>
          </Paper>
        )}

        {/* GPS 위치 상태 */}
        {tracking && position && (
          <Stack direction="row" gap={1} alignItems="center" sx={{ px: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', animation: 'pulse 1.5s infinite' }} />
            <Typography variant="caption" color="text.secondary">
              GPS 실시간 전송 중 ({position.lat.toFixed(5)}, {position.lng.toFixed(5)})
            </Typography>
          </Stack>
        )}

        {/* 버튼 */}
        {!tracking ? (
          <Button
            variant="contained"
            size="large"
            onClick={startTracking}
            sx={{ borderRadius: 3, py: 2, fontSize: 16, fontWeight: 700 }}
            startIcon={<Typography fontSize={20}>🚀</Typography>}
          >
            배달 시작
          </Button>
        ) : (
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

export default DeliveryDriver;
