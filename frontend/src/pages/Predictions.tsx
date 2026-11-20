import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Typography, Paper, Stack, Box, useTheme,
  Button, CircularProgress, Alert, Chip, LinearProgress,
} from '@mui/material';
import ReactEChart from '../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../services/storeService';
import {
  predictionService,
  PredictionResult,
} from '../services/predictionService';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dow = DAY_LABELS[d.getDay()];
  return `${mm}/${dd}(${dow})`;
}

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

const Predictions = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 메뉴(전체 또는 하나)와 날짜를 고르면 차트·목록이 함께 바뀐다
  const [menu, setMenu] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length > 0) setStoreId(stores[0].id);
    }).catch(console.error);
  }, [user]);

  const loadData = useCallback(async (sid: number) => {
    setLoading(true);
    setError('');
    try {
      const preds = await predictionService.getByStore(sid);
      setPredictions(preds);
      setMenu(null);
      setDate(preds[0]?.predictionDate ?? null);
    } catch {
      setError('예측 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeId) loadData(storeId);
  }, [storeId, loadData]);

  const handleTrigger = async () => {
    if (!storeId) return;
    setTriggering(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await predictionService.trigger(storeId);
      setSuccessMsg(res.status === 'success' ? 'AI 예측이 완료되었습니다.' : res.message);
      await loadData(storeId);
    } catch {
      setError('AI 예측 실행 중 오류가 발생했습니다. AI 서비스가 실행 중인지 확인하세요.');
    } finally {
      setTriggering(false);
    }
  };

  const menuNames = useMemo(() => [...new Set(predictions.map((p) => p.menuName))], [predictions]);
  const dates = useMemo(() => [...new Set(predictions.map((p) => p.predictionDate))].sort(), [predictions]);
  const scoped = menu ? predictions.filter((p) => p.menuName === menu) : predictions;
  const dailyTotals = dates.map((d) => sum(scoped.filter((p) => p.predictionDate === d).map((p) => p.predictedQty)));

  // 메뉴 전체: 고른 날의 메뉴별 / 메뉴 하나: 그 메뉴의 날짜별
  const rows = menu ? scoped : predictions.filter((p) => p.predictionDate === date);

  const total = sum(scoped.map((p) => p.predictedQty));
  const totalRecommended = sum(scoped.map((p) => p.recommendedOrderQty));
  const avgConf = scoped.length ? sum(scoped.map((p) => p.confidence)) / scoped.length : 0;
  const lowConf = scoped.filter((p) => p.confidence < 50).length;
  const topMenu = menuNames
    .map((name) => ({ name, qty: sum(predictions.filter((p) => p.menuName === name).map((p) => p.predictedQty)) }))
    .sort((a, b) => b.qty - a.qty)[0];

  const confColor = (c: number) =>
    c >= 70 ? theme.palette.success.main
    : c >= 45 ? theme.palette.warning.main
    : theme.palette.error.main;

  // 고른 날만 진하게 (토스 막대)
  const chartOption = {
    grid: { left: 8, right: 8, top: 36, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => `${v.toLocaleString()}개` },
    xAxis: {
      type: 'category', data: dates.map(formatDate),
      axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: theme.palette.text.secondary },
    },
    yAxis: { type: 'value', show: false },
    series: [{
      type: 'bar', barWidth: '46%', cursor: 'pointer',
      data: dailyTotals.map((v, i) => {
        const on = dates[i] === date;
        return {
          value: v,
          itemStyle: { color: on ? theme.palette.primary.main : theme.palette.divider, borderRadius: 8 },
          label: { show: on, position: 'top', color: theme.palette.primary.main, fontWeight: 700, formatter: `${v.toLocaleString()}개` },
        };
      }),
    }],
  };

  const pill = (label: string, selected: boolean, onClick: () => void) => (
    <Chip
      key={label} label={label} onClick={onClick}
      sx={{
        height: 34, borderRadius: 999, border: 'none', fontWeight: selected ? 700 : 500,
        bgcolor: selected ? 'text.primary' : 'background.default',
        color: selected ? 'common.white' : 'text.secondary',
        '&:hover': { bgcolor: selected ? 'text.primary' : 'divider' },
        '& .MuiChip-label': { fontSize: 14 },
      }}
    />
  );

  const statRow = (label: string, value: React.ReactNode) => (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 3, borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' } }}>
      <Typography color="text.secondary" fontSize={15}>{label}</Typography>
      <Typography fontWeight={700} fontSize={15}>{value}</Typography>
    </Stack>
  );

  return (
    <Stack gap={5}>
      {/* 큰 숫자 요약 + 실행 버튼 */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} gap={3}>
        <Box>
          <Typography color="text.secondary" fontSize={15} mb={1}>
            다음 7일 예상 판매{menu ? ` · ${menu}` : ''}
          </Typography>
          <Typography fontSize={{ xs: 30, md: 36 }} fontWeight={700} lineHeight={1.2}>
            {predictions.length ? `${total.toLocaleString()}개` : '-'}
          </Typography>
          {predictions.length > 0 && (
            <Typography fontSize={15} mt={1} sx={{ color: confColor(avgConf) }}>
              평균 신뢰도 {avgConf.toFixed(1)}%
            </Typography>
          )}
        </Box>
        <Button
          onClick={handleTrigger}
          disabled={triggering || !storeId}
          startIcon={triggering ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ minWidth: 160 }}
        >
          {triggering ? '예측 실행 중...' : 'AI 예측 실행'}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {loading && <LinearProgress />}

      <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Stack gap={5}>
          {/* 날짜별 막대: 막대를 누르면 그날 상세 */}
          <Paper sx={{ p: 5 }}>
            {menuNames.length > 0 && (
              <Stack direction="row" gap={1} flexWrap="wrap" mb={3}>
                {pill('전체', menu === null, () => setMenu(null))}
                {menuNames.map((name) => pill(name, menu === name, () => setMenu(menu === name ? null : name)))}
              </Stack>
            )}
            {predictions.length > 0 ? (
              <ReactEChart
                option={chartOption} echarts={echarts} sx={{ height: 300 }}
                onEvents={{ click: (p: { dataIndex: number }) => setDate(dates[p.dataIndex]) }}
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" height={260} gap={1.5}>
                <Typography color="text.secondary">예측 데이터가 없습니다.</Typography>
                <Typography color="text.secondary" variant="body2">"AI 예측 실행" 버튼을 눌러 예측을 시작하세요.</Typography>
              </Stack>
            )}
          </Paper>

          {/* 상세 목록 (토스 목록 행) */}
          {predictions.length > 0 && (
            <Paper sx={{ p: 5 }}>
              <Typography fontSize={18} fontWeight={700} mb={2}>
                {menu ? `${menu} 날짜별 예측` : `${date ? formatDate(date) : ''} 메뉴별 예측`}
              </Typography>
              {rows.map((p) => (
                <Stack
                  key={p.id} direction="row" alignItems="center" gap={3}
                  onClick={() => (menu ? setDate(p.predictionDate) : setMenu(p.menuName))}
                  sx={{
                    py: 3, cursor: 'pointer', borderTop: `1px solid ${theme.palette.divider}`, '&:first-of-type': { borderTop: 'none' },
                    bgcolor: menu && p.predictionDate === date ? 'primary.light' : 'transparent', borderRadius: 2, px: 2, mx: -2,
                  }}
                >
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Typography fontWeight={700} color="text.secondary" fontSize={15}>
                      {menu ? DAY_LABELS[new Date(p.predictionDate).getDay()] : p.menuName.slice(0, 1)}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize={15} noWrap>{menu ? formatDate(p.predictionDate) : p.menuName}</Typography>
                    <Typography variant="body2" color="text.secondary">추천 발주 {p.recommendedOrderQty}개 (안전재고 포함)</Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography fontWeight={700} fontSize={16}>{p.predictedQty}개</Typography>
                    <Typography variant="body2" sx={{ color: confColor(p.confidence) }}>신뢰도 {p.confidence.toFixed(1)}%</Typography>
                  </Box>
                </Stack>
              ))}
            </Paper>
          )}
        </Stack>

        {/* AI 분석 요약 (Square 오른쪽 목록) */}
        <Paper sx={{ p: 5 }}>
          <Typography fontSize={18} fontWeight={700} mb={1}>AI 분석{menu ? ` · ${menu}` : ''}</Typography>
          {scoped.length > 0 ? (
            <>
              {statRow('예측 기간 총 판매량', `${total.toLocaleString()}개`)}
              {statRow('추천 발주량 합계 (안전재고 포함)', `${totalRecommended.toLocaleString()}개`)}
              {!menu && topMenu && statRow('가장 많이 팔릴 메뉴', topMenu.name)}
              {statRow('평균 신뢰도', <Box component="span" sx={{ color: confColor(avgConf) }}>{avgConf.toFixed(1)}%</Box>)}
              {statRow('신뢰도 50% 미만', `${lowConf}건`)}
              <Typography variant="body2" color="text.secondary" mt={3}>
                {lowConf > 0 ? '신뢰도가 낮은 항목은 재고를 직접 확인하세요. ' : ''}판매 데이터를 꾸준히 입력할수록 예측이 정확해집니다.
              </Typography>
            </>
          ) : (
            <Typography color="text.secondary" mt={2}>AI 예측을 실행하면 분석 결과가 표시됩니다.</Typography>
          )}
        </Paper>
      </Box>
    </Stack>
  );
};

export default Predictions;
