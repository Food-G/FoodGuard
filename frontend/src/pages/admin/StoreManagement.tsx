import { useEffect, useState } from 'react';
import { Typography, Box, Paper, CircularProgress, Stack, useTheme } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';import { storeService } from '../../services/storeService';
import IconifyIcon from '../../components/base/IconifyIcon';

const StoreManagement = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const stores = await storeService.getAll();
        setRows(stores.map((s: any) => ({
          id: s.id,
          storeName: s.storeName,
          address: s.address,
          phone: s.phone,
          ownerEmail: s.user.email,
          createdAt: new Date(s.createdAt).toLocaleDateString(),
        })));
      } catch (error) {
        console.error('Failed to fetch stores:', error);
      } finally {
        setLoading(false);
      }    };
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
    <Stack gap={4}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 가맹점 네트워크 관리</Typography>
      </Box>
      <Paper sx={{ height: 600, width: '100%', bgcolor: 'background.paper', p: 2, border: `1px solid ${theme.palette.divider}` }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            pageSizeOptions={[10, 20]}
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': { color: 'text.primary' },
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default' },
            }}
          />
        )}
      </Paper>    </Stack>
  );
};

export default StoreManagement;
