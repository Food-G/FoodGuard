import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, Stack, useTheme,
  TextField, InputAdornment, Popover,
  CircularProgress, Alert, Chip, Divider, Button,
} from '@mui/material';
import { storeService } from '../../services/storeService';
import IconifyIcon from '../../components/base/IconifyIcon';

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
  }, []);

  useEffect(() => {
    setEditMode(false);
  }, [selectedStore?.id]);

  const filtered = stores.filter((s: any) => {
    const matchSearch = s.storeName?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = !regionFilter.sido
      || (s.region === regionFilter.sido
        && (!regionFilter.sigun || s.address?.includes(regionFilter.sigun))
        && (!regionFilter.sgg || s.address?.includes(regionFilter.sgg)));
    return matchSearch && matchRegion;
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

  return (
    <Stack gap={3.5} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>가맹점 네트워크 관리</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 검색 + 필터 바 */}
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="가맹점명 검색..."
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
        <Chip
          label={loading ? '로딩 중...' : `총 ${filtered.length}개 가맹점`}
          color="primary" variant="outlined" size="small"
        />
      </Stack>

      <Grid container spacing={2.5}>
        {/* 왼쪽: 가맹점 목록 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{
            border: `1px solid ${theme.palette.divider}`, borderRadius: 3,
            height: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">가맹점 목록</Typography>
            </Box>

            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <IconifyIcon icon="mingcute:search-2-line" width={32} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" fontSize={14}>검색 결과가 없습니다.</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {filtered.map((store: any, idx: number) => {
                  const isSelected = selectedStore?.id === store.id;
                  return (
                    <Box
                      key={store.id}
                      onClick={() => setSelectedStore(store)}
                      sx={{
                        px: 2.5, py: 1.75,
                        cursor: 'pointer',
                        borderLeft: `3px solid ${isSelected ? theme.palette.primary.main : 'transparent'}`,
                        bgcolor: isSelected ? `${theme.palette.primary.main}0A` : 'transparent',
                        transition: 'background 0.12s',
                        borderTop: idx > 0 ? `1px solid ${theme.palette.divider}` : 'none',
                        '&:hover': { bgcolor: isSelected ? `${theme.palette.primary.main}12` : 'action.hover' },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight={700} fontSize={14}
                          color={isSelected ? 'primary.main' : 'text.primary'}
                          noWrap sx={{ maxWidth: 170 }}
                        >
                          {store.storeName}
                        </Typography>
                        <Chip
                          label={store.isActive ? '운영중' : '비활성'}
                          size="small"
                          color={store.isActive ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      </Stack>
                      <Stack direction="row" gap={0.5} mt={0.5} alignItems="center">
                        <IconifyIcon icon="mingcute:location-line" width={12} color={theme.palette.text.disabled} />
                        <Typography variant="caption" color="text.secondary">{store.region ?? '-'}</Typography>
                        <Typography variant="caption" color="text.disabled" mx={0.25}>·</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                          {store.user?.email ?? '-'}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 오른쪽: 가맹점 상세 */}
        <Grid item xs={12} md={8}>
          {!selectedStore ? (
            <Paper sx={{
              border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: 600,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2,
            }}>
              <Box sx={{ p: 3, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex' }}>
                <IconifyIcon icon="mingcute:store-2-line" width={44} color={theme.palette.text.disabled} />
              </Box>
              <Typography color="text.secondary" fontWeight={600}>가맹점을 선택하면 상세 정보가 표시됩니다.</Typography>
              <Typography variant="caption" color="text.disabled">왼쪽 목록에서 가맹점을 클릭하세요</Typography>
            </Paper>
          ) : (
            <Paper sx={{ p: 3.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: 600, display: 'flex', flexDirection: 'column' }}>
              {/* 헤더 */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="text.primary">{selectedStore.storeName}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {selectedStore.address ?? '주소 미등록'}
                  </Typography>
                </Box>
                <Stack direction="row" gap={1} alignItems="center">
                  <Chip
                    label={selectedStore.isActive ? '운영중' : '비활성'}
                    color={selectedStore.isActive ? 'success' : 'default'}
                    sx={{ fontWeight: 700 }}
                  />
                  {!editMode && (
                    <Button size="small" variant="outlined" onClick={startEdit}
                      startIcon={<IconifyIcon icon="mingcute:edit-2-line" width={14} />}>
                      수정
                    </Button>
                  )}
                </Stack>
              </Stack>

              <Divider sx={{ mb: 2.5 }} />

              {editMode ? (
                <Stack gap={2} sx={{ flex: 1, overflowY: 'auto' }}>
                  <TextField label="가게 이름" name="storeName" value={editForm.storeName} onChange={handleEditChange} size="small" fullWidth required />
                  <Stack gap={1}>
                    <TextField
                      label="기본 주소"
                      value={editForm.address}
                      size="small"
                      fullWidth
                      required
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button variant="contained" size="small" onClick={openPostcode}
                              sx={{ borderRadius: 1.5, px: 1.5, whiteSpace: 'nowrap' }}
                              startIcon={<IconifyIcon icon="mingcute:search-2-line" width={15} />}>
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
                      <Stack direction="row" gap={1} alignItems="center">
                        <IconifyIcon icon="mingcute:location-fill" width={15} color="primary.main" />
                        <Typography variant="caption" color="primary.main" fontWeight={700}>지역: {editForm.region}</Typography>
                      </Stack>
                    )}
                  </Stack>
                  <TextField label="전화번호" name="phone" value={editForm.phone} onChange={handleEditChange} size="small" placeholder="010-0000-0000" fullWidth required />
                </Stack>
              ) : (
                <Grid container spacing={2} sx={{ flex: 1 }}>
                  {infoItems.map((item) => (
                    <Grid item xs={12} sm={6} key={item.label}>
                      <Stack direction="row" gap={1} alignItems="center">
                        <IconifyIcon icon={item.icon} width={15} color={theme.palette.text.secondary} />
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72 }}>{item.label}</Typography>
                        <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>{item.value}</Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              )}

              <Box sx={{ mt: 'auto', pt: 3 }}>
                <Divider sx={{ mb: 2.5 }} />
                {editMode ? (
                  <Stack direction="row" gap={1.5}>
                    <Button
                      variant="contained"
                      fullWidth
                      size="large"
                      onClick={handleEditSubmit}
                      disabled={editSubmitting}
                      startIcon={editSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
                      sx={{ borderRadius: 3, py: 1.5 }}
                    >
                      {editSubmitting ? '저장 중...' : '저장'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="large"
                      onClick={() => setEditMode(false)}
                      sx={{ borderRadius: 3, py: 1.5, minWidth: 80 }}
                    >
                      취소
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<IconifyIcon icon="mingcute:chart-bar-fill" width={20} />}
                    sx={{ borderRadius: 3, py: 1.5 }}
                    onClick={() =>
                      navigate(`/admin/stats?storeId=${selectedStore.id}&storeName=${encodeURIComponent(selectedStore.storeName)}`)
                    }
                  >
                    {selectedStore.storeName} 매출 통계 보기
                  </Button>
                )}
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
};

export default StoreManagement;
