import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Typography, Badge, Chip, CircularProgress, Button, ButtonBase } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { inventoryService } from '../services/inventoryService';
import { salesService } from '../services/salesService';
import { storeService } from '../services/storeService';
import { MOCK_RESERVATIONS } from './reservationsMock';
import { employeeService, attendanceService, Employee, Attendance } from '../services/employeeService';
import { addDays, hhmm, localDate, minutesBetween, minutesLabel } from '../helpers/date';
import { predictionService, PredictionResult } from '../services/predictionService';

/* ───────── 공통 ───────── */
// 키보드 포커스가 보이도록 (마우스 클릭에는 표시하지 않음)
const FOCUS_SX = {
  '&.Mui-focusVisible, &:focus-visible': { outline: '3px solid #1565C0', outlineOffset: 2 },
};

const CARD_SX = {
  borderRadius: 3,
  bgcolor: '#ffffff',
  border: '1px solid #E8EAF0',
  boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  p: { xs: 2, md: 2.5 },
};

// 아직 API 가 없어 예시 데이터를 쓰는 값 표시 (개발 모드에서만)
const MockChip = () => (
  <Chip label="예시" size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#F1F3F7', color: '#44474E' }} />
);

/* ───────── 기능 타일 ───────── */
interface TileProps {
  title: string;
  desc: string;
  icon: string;
  color: string;
  path: string;
  badge?: number;
}

const LaunchTile = ({ title, desc, icon, color, path, badge }: TileProps) => (
  <ButtonBase
    component={RouterLink}
    to={path}
    title={desc}
    sx={{
      ...FOCUS_SX,
      width: '100%',
      minHeight: 76,
      justifyContent: 'flex-start',
      gap: 1.5,
      px: 2,
      py: 1.5,
      borderRadius: 3,
      bgcolor: '#ffffff',
      border: '1px solid #E8EAF0',
      borderLeft: `4px solid ${color}`,
      textAlign: 'left',
      position: 'relative',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 20px ${color}33` },
    }}
  >
    <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <IconifyIcon icon={icon} width={24} height={24} color={color} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography fontWeight={700} fontSize={15} color="#1A1C1E" lineHeight={1.3}>{title}</Typography>
      <Typography fontSize={13} color="#44474E" lineHeight={1.4} sx={{ mt: 0.3 }}>{desc}</Typography>
    </Box>
    {badge != null && badge > 0 && (
      <Badge badgeContent={badge} color="error" sx={{ position: 'absolute', top: 14, right: 14 }} />
    )}
  </ButtonBase>
);

const TILE_GRID_SX = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 };

// POS 는 테이블 주문·결제(결제 시 판매가 자동 기록), 판매 입력은 판매량 직접 입력·휴무/품절 기록이라 별도 유지
const OWNER_GROUPS: { title: string; tiles: TileProps[] }[] = [
  {
    title: '운영',
    tiles: [
      { title: 'POS 시스템', desc: '테이블 주문·결제 (판매 자동 기록)', icon: 'mingcute:card-pay-line', color: '#D32F2F', path: '/pos' },
      { title: '판매 입력', desc: '판매량 직접 입력·휴무/품절 기록', icon: 'mingcute:chart-line-line', color: '#00796B', path: '/sales' },
      { title: '예약 현황', desc: '오늘·예정 예약 확인', icon: 'mingcute:calendar-2-line', color: '#1976D2', path: '/reservations' },
      { title: '메뉴 관리', desc: '메뉴·가격·레시피 관리', icon: 'mingcute:fork-spoon-line', color: '#0277BD', path: '/menus' },
      { title: '직원 관리', desc: '명단·근무 스케줄·주휴수당', icon: 'mingcute:user-2-line', color: '#5E35B1', path: '/staff' },
      { title: '출퇴근', desc: '직원 PIN 출퇴근 기록', icon: 'mingcute:time-line', color: '#00695C', path: '/clock' },
    ],
  },
  {
    title: '재고',
    tiles: [
      { title: '재고 현황', desc: '식자재 수량·유통기한 확인', icon: 'mingcute:inventory-line', color: '#2E7D32', path: '/inventory' },
      { title: '식자재 발주', desc: 'AI 추천량으로 발주', icon: 'mingcute:truck-line', color: '#1565C0', path: '/orders' },
      { title: '폐기예측 & 기부', desc: '폐기 임박 재고 할인·기부', icon: 'mingcute:heart-fill', color: '#C62828', path: '/waste-prediction' },
    ],
  },
  {
    title: '분석·AI',
    tiles: [
      { title: '매출 통계', desc: '기간별 매출·판매 추이', icon: 'mingcute:chart-bar-fill', color: '#E65100', path: '/sales-stats' },
      { title: 'AI 수요 예측', desc: '7일 메뉴별 판매 예측', icon: 'mingcute:brain-fill', color: '#7B1FA2', path: '/predictions' },
      { title: 'AI 운영 비서', desc: '매장 운영 질문·대화', icon: 'mingcute:chat-3-line', color: '#3949AB', path: '/assistant' },
    ],
  },
];

const ADMIN_TILES: TileProps[] = [
  { title: '발주 관리', desc: '가맹점 발주 승인·처리', icon: 'mingcute:truck-line', color: '#1976D2', path: '/admin/orders' },
  { title: '가맹점 관리', desc: '가맹점 목록·위치 관리', icon: 'mingcute:grid-fill', color: '#2E7D32', path: '/admin/stores' },
  { title: '통계 분석', desc: '매출·폐기·추천 적용률', icon: 'mingcute:chart-bar-fill', color: '#7B1FA2', path: '/admin/stats' },
];

/* ───────── 오늘 요약 KPI ───────── */
// 예약처럼 아직 API 가 없는 값은 개발 모드에서만 예시 데이터로 보여주고, 배포 화면에서는 '데이터 없음'
const IS_DEV = import.meta.env.DEV;

interface KpiProps {
  label: string;
  icon: string;
  color: string;
  path: string;
  // null: 불러오는 중, undefined: 데이터 없음(조회 실패·API 없음)
  value: number | null | undefined;
  unit: string;
  format?: (n: number) => string;
  // 값이 0 일 때 숫자 대신 보여줄 문구와 바로가기
  empty: { text: string; action?: string; path?: string; good?: boolean };
  prev?: number | null;  // 어제 값 (있을 때만 증감 표시)
  mock?: boolean;
}

// 어제가 0 이거나 없으면 % 를 낼 수 없으니 표시하지 않는다
const Delta = ({ value, prev }: { value: number; prev?: number | null }) => {
  if (prev == null || prev <= 0 || value <= 0) return null;
  const pct = Math.round(((value - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <Typography fontSize={12} fontWeight={700} color={up ? '#1B5E20' : '#B71C1C'}>
      {pct === 0 ? '어제와 같음' : `${up ? '▲' : '▼'} ${Math.abs(pct)}% 어제 대비`}
    </Typography>
  );
};

const KpiCard = ({ label, icon, color, path, value, unit, format, empty, prev, mock }: KpiProps) => {
  const isEmpty = value === 0;
  return (
    <ButtonBase
      component={RouterLink}
      to={isEmpty && empty.path ? empty.path : path}
      sx={{
        ...CARD_SX,
        ...FOCUS_SX,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 0.8,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 10px 22px ${color}33` },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
        <IconifyIcon icon={icon} width={20} height={20} color={color} />
        <Typography fontSize={14} fontWeight={600} color="#44474E">{label}</Typography>
        {mock && IS_DEV && <Box sx={{ ml: 'auto' }}><MockChip /></Box>}
      </Box>
      {value === null ? (
        <Typography fontSize={15} color="#44474E">불러오는 중…</Typography>
      ) : value === undefined ? (
        <Typography fontSize={15} fontWeight={600} color="#5F6368">데이터 없음</Typography>
      ) : isEmpty ? (
        // 한글이 글자 단위로 끊기지 않게 keep-all, 바로가기는 다음 줄
        <Typography fontSize={14} fontWeight={600} color={empty.good ? '#1B5E20' : '#44474E'} lineHeight={1.45} sx={{ wordBreak: 'keep-all' }}>
          {empty.good && '✓ '}{empty.text}
          {empty.action && <Box component="span" sx={{ display: 'block', color: '#1565C0', whiteSpace: 'nowrap' }}>{empty.action} →</Box>}
        </Typography>
      ) : (
        <>
          <Typography fontSize={{ xs: 26, md: 30 }} fontWeight={800} color="#1A1C1E" lineHeight={1.1}>
            {(format ?? ((n: number) => n.toLocaleString()))(value)}
            <Typography component="span" fontSize={15} fontWeight={600} color="#44474E" sx={{ ml: 0.5 }}>{unit}</Typography>
          </Typography>
          <Delta value={value} prev={prev} />
        </>
      )}
    </ButtonBase>
  );
};

/* ───────── 재고 경고 ───────── */
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
// 재고에 품목별 기준 수량 컬럼이 없어 기존 판정 기준(1 이하)을 기준 수량으로 쓴다
const LOW_STOCK_QTY = 1;
const EXPIRY_SOON_DAYS = 3;

// 유통기한(날짜만 저장됨)이 끝나는 시각 = 그날 24:00
const expiryEnd = (expiryDate: string) => {
  const [y, m, d] = expiryDate.split('-').map(Number);
  return new Date(y, m - 1, d + 1);
};

const expiryDateLabel = (expiryDate: string) => {
  const [y, m, d] = expiryDate.split('-').map(Number);
  return `${m}/${String(d).padStart(2, '0')}(${WEEKDAY[new Date(y, m - 1, d).getDay()]})`;
};

const remainingLabel = (expiryDate: string, now: Date) => {
  const ms = expiryEnd(expiryDate).getTime() - now.getTime();
  if (ms <= 0) return '기한 지남';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간 남음`;
  return hours > 0 ? `${hours}시간 ${minutes}분 남음` : `${minutes}분 남음`;
};

const qtyOf = (item: any) => Number(item.currentQty ?? item.quantity ?? 0);
const isLowStock = (item: any) => qtyOf(item) <= LOW_STOCK_QTY;
const isExpiringSoon = (item: any) => {
  if (!item.expiryDate) return false;
  const soon = new Date(); soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
  return expiryEnd(item.expiryDate) <= soon;
};

const InventoryAlertWidget = ({ items, loading }: { items: any[]; loading: boolean }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const alerts = items.filter((item) => isLowStock(item) || isExpiringSoon(item))
    // 마감이 가까운 순, 유통기한 없는 재고 부족 항목은 뒤로
    .sort((a, b) =>
      (a.expiryDate ? expiryEnd(a.expiryDate).getTime() : Infinity) -
      (b.expiryDate ? expiryEnd(b.expiryDate).getTime() : Infinity));
  const shown = alerts.slice(0, 5);

  const header = (right: React.ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
      <IconifyIcon icon="mingcute:warning-fill" width={22} height={22} color="#E65100" />
      <Typography fontWeight={700} fontSize={16} color="#1A1C1E">재고 경고 알림</Typography>
      <Box sx={{ ml: 'auto' }}>{right}</Box>
    </Box>
  );

  // 경고가 없으면 한 줄로 간단히, 카드 전체가 재고 현황 바로가기
  if (loading || alerts.length === 0) {
    return (
      <ButtonBase component={RouterLink} to="/inventory" sx={{ ...CARD_SX, ...FOCUS_SX, py: 1.5, borderTop: '3px solid #FF9800', textAlign: 'left' }}>
        {header(loading ? (
          <CircularProgress size={16} sx={{ color: '#FF9800' }} />
        ) : (
          <Chip
            icon={<IconifyIcon icon="mingcute:check-circle-fill" width={14} height={14} color="#1B7F5B" />}
            label="경고 없음" size="small"
            sx={{ bgcolor: '#F1F8F5', color: '#1B7F5B', fontWeight: 700, fontSize: 12, border: '1px solid #C8E6D5' }}
          />
        ))}
      </ButtonBase>
    );
  }

  return (
    <Box sx={{ ...CARD_SX, borderTop: '3px solid #FF9800' }}>
      {header(
        <Button component={RouterLink} to="/inventory" variant="text" size="small" sx={{ ...FOCUS_SX, fontWeight: 700 }}>
          전체 {alerts.length}건 보기
        </Button>,
      )}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {shown.map((item, i) => {
          const end = item.expiryDate ? expiryEnd(item.expiryDate) : null;
          const expired = end != null && end <= now;
          const low = isLowStock(item);
          return (
            <Box component="li" key={item.id ?? i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: 2, bgcolor: expired ? '#FFEBEE' : '#FFF8F0', border: `1px solid ${expired ? '#FFCDD2' : '#FFE0B2'}` }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontSize={15} color="#1A1C1E" fontWeight={700} noWrap>{item.ingredient?.name ?? '식자재'}</Typography>
                <Typography fontSize={13} color="#44474E">
                  현재 <b style={{ color: low ? '#C62828' : undefined }}>{qtyOf(item)}{item.unit}</b> · 기준 {LOW_STOCK_QTY}{item.unit}
                </Typography>
                {item.expiryDate && (
                  <Typography fontSize={13} color={expired ? '#B71C1C' : '#B53D00'} fontWeight={600}>
                    유통기한 {expiryDateLabel(item.expiryDate)} · {remainingLabel(item.expiryDate, now)}
                  </Typography>
                )}
              </Box>
              <Button
                variant="outlined" size="small"
                onClick={() => navigate('/orders')}
                startIcon={<IconifyIcon icon="mingcute:truck-line" width={16} height={16} />}
                sx={{ ...FOCUS_SX, flexShrink: 0, fontWeight: 700, bgcolor: '#fff' }}
              >
                발주
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/* ───────── 직원 출퇴근 (오늘 출퇴근 기록) ───────── */
type EmpStatus = 'working' | 'off' | 'absent';

const STATUS_CHIP: Record<EmpStatus, { label: string; bg: string; color: string; border: string }> = {
  working: { label: '근무중', bg: '#E8F5E9', color: '#1B5E20', border: '#A5D6A7' },
  off:     { label: '퇴근',   bg: '#EEF4FF', color: '#0D47A1', border: '#BBCFFF' },
  absent:  { label: '미출근', bg: '#F1F3F5', color: '#5F6368', border: '#DADCE0' },
};

// 근무중 직원이 먼저 보이게
const STATUS_ORDER: Record<EmpStatus, number> = { working: 0, off: 1, absent: 2 };

const StatusChip = ({ status }: { status: EmpStatus }) => {
  const s = STATUS_CHIP[status];
  return <Chip label={s.label} size="small" sx={{ height: 22, fontSize: 12, fontWeight: 700, bgcolor: s.bg, color: s.color, border: `1px solid ${s.border}` }} />;
};

const EmployeeWidget = ({ storeId }: { storeId: number | null }) => {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const now = new Date();

  useEffect(() => {
    if (!storeId) return;
    const load = () => {
      const today = localDate(new Date());
      employeeService.getByStore(storeId).then(setEmployees).catch(() => {});
      attendanceService.getByStore(storeId, today, today).then(setRecords).catch(() => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [storeId]);

  // 재직 직원마다 오늘 첫 출근·마지막 퇴근·근무 시간(근무 중이면 지금까지)
  const rows = (employees ?? []).filter((e) => e.active).map((e) => {
    const mine = records.filter((r) => r.employeeId === e.id);
    const status: EmpStatus = mine.length === 0 ? 'absent' : mine.some((r) => !r.clockOut) ? 'working' : 'off';
    const minutes = mine.reduce((s, r) => s + minutesBetween(r.clockIn, r.clockOut ?? now), 0);
    return { e, status, in: mine[0]?.clockIn, out: status === 'off' ? mine[mine.length - 1].clockOut : null, minutes };
  }).sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  const onCount = rows.filter((r) => r.status === 'working').length;

  return (
    <ButtonBase
      component={RouterLink}
      to="/staff"
      aria-label="직원 출퇴근 현황, 직원 관리로 이동"
      sx={{ ...CARD_SX, ...FOCUS_SX, borderTop: '3px solid #1976D2', flexDirection: 'column', alignItems: 'stretch', textAlign: 'left' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <IconifyIcon icon="mingcute:user-2-fill" width={22} height={22} color="#1976D2" />
        <Typography fontWeight={700} fontSize={16} color="#1A1C1E">직원 출퇴근 현황</Typography>
        <Typography fontSize={13} fontWeight={700} color="#1B5E20" sx={{ ml: 'auto' }}>근무중 {onCount}명</Typography>
      </Box>
      {employees == null ? (
        <Typography fontSize={14} color="#44474E">{storeId ? '불러오는 중…' : '-'}</Typography>
      ) : rows.length === 0 ? (
        <Typography fontSize={14} color="#44474E">등록된 직원이 없습니다. 눌러서 직원을 등록하세요.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
          {rows.map(({ e, status, in: clockIn, out, minutes }) => (
            <Box key={e.id} sx={{ px: 1.5, py: 1, borderRadius: 2, bgcolor: status === 'absent' ? '#FAFAFA' : '#F7F9FF', border: '1px solid #E8EAF0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, justifyContent: 'space-between' }}>
                <Typography fontSize={14} fontWeight={700} color="#1A1C1E" noWrap>{e.name}</Typography>
                <StatusChip status={status} />
              </Box>
              <Typography fontSize={13} color="#44474E" sx={{ mt: 0.3 }}>
                {status === 'absent' ? '출근 기록 없음' : `${hhmm(clockIn)} ~ ${out ? hhmm(out) : '근무중'}`}
              </Typography>
              {status !== 'absent' && <Typography fontSize={12} color="#44474E">{minutesLabel(minutes)}</Typography>}
            </Box>
          ))}
        </Box>
      )}
    </ButtonBase>
  );
};

/* ───────── 오른쪽 요약 카드 (오늘 예약 · AI 예측 · 폐기 임박) ───────── */
const SideCard = ({ icon, color, title, more, mock, children }: { icon: string; color: string; title: string; more: { label: string; path: string }; mock?: boolean; children: React.ReactNode }) => (
  <Box sx={{ ...CARD_SX, borderTop: `3px solid ${color}` }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}>
      <IconifyIcon icon={icon} width={22} height={22} color={color} />
      <Typography fontWeight={700} fontSize={16} color="#1A1C1E">{title}</Typography>
      {mock && IS_DEV && <MockChip />}
      <Button component={RouterLink} to={more.path} variant="text" size="small" sx={{ ...FOCUS_SX, ml: 'auto', fontWeight: 700 }}>
        {more.label}
      </Button>
    </Box>
    {children}
  </Box>
);

const EmptyLine = ({ text }: { text: string }) => (
  <Typography fontSize={14} color="#5F6368" sx={{ py: 0.5 }}>{text}</Typography>
);

const ListRow = ({ left, main, right }: { left: React.ReactNode; main: React.ReactNode; right?: React.ReactNode }) => (
  <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.9, borderTop: '1px solid #F0F1F4', '&:first-of-type': { borderTop: 0 } }}>
    <Typography fontSize={14} fontWeight={800} color="#1A1C1E" sx={{ minWidth: 44 }}>{left}</Typography>
    <Box sx={{ flex: 1, minWidth: 0 }}>{main}</Box>
    {right && <Typography fontSize={13} fontWeight={700} color="#44474E" sx={{ whiteSpace: 'nowrap' }}>{right}</Typography>}
  </Box>
);

const LIST_SX = { listStyle: 'none', m: 0, p: 0 };

// 예약 API 가 없어 개발 모드에서만 예시 데이터를 보여준다
const ReservationWidget = () => {
  const today = localDate(new Date());
  const list = IS_DEV
    ? MOCK_RESERVATIONS.filter((r) => r.date === today && r.status !== '취소').sort((a, b) => a.time.localeCompare(b.time))
    : null;
  return (
    <SideCard icon="mingcute:calendar-2-line" color="#1976D2" title="오늘 예약" more={{ label: '전체 보기', path: '/reservations' }} mock>
      {list == null ? <EmptyLine text="데이터 없음 (예약 기능 준비 중)" />
        : list.length === 0 ? <EmptyLine text="오늘 예약이 없어요" />
        : (
          <Box component="ul" sx={LIST_SX}>
            {list.slice(0, 5).map((r) => (
              <ListRow key={r.id} left={r.time} right={`${r.guests}명`}
                main={<Typography fontSize={14} fontWeight={600} noWrap>{r.name}{r.note && <Typography component="span" fontSize={12} color="#5F6368"> · {r.note}</Typography>}</Typography>} />
            ))}
          </Box>
        )}
    </SideCard>
  );
};

// 내일 예측 판매량이 많은 메뉴 TOP 3 (PREDICTION_RESULT)
const ForecastWidget = ({ storeId }: { storeId: number | null }) => {
  const [rows, setRows] = useState<PredictionResult[] | null | undefined>(null);
  const tomorrow = localDate(addDays(new Date(), 1));

  useEffect(() => {
    if (!storeId) return;
    predictionService.getByStore(storeId)
      .then((all) => setRows((all ?? []).filter((p) => p.predictionDate === tomorrow).sort((a, b) => b.predictedQty - a.predictedQty).slice(0, 3)))
      .catch(() => setRows(undefined));
  }, [storeId, tomorrow]);

  return (
    <SideCard icon="mingcute:brain-fill" color="#7B1FA2" title="내일 판매 예측 TOP 3" more={{ label: '예측 보기', path: '/predictions' }}>
      {rows === null ? <EmptyLine text={storeId ? '불러오는 중…' : '데이터 없음'} />
        : rows === undefined ? <EmptyLine text="데이터 없음" />
        : rows.length === 0 ? <EmptyLine text="내일 예측이 아직 없어요 · AI 수요 예측에서 실행하세요" />
        : (
          <Box component="ul" sx={LIST_SX}>
            {rows.map((p, i) => (
              <ListRow key={p.id} left={`${i + 1}위`} right={`${Math.round(p.predictedQty)}개 예상`}
                main={<Typography fontSize={14} fontWeight={600} noWrap>{p.menuName}</Typography>} />
            ))}
          </Box>
        )}
    </SideCard>
  );
};

// 유통기한이 가까운 재고 TOP 3 (재고 경고 카드와 같은 기준: 3일 이내·기한 지남)
const ExpiringWidget = ({ items, state }: { items: any[]; state: 'loading' | 'error' | 'ok' }) => {
  const now = new Date();
  const top = items.filter(isExpiringSoon)
    .sort((a, b) => expiryEnd(a.expiryDate).getTime() - expiryEnd(b.expiryDate).getTime())
    .slice(0, 3);
  return (
    <SideCard icon="mingcute:time-line" color="#B53D00" title="폐기 임박 TOP 3" more={{ label: '폐기예측 & 기부', path: '/waste-prediction' }}>
      {state === 'loading' ? <EmptyLine text="불러오는 중…" />
        : state === 'error' ? <EmptyLine text="데이터 없음" />
        : top.length === 0 ? <EmptyLine text="✓ 폐기 임박 품목이 없어요" />
        : (
          <Box component="ul" sx={LIST_SX}>
            {top.map((item, i) => (
              <ListRow key={item.id ?? i} left={`${i + 1}`} right={remainingLabel(item.expiryDate, now)}
                main={<Typography fontSize={14} fontWeight={600} noWrap>{item.ingredient?.name ?? '식자재'} <Typography component="span" fontSize={12} color="#5F6368">{qtyOf(item)}{item.unit}</Typography></Typography>} />
            ))}
          </Box>
        )}
    </SideCard>
  );
};

/* ───────── Dashboard ───────── */
// 1024px 이하(태블릿)는 오른쪽 열을 아래로, KPI 는 2~3열로 (테마 lg 가 1024 라 직접 지정)
const WIDE = '@media (min-width: 1025px)';

interface TodaySummary { quantity: number; revenue: number; prevQuantity: number; prevRevenue: number }

const Dashboard = ({ user }: any) => {
  const role = user?.role || 'OWNER';
  const [storeId, setStoreId] = useState<number | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [invState, setInvState] = useState<'loading' | 'error' | 'ok'>('loading');
  // null: 불러오는 중, undefined: 조회 실패
  const [summary, setSummary] = useState<TodaySummary | null | undefined>(null);

  useEffect(() => {
    if (user?.id && role === 'OWNER') {
      storeService.getMyStores(user.id)
        .then((stores: any[]) => {
          if (stores.length > 0) setStoreId(stores[0].id);
          else { setInvState('error'); setSummary(undefined); }
        })
        .catch(() => { setInvState('error'); setSummary(undefined); });
    }
  }, [user?.id, role]);

  useEffect(() => {
    if (!storeId) return;
    const load = () => {
      // 갱신 실패 시 직전 값 유지, 처음부터 실패면 '데이터 없음'
      inventoryService.getByStore(storeId)
        .then((items: any[]) => { setInventory(items ?? []); setInvState('ok'); })
        .catch(() => setInvState((s) => (s === 'ok' ? s : 'error')));
      salesService.getTodaySummary(storeId)
        .then((s: TodaySummary) => setSummary(s))
        .catch(() => setSummary((s) => (s ? s : undefined)));
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [storeId]);

  if (role === 'HQ_ADMIN') {
    return (
      <Box sx={{ ...TILE_GRID_SX, p: { xs: 0, md: 2 } }}>
        {ADMIN_TILES.map((tile) => <LaunchTile key={tile.path} {...tile} />)}
      </Box>
    );
  }

  const today = localDate(new Date());
  const invValue = (n: number) => (invState === 'loading' ? null : invState === 'error' ? undefined : n);
  const noSales = { text: '아직 판매 기록이 없어요', action: '판매 입력하기', path: '/sales' };

  const kpis: KpiProps[] = [
    { label: '오늘 매출', icon: 'mingcute:coin-line', color: '#E65100', path: '/sales-stats', unit: '원',
      value: summary === null ? null : summary?.revenue, prev: summary?.prevRevenue, empty: noSales },
    { label: '오늘 판매 건수', icon: 'mingcute:shopping-bag-1-line', color: '#00796B', path: '/sales', unit: '건',
      value: summary === null ? null : summary?.quantity, prev: summary?.prevQuantity, empty: noSales },
    { label: '오늘 예약', icon: 'mingcute:calendar-2-line', color: '#1976D2', path: '/reservations', unit: '건', mock: true,
      value: IS_DEV ? MOCK_RESERVATIONS.filter((r) => r.date === today && r.status === '예약중').length : undefined,
      empty: { text: '오늘 예약이 없어요' } },
    { label: '재고 부족 품목', icon: 'mingcute:inventory-line', color: '#C62828', path: '/inventory', unit: '개',
      value: invValue(inventory.filter(isLowStock).length), empty: { text: '부족한 재고가 없어요', good: true } },
    { label: '폐기 임박 품목', icon: 'mingcute:time-line', color: '#B53D00', path: '/waste-prediction', unit: '개',
      value: invValue(inventory.filter(isExpiringSoon).length), empty: { text: '폐기 임박 품목이 없어요', good: true } },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: { xs: 0, md: 1 } }}>
      {/* 오늘 요약 + 주요 버튼 */}
      <Box component="section" aria-label="오늘 요약">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography component="h2" fontSize={20} fontWeight={800} color="#1A1C1E">오늘 요약</Typography>
          <Button
            component={RouterLink} to="/orders" variant="contained" size="large"
            startIcon={<IconifyIcon icon="mingcute:truck-line" width={20} height={20} />}
            sx={{ ...FOCUS_SX, fontWeight: 700, fontSize: 15, borderRadius: 2.5, px: 3 }}
          >
            식자재 발주
          </Button>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, [WIDE]: { gridTemplateColumns: 'repeat(5, 1fr)' }, gap: 1.5 }}>
          {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
        </Box>
      </Box>

      {/* 좌: 기능 타일 그룹 / 우: 위젯 (1024px 이하는 한 열) */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', [WIDE]: { gridTemplateColumns: 'minmax(0, 3fr) minmax(340px, 2fr)' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {OWNER_GROUPS.map((group) => (
            <Box component="section" key={group.title} aria-label={group.title}>
              <Typography component="h3" fontSize={15} fontWeight={700} color="#44474E" sx={{ mb: 1 }}>{group.title}</Typography>
              <Box sx={TILE_GRID_SX}>
                {group.tiles.map((tile) => <LaunchTile key={tile.path} {...tile} />)}
              </Box>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <InventoryAlertWidget items={inventory} loading={invState === 'loading'} />
          <EmployeeWidget storeId={storeId} />
          <ReservationWidget />
          <ForecastWidget storeId={storeId} />
          <ExpiringWidget items={inventory} state={invState} />
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
