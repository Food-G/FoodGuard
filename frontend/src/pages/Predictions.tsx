import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Typography, Paper, Grid, Stack, useTheme,
  Button, CircularProgress, Alert, Chip,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, LinearProgress,
} from '@mui/material';
import ReactEChart from '../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../services/storeService';
import {
  predictionService,
  PredictionResult,
  PredictionSummary,
} from '../services/predictionService';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const dow = DAY_LABELS[d.getDay()];
  return `${mm}/${dd}(${dow})`;
}

const CHART_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272',
];

const Predictions = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [summary, setSummary] = useState<PredictionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [chartMenu, setChartMenu] = useState<string | null>(null);

  // 테이블 필터
  const [tableDate, setTableDate] = useState<string | null>(null);
  const [tableMenu, setTableMenu] = useState<string | null>(null);

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
      const [preds, sum] = await Promise.all([
        predictionService.getByStore(sid),
        predictionService.getSummary(sid),
      ]);
      setPredictions(preds);
      setSummary(sum);      setChartMenu(null);
      setTableDate(preds[0]?.predictionDate ?? null);
      setTableMenu(null);
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
    } catch (e) {
      // 실패 시 서버는 502 + {"status":"error","message":...} 를 돌려준다
      let detail = '';
      try { detail = JSON.parse((e as Error).message)?.message ?? ''; } catch { /* 본문이 JSON 이 아님 */ }
      setError(`AI 예측 실행 중 오류가 발생했습니다. AI 서비스가 실행 중인지 확인하세요.${detail ? ` (${detail})` : ''}`);
    } finally {
      setTriggering(false);
    }
  };

  const menuNames = Object.keys(summary?.byMenu ?? {});
  const chartDates = summary?.dates?.map(formatDate) ?? [];

  // 차트용 — 선택 메뉴 강조
  const menuColorMap = useMemo(() =>
    Object.fromEntries(menuNames.map((name, i) => [name, CHART_COLORS[i % CHART_COLORS.length]])),
    [menuNames]
  );

  const chartSeries = menuNames.map((name) => {
    const isSelected = chartMenu === name;
    const isFaded = chartMenu !== null && !isSelected;
    return {
      name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: isSelected ? 10 : 6,
      lineStyle: { width: isSelected ? 4 : chartMenu ? 1.5 : 2.5, opacity: isFaded ? 0.25 : 1 },
      itemStyle: { opacity: isFaded ? 0.25 : 1 },
      areaStyle: isSelected ? { opacity: 0.1 } : undefined,
      color: menuColorMap[name],
      data: (summary?.byMenu[name] ?? []).map((p) => p.predictedQty),
      emphasis: { focus: 'series' },
      z: isSelected ? 10 : 1,
    };
  });

  const chartOption = {
    color: CHART_COLORS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross', crossStyle: { color: theme.palette.divider } } },
    legend: { data: menuNames, textStyle: { color: theme.palette.text.secondary }, bottom: 0, type: 'scroll' },
    grid: { top: '8%', left: '3%', right: '4%', bottom: '18%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartDates,
      axisLabel: { color: theme.palette.text.secondary, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.palette.divider } },
      boundaryGap: false,
    },
    yAxis: {
      type: 'value',
      name: '예측 판매량',
      axisLabel: { color: theme.palette.text.secondary },
      splitLine: { lineStyle: { color: theme.palette.divider, type: 'dashed' } },
    },
    series: chartSeries.length > 0 ? chartSeries : [{ name: '예측 없음', type: 'line', data: [] }],
  };

  // 차트 선택 메뉴 요약
  const chartFiltered = chartMenu ? predictions.filter((p) => p.menuName === chartMenu) : predictions;

  // 테이블용 날짜 목록 (중복 제거, 정렬)
  const tableDateList = useMemo(() =>
    [...new Set(predictions.map((p) => p.predictionDate))].sort(),
    [predictions]
  );

  // 테이블 필터링:
  // 메뉴 미선택 → 선택된 날짜의 모든 메뉴 (메뉴명 / 예측량 / 신뢰도)
  // 메뉴 선택 → 선택된 날짜 전체 중 해당 메뉴만 (날짜 / 예측량 / 신뢰도)
  const tablePredictions = useMemo(() => {
    if (tableMenu) {
      return predictions.filter((p) => p.menuName === tableMenu);
    }
    return tableDate ? predictions.filter((p) => p.predictionDate === tableDate) : [];
  }, [predictions, tableDate, tableMenu]);

  const confColor = (c: number) =>
    c >= 70 ? theme.palette.success.main
    : c >= 45 ? theme.palette.warning.main
    : theme.palette.error.main;

  return (
    <Stack gap={4}>
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          size="large"
          onClick={handleTrigger}
          disabled={triggering || !storeId}
          startIcon={triggering ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ minWidth: 160, borderRadius: 2 }}
        >
          {triggering ? '예측 실행 중...' : 'AI 예측 실행'}
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert severity="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {loading && <LinearProgress />}

      <Grid container spacing={3.5}>

        {/* 예측 차트 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight={700}>향후 7일 수요 예측</Typography>
                {/* 학습 판매 데이터는 요일 효과 + ±10% 노이즈로 만든 합성 데이터 (agent-assets/05-data-inventory.md §3) */}
                <Chip label="시범 데이터(합성) 기준" size="small" color="warning" variant="outlined" />
              </Stack>
              <Chip
                label={predictions.length > 0 ? `${predictions.length}건 예측` : '예측 데이터 없음'}
                color={predictions.length > 0 ? 'primary' : 'default'}
                size="small"
              />
            </Stack>

            {menuNames.length > 0 && (
              <Stack direction="row" gap={1} flexWrap="wrap" mb={2.5}>
                <Chip
                  label="전체"
                  onClick={() => setChartMenu(null)}
                  color={chartMenu === null ? 'primary' : 'default'}
                  variant={chartMenu === null ? 'filled' : 'outlined'}
                  sx={{ fontWeight: chartMenu === null ? 700 : 400 }}
                />
                {menuNames.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    onClick={() => setChartMenu(chartMenu === name ? null : name)}
                    variant={chartMenu === name ? 'filled' : 'outlined'}
                    sx={{
                      fontWeight: chartMenu === name ? 700 : 400,
                      ...(chartMenu === name && {
                        bgcolor: menuColorMap[name],
                        color: '#fff',
                        '&:hover': { bgcolor: menuColorMap[name], opacity: 0.9 },
                      }),
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* 선택 메뉴 요약 뱃지 */}
            {chartMenu && chartFiltered.length > 0 && (() => {
              const qtys = chartFiltered.map((p) => p.predictedQty);
              const total = qtys.reduce((s, v) => s + v, 0);
              const max = Math.max(...qtys);
              const avgConf = chartFiltered.reduce((s, p) => s + p.confidence, 0) / chartFiltered.length;
              return (
                <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
                  <Chip label={`7일 합계 ${total}개`} size="small" color="primary" variant="outlined" />
                  <Chip label={`최대 ${max}개`} size="small" color="success" variant="outlined" />
                  <Chip
                    label={`평균 신뢰도 ${avgConf.toFixed(1)}%`}
                    size="small"
                    sx={{ color: confColor(avgConf), borderColor: confColor(avgConf) }}
                    variant="outlined"
                  />
                </Stack>
              );
            })()}

            {predictions.length > 0 ? (
              <ReactEChart option={chartOption} echarts={echarts} sx={{ height: 380 }} />
            ) : (
              <Stack alignItems="center" justifyContent="center" height={300} gap={2}>
                <Typography color="text.secondary" variant="body1">예측 데이터가 없습니다.</Typography>
                <Typography color="text.secondary" variant="body2">
                  "AI 예측 실행" 버튼을 눌러 예측을 시작하세요.
                </Typography>
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* 예측 상세 결과 */}
        {predictions.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" fontWeight={700} mb={2.5}>예측 상세 결과</Typography>

              {/* 날짜 필터 */}
              <Stack gap={1} mb={2}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  날짜
                </Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {tableDateList.map((date) => (
                    <Chip
                      key={date}
                      label={formatDate(date)}
                      onClick={() => { setTableDate(date); setTableMenu(null); }}
                      color={tableDate === date && !tableMenu ? 'primary' : 'default'}
                      variant={tableDate === date && !tableMenu ? 'filled' : 'outlined'}
                      sx={{ fontWeight: tableDate === date && !tableMenu ? 700 : 400 }}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* 메뉴 필터 */}
              <Stack gap={1} mb={3}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  메뉴
                </Typography>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip
                    label="날짜별 전체"
                    onClick={() => setTableMenu(null)}
                    color={tableMenu === null ? 'primary' : 'default'}
                    variant={tableMenu === null ? 'filled' : 'outlined'}
                    sx={{ fontWeight: tableMenu === null ? 700 : 400 }}
                  />
                  {menuNames.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      onClick={() => setTableMenu(tableMenu === name ? null : name)}
                      variant={tableMenu === name ? 'filled' : 'outlined'}
                      sx={{
                        fontWeight: tableMenu === name ? 700 : 400,
                        ...(tableMenu === name && {
                          bgcolor: menuColorMap[name],
                          color: '#fff',
                          '&:hover': { bgcolor: menuColorMap[name], opacity: 0.9 },
                        }),
                      }}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* 메뉴 선택 시 총 수량 요약 */}
              {tableMenu && tablePredictions.length > 0 && (() => {
                const total = tablePredictions.reduce((s, p) => s + p.predictedQty, 0);
                const avgConf = tablePredictions.reduce((s, p) => s + p.confidence, 0) / tablePredictions.length;
                return (
                  <Stack direction="row" gap={1.5} mb={2} flexWrap="wrap">
                    <Chip label={`${tableMenu}`} size="small" sx={{ bgcolor: menuColorMap[tableMenu], color: '#fff', fontWeight: 700 }} />
                    <Chip label={`7일 총 예측 ${total}개`} size="small" color="primary" variant="outlined" />
                    <Chip
                      label={`평균 신뢰도 ${avgConf.toFixed(1)}%`}
                      size="small"
                      sx={{ color: confColor(avgConf), borderColor: confColor(avgConf) }}
                      variant="outlined"
                    />
                  </Stack>
                );
              })()}

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {tableMenu ? <TableCell>날짜</TableCell> : <TableCell>메뉴</TableCell>}
                      <TableCell align="center">예측 판매량</TableCell>
                      <TableCell align="center">모델 신뢰도</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tablePredictions.map((p) => (
                      <TableRow key={p.id} hover>
                        {tableMenu
                          ? <TableCell>{formatDate(p.predictionDate)}</TableCell>
                          : <TableCell><Typography variant="body2" fontWeight={600}>{p.menuName}</Typography></TableCell>
                        }
                        <TableCell align="center">
                          <Typography fontWeight={700} color="primary.main">{p.predictedQty}개</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                            <LinearProgress
                              variant="determinate"
                              value={p.confidence}
                              sx={{
                                width: 80, height: 6, borderRadius: 3,
                                bgcolor: theme.palette.action.hover,
                                '& .MuiLinearProgress-bar': { bgcolor: confColor(p.confidence), borderRadius: 3 },
                              }}
                            />
                            <Typography variant="caption" fontWeight={700} sx={{ color: confColor(p.confidence), minWidth: 40 }}>
                              {p.confidence.toFixed(1)}%
                            </Typography>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* AI 분석 카드 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, bgcolor: 'primary.light', height: 1, border: `1px solid ${theme.palette.primary.main}20` }}>
            <Typography variant="h6" gutterBottom color="primary.dark" fontWeight={700}>
              AI 분석 리포트
              {chartMenu && <Typography component="span" variant="body2" color="primary.dark" sx={{ ml: 1 }}>— {chartMenu}</Typography>}
            </Typography>
            {chartFiltered.length > 0 ? (
              (() => {
                const top = [...chartFiltered].sort((a, b) => b.predictedQty - a.predictedQty)[0];
                const avgConf = chartFiltered.reduce((s, p) => s + p.confidence, 0) / chartFiltered.length;
                const total = chartFiltered.reduce((s, p) => s + p.predictedQty, 0);
                return (
                  <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, lineHeight: 1.9 }}>
                    • 예측 기간 총 판매량: <b>{total}개</b><br />
                    {!chartMenu && <>• 가장 많이 팔릴 메뉴: <b>{top.menuName}</b><br /></>}
                    • 예측 모델 평균 신뢰도: <b>{avgConf.toFixed(1)}%</b><br />
                    • 판매 데이터가 많을수록 예측 정확도가 향상됩니다.
                  </Typography>
                );
              })()
            ) : (
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 2 }}>
                AI 예측을 실행하면 분석 결과가 표시됩니다.
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, bgcolor: 'secondary.light', height: 1, border: `1px solid ${theme.palette.secondary.main}20` }}>
            <Typography variant="h6" gutterBottom color="secondary.dark" fontWeight={700}>순환 경제 행동 지침</Typography>
            {chartFiltered.length > 0 ? (
              (() => {
                const lowConf = chartFiltered.filter((p) => p.confidence < 50);
                return (
                  <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, lineHeight: 1.9 }}>
                    1. 예측 기반 발주로 식자재 폐기를 최소화하세요.<br />
                    2. <b>{lowConf.length}개</b> 항목은 신뢰도 50% 미만 — 재고를 직접 확인하세요.<br />
                    3. 판매 데이터를 꾸준히 입력할수록 AI 정확도가 높아집니다.
                  </Typography>
                );
              })()
            ) : (
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 2 }}>
                예측 결과를 바탕으로 발주 권장 내역이 표시됩니다.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Predictions;
