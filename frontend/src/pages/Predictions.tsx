import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Paper, Grid, Stack, useTheme,
  Button, CircularProgress, Alert, Chip, Box,
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

const Predictions = ({ user }: any) => {
  const theme = useTheme();
  const [storeId, setStoreId] = useState<number | null>(null);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [summary, setSummary] = useState<PredictionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      setSummary(sum);
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

  // 차트 데이터 생성 (메뉴별 예측량 합계)
  const chartDates = summary?.dates?.map(formatDate) ?? [];
  const menuNames = Object.keys(summary?.byMenu ?? {});

  const chartSeries = menuNames.map((name) => ({
    name,
    type: 'bar',
    stack: 'total',
    data: (summary?.byMenu[name] ?? []).map((p) => p.predictedQty),
    emphasis: { focus: 'series' },
  }));

  const chartOption = {
    color: [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      '#4caf50', '#ff9800', '#9c27b0', '#00bcd4',
    ],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: {
      data: menuNames,
      textStyle: { color: theme.palette.text.secondary },
      bottom: 0,
      type: 'scroll',
    },
    grid: { top: '10%', left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: {
      type: 'category',
      data: chartDates,
      axisLabel: { color: theme.palette.text.secondary, fontSize: 11 },
      axisLine: { lineStyle: { color: theme.palette.divider } },
    },
    yAxis: {
      type: 'value',
      name: '예측 판매량',
      axisLabel: { color: theme.palette.text.secondary },
      splitLine: { lineStyle: { color: theme.palette.divider, type: 'dashed' } },
    },
    series: chartSeries.length > 0 ? chartSeries : [
      {
        name: '예측 없음',
        type: 'bar',
        data: [],
      },
    ],
  };

  // 신뢰도 색상
  const confColor = (c: number) =>
    c >= 70 ? theme.palette.success.main
    : c >= 45 ? theme.palette.warning.main
    : theme.palette.error.main;

  return (
    <Stack gap={4}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
        <Box>
          <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={600} sx={{ mt: -1 }}>
            AI 수요 예측 및 탄소 절감 리포트
          </Typography>
        </Box>
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
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" color="text.primary" fontWeight={700}>
                향후 7일 메뉴별 수요 예측
              </Typography>
              <Chip
                label={predictions.length > 0 ? `${predictions.length}건 예측` : '예측 데이터 없음'}
                color={predictions.length > 0 ? 'primary' : 'default'}
                size="small"
              />
            </Stack>
            {predictions.length > 0 ? (
              <ReactEChart option={chartOption} echarts={echarts} sx={{ height: 380 }} />
            ) : (
              <Stack alignItems="center" justifyContent="center" height={300} gap={2}>
                <Typography color="text.secondary" variant="body1">
                  예측 데이터가 없습니다.
                </Typography>
                <Typography color="text.secondary" variant="body2">
                  "AI 예측 실행" 버튼을 눌러 예측을 시작하세요.
                </Typography>
              </Stack>
            )}
          </Paper>
        </Grid>

        {/* 예측 상세 테이블 */}
        {predictions.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 4, border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" fontWeight={700} mb={2}>예측 상세 결과</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>날짜</TableCell>
                      <TableCell>메뉴</TableCell>
                      <TableCell align="center">예측 판매량</TableCell>
                      <TableCell align="center">모델 신뢰도</TableCell>
                      <TableCell>모델 버전</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {predictions.map((p) => (
                      <TableRow key={p.id} hover>
                        <TableCell>{formatDate(p.predictionDate)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{p.menuName}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Typography fontWeight={700} color="primary.main">
                            {p.predictedQty}개
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" alignItems="center" spacing={1} justifyContent="center">
                            <LinearProgress
                              variant="determinate"
                              value={p.confidence}
                              sx={{
                                width: 80,
                                height: 6,
                                borderRadius: 3,
                                bgcolor: theme.palette.action.hover,
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: confColor(p.confidence),
                                  borderRadius: 3,
                                },
                              }}
                            />
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              sx={{ color: confColor(p.confidence), minWidth: 40 }}
                            >
                              {p.confidence.toFixed(1)}%
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Chip label={p.modelVersion ?? 'rf_v1.0'} size="small" variant="outlined" />
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
            <Typography variant="h6" gutterBottom color="primary.dark" fontWeight={700}>AI 분석 리포트</Typography>
            {predictions.length > 0 ? (
              (() => {
                const topMenu = [...predictions]
                  .sort((a, b) => b.predictedQty - a.predictedQty)[0];
                const avgConf = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length;
                const totalPred = predictions.reduce((s, p) => s + p.predictedQty, 0);
                return (
                  <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, lineHeight: 1.9 }}>
                    • 예측 기간 총 판매량: <b>{totalPred}개</b><br />
                    • 가장 많이 팔릴 메뉴: <b>{topMenu.menuName}</b> ({topMenu.predictionDate} 기준)<br />
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
            {predictions.length > 0 ? (
              (() => {
                const lowConf = predictions.filter((p) => p.confidence < 50);
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
