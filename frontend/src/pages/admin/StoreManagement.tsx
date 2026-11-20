import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Stack, useTheme,
  TextField, InputAdornment, Popover,
  CircularProgress, Alert, Chip, Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { storeService } from '../../services/storeService';
import { orderService } from '../../services/orderService';
import IconifyIcon from '../../components/base/IconifyIcon';
import QrCodeDisplay from '../../components/QrCodeDisplay';

declare global {
  interface Window {
    daum: {
      Postcode: new (config: { oncomplete: (data: any) => void }) => { open: () => void };
    };
  }
}

const SIDO_MAP: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
  '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
  '울산광역시': '울산', '세종특별자치시': '세종', '경기도': '경기',
  '강원도': '강원', '강원특별자치도': '강원', '충청북도': '충북',
  '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북',
  '전라남도': '전남', '경상북도': '경북', '경상남도': '경남',
  '제주특별자치도': '제주',
};

const normalizeRegion = (sido: string) => SIDO_MAP[sido] ?? sido;

const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

const KOREA_REGIONS: Record<string, Record<string, string[]>> = {
  서울: { 강남구: [], 강동구: [], 강북구: [], 강서구: [], 관악구: [], 광진구: [], 구로구: [], 금천구: [], 노원구: [], 도봉구: [], 동대문구: [], 동작구: [], 마포구: [], 서대문구: [], 서초구: [], 성동구: [], 성북구: [], 송파구: [], 양천구: [], 영등포구: [], 용산구: [], 은평구: [], 종로구: [], 중구: [], 중랑구: [] },
  부산: { 강서구: [], 금정구: [], 기장군: [], 남구: [], 동구: [], 동래구: [], 부산진구: [], 북구: [], 사상구: [], 사하구: [], 서구: [], 수영구: [], 연제구: [], 영도구: [], 중구: [], 해운대구: [] },
  대구: { 남구: [], 달서구: [], 달성군: [], 동구: [], 북구: [], 서구: [], 수성구: [], 중구: [] },
  인천: { 강화군: [], 계양구: [], 남동구: [], 동구: [], 미추홀구: [], 부평구: [], 서구: [], 연수구: [], 옹진군: [], 중구: [] },
  광주: { 광산구: [], 남구: [], 동구: [], 북구: [], 서구: [] },
  대전: { 대덕구: [], 동구: [], 서구: [], 유성구: [], 중구: [] },
  울산: { 남구: [], 동구: [], 북구: [], 울주군: [], 중구: [] },
  세종: { 세종시: [] },
  경기: {
    수원시: ['장안구', '권선구', '팔달구', '영통구'],
    성남시: ['수정구', '중원구', '분당구'],
    안양시: ['만안구', '동안구'],
    안산시: ['상록구', '단원구'],
    고양시: ['덕양구', '일산동구', '일산서구'],
    용인시: ['처인구', '기흥구', '수지구'],
    의정부시: [], 부천시: [], 광명시: [], 평택시: [], 동두천시: [],
    과천시: [], 구리시: [], 남양주시: [], 오산시: [], 시흥시: [],
    군포시: [], 의왕시: [], 하남시: [], 파주시: [], 이천시: [],
    안성시: [], 김포시: [], 화성시: [], 광주시: [], 양주시: [],
    포천시: [], 여주시: [], 연천군: [], 가평군: [], 양평군: [],
  },
  강원: {
    춘천시: [], 원주시: [], 강릉시: [], 동해시: [], 태백시: [],
    속초시: [], 삼척시: [], 홍천군: [], 횡성군: [], 영월군: [],
    평창군: [], 정선군: [], 철원군: [], 화천군: [], 양구군: [],
    인제군: [], 고성군: [], 양양군: [],
  },
  충북: {
    청주시: ['상당구', '서원구', '흥덕구', '청원구'],
    충주시: [], 제천시: [], 보은군: [], 옥천군: [], 영동군: [],
    증평군: [], 진천군: [], 괴산군: [], 음성군: [], 단양군: [],
  },
  충남: {
    천안시: ['동남구', '서북구'],
    공주시: [], 보령시: [], 아산시: [], 서산시: [], 논산시: [],
    계룡시: [], 당진시: [], 금산군: [], 부여군: [], 서천군: [],
    청양군: [], 홍성군: [], 예산군: [], 태안군: [],
  },
  전북: {
    전주시: ['완산구', '덕진구'],
    군산시: [], 익산시: [], 정읍시: [], 남원시: [], 김제시: [],
    완주군: [], 진안군: [], 무주군: [], 장수군: [], 임실군: [],
    순창군: [], 고창군: [], 부안군: [],
  },
  전남: {
    목포시: [], 여수시: [], 순천시: [], 나주시: [], 광양시: [],
    담양군: [], 곡성군: [], 구례군: [], 고흥군: [], 보성군: [],
    화순군: [], 장흥군: [], 강진군: [], 해남군: [], 영암군: [],
    무안군: [], 함평군: [], 영광군: [], 장성군: [], 완도군: [],
    진도군: [], 신안군: [],
  },
  경북: {
    포항시: ['남구', '북구'],
    경주시: [], 김천시: [], 안동시: [], 구미시: [], 영주시: [],
    영천시: [], 상주시: [], 문경시: [], 경산시: [], 의성군: [],
    청송군: [], 영양군: [], 영덕군: [], 청도군: [], 고령군: [],
    성주군: [], 칠곡군: [], 예천군: [], 봉화군: [], 울진군: [], 울릉군: [],
  },
  경남: {
    창원시: ['의창구', '성산구', '마산합포구', '마산회원구', '진해구'],
    진주시: [], 통영시: [], 사천시: [], 김해시: [], 밀양시: [],
    거제시: [], 양산시: [], 의령군: [], 함안군: [], 창녕군: [],
    고성군: [], 남해군: [], 하동군: [], 산청군: [], 함양군: [],
    거창군: [], 합천군: [],
  },
  제주: { 제주시: [], 서귀포시: [] },
};

type RegionFilter = { sido: string; sigun: string; sgg: string };

const CascadingRegionFilter = ({
  value,
  onChange,
}: {
  value: RegionFilter;
  onChange: (v: RegionFilter) => void;
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [hoveredSido, setHoveredSido] = useState<string | null>(null);
  const [hoveredSigun, setHoveredSigun] = useState<string | null>(null);

  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setHoveredSido(value.sido || null);
    setHoveredSigun(value.sigun || null);
  };

  const handleClose = () => setAnchorEl(null);

  const label = value.sgg
    ? `${value.sido} ${value.sigun} ${value.sgg}`
    : value.sigun
    ? `${value.sido} ${value.sigun}`
    : value.sido || '전체 지역';

  const sigunList = hoveredSido ? Object.keys(KOREA_REGIONS[hoveredSido] ?? {}) : [];
  const sggList = hoveredSido && hoveredSigun ? KOREA_REGIONS[hoveredSido]?.[hoveredSigun] ?? [] : [];

  const colStyle = {
    py: 0.5,
    maxHeight: 380,
    overflowY: 'auto' as const,
  };

  const itemBase = {
    px: 1.5,
    py: 0.6,
    cursor: 'pointer',
    fontSize: 13,
    borderRadius: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 0.5,
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.1s',
  };

  const isActivePath = (sido: string, sigun = '', sgg = '') => {
    if (sgg) return value.sido === sido && value.sigun === sigun && value.sgg === sgg;
    if (sigun) return value.sido === sido && value.sigun === sigun;
    return value.sido === sido;
  };

  const itemSx = (active: boolean, hovered: boolean) => ({
    ...itemBase,
    color: active ? 'primary.main' : 'text.primary',
    fontWeight: active ? 700 : 400,
    bgcolor: hovered
      ? `${theme.palette.primary.main}18`
      : active
      ? `${theme.palette.primary.main}10`
      : 'transparent',
    '&:hover': { bgcolor: `${theme.palette.primary.main}18`, color: 'primary.main' },
  });

  return (
    <>
      <Button
        variant={value.sido ? 'contained' : 'outlined'}
        size="small"
        onClick={handleOpen}
        endIcon={<IconifyIcon icon={open ? 'mingcute:up-line' : 'mingcute:down-line'} width={13} />}
        sx={{ minWidth: 130, justifyContent: 'space-between', fontSize: 13 }}
      >
        {label}
      </Button>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 0.5,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[4],
          },
        }}
      >
        <Stack direction="row">
          {/* 시도 */}
          <Box sx={{ ...colStyle, width: 110, borderRight: `1px solid ${theme.palette.divider}` }}>
            <Box
              onClick={() => { onChange({ sido: '', sigun: '', sgg: '' }); handleClose(); }}
              onMouseEnter={() => { setHoveredSido(null); setHoveredSigun(null); }}
              sx={{ ...itemBase, color: !value.sido ? 'primary.main' : 'text.secondary', fontWeight: !value.sido ? 700 : 400, '&:hover': { bgcolor: 'action.hover', color: 'primary.main' } }}
            >
              전체 지역
            </Box>
            {Object.keys(KOREA_REGIONS).map((sido) => (
              <Box
                key={sido}
                onMouseEnter={() => { setHoveredSido(sido); setHoveredSigun(null); }}
                onClick={() => { onChange({ sido, sigun: '', sgg: '' }); handleClose(); }}
                sx={itemSx(isActivePath(sido) && !value.sigun, hoveredSido === sido)}
              >
                {sido}
                <IconifyIcon icon="mingcute:right-line" width={11} />
              </Box>
            ))}
          </Box>

          {/* 시군구 */}
          {hoveredSido && sigunList.length > 0 && (
            <Box sx={{ ...colStyle, width: 120, borderRight: sggList.length > 0 ? `1px solid ${theme.palette.divider}` : 'none' }}>
              {sigunList.map((sigun) => {
                const hasSgg = (KOREA_REGIONS[hoveredSido!]?.[sigun] ?? []).length > 0;
                return (
                  <Box
                    key={sigun}
                    onMouseEnter={() => setHoveredSigun(sigun)}
                    onClick={() => { onChange({ sido: hoveredSido!, sigun, sgg: '' }); handleClose(); }}
                    sx={itemSx(isActivePath(hoveredSido!, sigun) && !value.sgg, hoveredSigun === sigun)}
                  >
                    {sigun}
                    {hasSgg && <IconifyIcon icon="mingcute:right-line" width={11} />}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* 구/군 */}
          {hoveredSido && hoveredSigun && sggList.length > 0 && (
            <Box sx={{ ...colStyle, width: 120 }}>
              {sggList.map((sgg) => (
                <Box
                  key={sgg}
                  onClick={() => { onChange({ sido: hoveredSido!, sigun: hoveredSigun!, sgg }); handleClose(); }}
                  sx={itemSx(isActivePath(hoveredSido!, hoveredSigun!, sgg), false)}
                >
                  {sgg}
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </Popover>
    </>
  );
};

const StoreManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>({ sido: '', sigun: '', sgg: '' });
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    storeName: '', address: '', detailAddress: '', phone: '', region: '',
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [detailTab, setDetailTab] = useState(0);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [hqSendTarget, setHqSendTarget] = useState<number | null>(null);
  const [hqSendName, setHqSendName] = useState('');
  const [expiryDateInput, setExpiryDateInput] = useState('');
  const [qrData, setQrData] = useState<{ data: string; name: string } | null>(null);
  const [pendingStoreIds, setPendingStoreIds] = useState<Set<number>>(new Set());
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const scriptLoaded = useRef(false);

  const loadPostcodeScript = () => {
    if (scriptLoaded.current || document.getElementById('daum-postcode-script')) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = POSTCODE_SCRIPT_URL;
    script.onload = () => { scriptLoaded.current = true; };
    document.head.appendChild(script);
  };

  useEffect(() => {
    storeService.getAll()
      .then((list: any[]) => setStores(list ?? []))
      .catch(() => setError('가맹점 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
    loadPostcodeScript();

    const ACTIVE = new Set(['REQUESTED', 'APPROVED', 'HQ_SENT', 'DRIVER_RECEIVED']);
    const loadPendingStores = () =>
      orderService.getAll().then((orders: any[]) => {
        const ids = new Set<number>(
          (orders ?? []).filter((o: any) => ACTIVE.has(o.status)).map((o: any) => o.store?.id).filter(Boolean)
        );
        setPendingStoreIds(ids);
      }).catch(() => {});
    loadPendingStores();
    const timer = setInterval(loadPendingStores, 5000);
    return () => clearInterval(timer);
  }, []);

  const ACTIVE_STATUSES = new Set(['REQUESTED', 'APPROVED', 'HQ_SENT', 'DRIVER_RECEIVED']);

  const reloadOrders = (storeId: number) => {
    setOrdersLoading(true);
    orderService.getByStore(storeId)
      .then((orders: any[]) =>
        setPendingOrders((orders ?? []).filter((o: any) => ACTIVE_STATUSES.has(o.status)))
      )
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => {
    setEditMode(false);
    setDetailTab(0);
    if (!selectedStore?.id) return;
    reloadOrders(selectedStore.id);
  }, [selectedStore?.id]);

  const filtered = stores.filter((s: any) => {
    const matchSearch = s.storeName?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = !regionFilter.sido
      || (s.region === regionFilter.sido
        && (!regionFilter.sigun || s.address?.includes(regionFilter.sigun))
        && (!regionFilter.sgg || s.address?.includes(regionFilter.sgg)));
    const matchPending = !showPendingOnly || pendingStoreIds.has(s.id);
    return matchSearch && matchRegion && matchPending;
  });

  const openPostcode = () => {
    if (!window.daum?.Postcode) {
      setError('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        const fullAddress = data.roadAddress || data.jibunAddress;
        const region = normalizeRegion(data.sido);
        setEditForm((prev) => ({ ...prev, address: fullAddress, region, detailAddress: '' }));
      },
    }).open();
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const startEdit = () => {
    setEditForm({
      storeName: selectedStore.storeName,
      address: selectedStore.address ?? '',
      detailAddress: '',
      phone: selectedStore.phone ?? '',
      region: selectedStore.region ?? '',
    });
    setEditMode(true);
  };

  const handleEditSubmit = async () => {
    if (!editForm.storeName || !editForm.address || !editForm.phone) {
      setError('가게 이름, 주소, 전화번호를 모두 입력해주세요.');
      return;
    }
    setEditSubmitting(true);
    setError('');
    const fullAddress = editForm.detailAddress
      ? `${editForm.address} ${editForm.detailAddress}`
      : editForm.address;
    try {
      await storeService.update(selectedStore.id, {
        storeName: editForm.storeName,
        address: fullAddress,
        phone: editForm.phone,
        region: editForm.region,
      });
      setSuccess('가맹점 정보가 수정되었습니다!');
      setEditMode(false);
      const updated = await storeService.getAll();
      setStores(updated ?? []);
      setSelectedStore((updated ?? []).find((s: any) => s.id === selectedStore.id) ?? null);
    } catch {
      setError('가맹점 수정에 실패했습니다.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const infoItems = selectedStore
    ? [
        { label: '지역', value: selectedStore.region ?? '-', icon: 'mingcute:location-line' },
        { label: '전화번호', value: selectedStore.phone ?? '-', icon: 'mingcute:phone-line' },
        { label: '점주 이메일', value: selectedStore.user?.email ?? '-', icon: 'mingcute:mail-line' },
        { label: '개점일', value: selectedStore.openedAt ?? '-', icon: 'mingcute:calendar-line' },
        { label: '등록일', value: selectedStore.createdAt ? new Date(selectedStore.createdAt).toLocaleDateString() : '-', icon: 'mingcute:time-line' },
        { label: '주소', value: selectedStore.address ?? '미등록', icon: 'mingcute:map-pin-line' },
      ]
    : [];

  const rowSx = { borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } };
  const ORDER_STEPS = ['REQUESTED', 'APPROVED', 'HQ_SENT', 'DRIVER_RECEIVED'];
  const ORDER_LABEL: Record<string, string> = {
    REQUESTED: '승인 대기', APPROVED: '발송 필요', HQ_SENT: '배달중', DRIVER_RECEIVED: '점주 검수 대기',
  };
  const requestedCount = pendingOrders.filter(o => o.status === 'REQUESTED').length;
  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.paper',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 */}
      <Box>
        <Typography color="text.secondary" fontSize={15} mb={1}>가맹점</Typography>
        <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
          {loading ? '-' : `${stores.length}곳`}
        </Typography>
        {!loading && (
          <Typography fontSize={15} color="text.secondary" mt={1}>진행 중인 발주가 있는 곳 {pendingStoreIds.size}곳</Typography>
        )}
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 검색 + 필터 */}
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="가맹점명 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconifyIcon icon="mingcute:search-2-line" width={18} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
        />
        <CascadingRegionFilter value={regionFilter} onChange={setRegionFilter} />
        {pill(`발주 진행 중만 (${pendingStoreIds.size})`, showPendingOnly, () => setShowPendingOnly(v => !v))}
        <Typography variant="body2" color="text.secondary">{loading ? '불러오는 중…' : `${filtered.length}곳 표시`}</Typography>
      </Stack>

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' }, alignItems: 'start' }}>
        {/* 왼쪽: 가맹점 목록 */}
        <Paper sx={{ p: 3, maxHeight: 680, overflowY: 'auto' }}>
          {loading ? (
            <Stack alignItems="center" py={8}><CircularProgress /></Stack>
          ) : filtered.length === 0 ? (
            <Stack alignItems="center" py={8} gap={1}>
              <IconifyIcon icon="mingcute:search-2-line" width={32} color={theme.palette.text.disabled} />
              <Typography color="text.secondary" fontSize={14}>검색 결과가 없습니다.</Typography>
            </Stack>
          ) : filtered.map((store: any) => {
            const isSelected = selectedStore?.id === store.id;
            return (
              <Stack
                key={store.id} direction="row" alignItems="center" gap={2}
                onClick={() => setSelectedStore(store)}
                sx={{
                  px: 2, py: 2.5, borderRadius: 3, cursor: 'pointer', opacity: store.isActive ? 1 : 0.5,
                  bgcolor: isSelected ? 'primary.light' : 'transparent',
                  '&:hover': { bgcolor: isSelected ? 'primary.light' : 'background.default' },
                }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: isSelected ? 'primary.main' : 'background.default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography fontWeight={700} fontSize={14} color={isSelected ? 'common.white' : 'text.secondary'}>{store.storeName?.slice(0, 1)}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={600} fontSize={15} noWrap color={isSelected ? 'primary.main' : 'text.primary'}>{store.storeName}</Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {store.region ?? '-'}{!store.isActive && ' · 비활성'}
                  </Typography>
                </Box>
                {pendingStoreIds.has(store.id) && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} aria-label="진행 중 발주 있음" />
                )}
              </Stack>
            );
          })}
        </Paper>

        {/* 오른쪽: 가맹점 상세 */}
        {!selectedStore ? (
          <Paper sx={{ p: 8, alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconifyIcon icon="mingcute:store-2-line" width={36} color={theme.palette.text.disabled} />
            </Box>
            <Typography color="text.secondary" fontWeight={600}>왼쪽에서 가맹점을 고르면 상세 정보가 보여요.</Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 5, gap: 4 }}>
            {/* 헤더 */}
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontSize={24} fontWeight={700}>{selectedStore.storeName}</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {selectedStore.isActive ? '운영 중' : '비활성'} · {selectedStore.address ?? '주소 미등록'}
                </Typography>
              </Box>
              {!editMode && detailTab === 0 && (
                <Button size="small" variant="outlined" onClick={startEdit}
                  startIcon={<IconifyIcon icon="mingcute:edit-2-line" width={14} />}>
                  수정
                </Button>
              )}
            </Stack>

            <Stack direction="row" gap={1} sx={{ bgcolor: 'background.default', p: 0.75, borderRadius: 999, alignSelf: 'flex-start' }}>
              {pill('가맹점 정보', detailTab === 0, () => { setDetailTab(0); setEditMode(false); })}
              {pill(`발주 현황${requestedCount > 0 ? ` · 승인 대기 ${requestedCount}` : ''}`, detailTab === 1, () => { setDetailTab(1); setEditMode(false); })}
            </Stack>

            {detailTab === 0 && (
              editMode ? (
                <Stack gap={2.5}>
                  <TextField label="가게 이름" name="storeName" value={editForm.storeName} onChange={handleEditChange} size="small" fullWidth required />
                  <TextField
                    label="기본 주소" value={editForm.address} size="small" fullWidth required
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button size="small" variant="outlined" onClick={openPostcode}
                            startIcon={<IconifyIcon icon="mingcute:search-2-line" width={15} />} sx={{ whiteSpace: 'nowrap', mr: 1 }}>
                            주소 검색
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {editForm.address && (
                    <TextField label="상세 주소" name="detailAddress" value={editForm.detailAddress} onChange={handleEditChange} size="small" placeholder="동/호수, 건물명 등 (선택)" fullWidth />
                  )}
                  {editForm.region && (
                    <Typography variant="body2" color="primary.main" fontWeight={600}>지역: {editForm.region}</Typography>
                  )}
                  <TextField label="전화번호" name="phone" value={editForm.phone} onChange={handleEditChange} size="small" placeholder="010-0000-0000" fullWidth required />
                  <Stack direction="row" gap={1.5} justifyContent="flex-end">
                    <Button variant="text" onClick={() => setEditMode(false)}>취소</Button>
                    <Button onClick={handleEditSubmit} disabled={editSubmitting}
                      startIcon={editSubmitting ? <CircularProgress size={16} color="inherit" /> : null}>
                      {editSubmitting ? '저장 중...' : '저장'}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Box>
                    {infoItems.map((item) => (
                      <Stack key={item.label} direction="row" alignItems="center" gap={2} sx={{ py: 2.5, ...rowSx }}>
                        <IconifyIcon icon={item.icon} width={18} color={theme.palette.text.disabled} />
                        <Typography color="text.secondary" fontSize={15} sx={{ width: 96, flexShrink: 0 }}>{item.label}</Typography>
                        <Typography fontWeight={600} fontSize={15} sx={{ flex: 1, minWidth: 0, textAlign: 'right' }} noWrap>{item.value}</Typography>
                      </Stack>
                    ))}
                  </Box>
                  <Button
                    variant="outlined" fullWidth
                    startIcon={<IconifyIcon icon="mingcute:truck-line" width={18} />}
                    onClick={() => navigate(`/admin/orders?storeId=${selectedStore.id}&storeName=${encodeURIComponent(selectedStore.storeName)}`)}
                  >
                    이 가맹점 발주 보기
                  </Button>
                </>
              )
            )}

            {detailTab === 1 && (
              ordersLoading ? (
                <Stack alignItems="center" py={6}><CircularProgress /></Stack>
              ) : pendingOrders.length === 0 ? (
                <Stack alignItems="center" py={6} gap={1.5}>
                  <IconifyIcon icon="mingcute:check-circle-fill" color={theme.palette.success.main} width={44} />
                  <Typography color="text.secondary" fontWeight={600}>진행 중인 발주가 없습니다.</Typography>
                </Stack>
              ) : (
                <Box>
                  {pendingOrders.map((order: any) => {
                    const driverUrl = order.deliveryGroupToken
                      ? `${window.location.origin}/driver/group/${order.deliveryGroupToken}`
                      : null;
                    const step = ORDER_STEPS.indexOf(order.status);
                    return (
                      <Box key={order.id} sx={{ py: 3, ...rowSx }}>
                        <Stack direction="row" alignItems="center" gap={2} flexWrap="wrap">
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={600} fontSize={15} noWrap>
                              {order.ingredient?.name ?? '-'} <Box component="span" fontWeight={700}>{order.orderedQty ?? order.quantity}{order.ingredient?.unit ?? ''}</Box>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {order.orderedAt ? new Date(order.orderedAt).toLocaleDateString() : '-'}
                            </Typography>
                          </Box>
                          <Typography fontWeight={700} fontSize={14} color={step <= 1 ? 'primary.main' : 'text.secondary'}>
                            {ORDER_LABEL[order.status] ?? order.status}
                          </Typography>
                          {order.status === 'REQUESTED' && (
                            <Stack direction="row" gap={1}>
                              <Button size="small" variant="text" color="error"
                                onClick={async () => {
                                  try {
                                    await orderService.updateStatus(order.id, 'REJECTED');
                                    reloadOrders(selectedStore.id);
                                    setSuccess('발주가 거절되었습니다.');
                                  } catch { setError('거절에 실패했습니다.'); }
                                }}>거절</Button>
                              <Button size="small"
                                onClick={async () => {
                                  try {
                                    await orderService.approve(order.id);
                                    reloadOrders(selectedStore.id);
                                    setSuccess('발주가 승인되었습니다.');
                                  } catch { setError('승인에 실패했습니다.'); }
                                }}>승인</Button>
                            </Stack>
                          )}
                          {order.status === 'APPROVED' && (
                            <Button size="small"
                              onClick={() => { setHqSendTarget(order.id); setHqSendName(order.ingredient?.name ?? '식자재'); setExpiryDateInput(''); }}>
                              발송 검수
                            </Button>
                          )}
                          {order.status === 'HQ_SENT' && driverUrl && (
                            <Button size="small" variant="outlined" startIcon={<IconifyIcon icon="mingcute:link-line" width={16} />}
                              onClick={() => { navigator.clipboard.writeText(driverUrl); setSuccess('배달기사 링크가 복사되었습니다.'); }}>
                              기사 링크
                            </Button>
                          )}
                        </Stack>
                        {step >= 0 && (
                          <Stack direction="row" gap={0.75} mt={2}>
                            {ORDER_STEPS.map((s, i) => (
                              <Box key={s} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= step ? 'primary.main' : 'divider' }} />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )
            )}
          </Paper>
        )}
      </Box>
      {/* 유통기한 입력 다이얼로그 */}
      <Dialog open={hqSendTarget !== null} onClose={() => { setHqSendTarget(null); setExpiryDateInput(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>발송 검수 완료 — {hqSendName}</DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            <Typography variant="body2" color="text.secondary">
              유통기한을 입력하면 QR 코드가 생성됩니다. (선택 사항)
            </Typography>
            <TextField
              label="유통기한" type="date" value={expiryDateInput}
              onChange={(e) => setExpiryDateInput(e.target.value)}
              InputLabelProps={{ shrink: true }} fullWidth size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setHqSendTarget(null); setExpiryDateInput(''); }}>취소</Button>
          <Button variant="contained" color="success" onClick={async () => {
            if (hqSendTarget === null) return;
            try {
              const result = await orderService.hqSend(hqSendTarget, expiryDateInput || undefined);
              setSuccess('발송 검수가 완료되었습니다.');
              setHqSendTarget(null);
              setExpiryDateInput('');
              if (result?.qrToken) {
                const qrUrl = `${window.location.origin}/driver/scan?token=${result.qrToken}`;
                setQrData({ data: qrUrl, name: hqSendName });
              }
              reloadOrders(selectedStore.id);
            } catch {
              setError('발송 검수 처리에 실패했습니다.');
              setHqSendTarget(null);
            }
          }}>
            발송 검수완료
          </Button>
        </DialogActions>
      </Dialog>

      {/* QR 코드 표시 */}
      {qrData && (
        <QrCodeDisplay
          data={qrData.data}
          title={`${qrData.name} QR 코드`}
          subtitle="이 QR 코드를 패키지에 부착하세요"
          onClose={() => setQrData(null)}
        />
      )}
    </Stack>
  );
};

export default StoreManagement;
