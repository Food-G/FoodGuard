import { useEffect } from 'react';
import { Typography, Paper, Grid, Stack, useTheme } from '@mui/material';
import ReactEChart from '../components/base/ReactEChart';
import * as echarts from 'echarts';
import { storeService } from '../services/storeService';

const Predictions = ({ user }: any) => {
  const theme = useTheme();

  useEffect(() => {
    const fetchStore = async () => {
      try {
        if (user?.id) {
          await storeService.getMyStores(user.id);
        }
      } catch (error) {
        console.error('Failed to fetch store:', error);
      }
    };
    fetchStore();
  }, [user]);

  const chartOption = {
    color: [theme.palette.secondary.main, theme.palette.primary.main],
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
    legend: { 
      data: ['실제 판매량', 'AI 예측 판매량'], 
      textStyle: { color: theme.palette.text.secondary },
      bottom: 0
    },
    grid: { top: '10%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['월', '화', '수', '목', '금', '토', '일'],
      axisLabel: { color: theme.palette.text.secondary },
      axisLine: { lineStyle: { color: theme.palette.divider } }
    },
    yAxis: { 
      type: 'value', 
      axisLabel: { color: theme.palette.text.secondary },
      splitLine: { lineStyle: { color: theme.palette.divider, type: 'dashed' } } 
    },
    series: [
      {
        name: '실제 판매량',
        type: 'line',
        smooth: true,
        data: [120, 132, 101, 134, 90, 230, 210],
        lineStyle: { width: 3 },
        showSymbol: false,
        areaStyle: {
          opacity: 0.2,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.palette.secondary.main },
            { offset: 1, color: 'transparent' }
          ])
        }
      },
      {
        name: 'AI 예측 판매량',
        type: 'line',
        smooth: true,
        data: [115, 140, 110, 130, 100, 245, 220],
        lineStyle: { width: 3, type: 'dashed' },
        showSymbol: false,
        areaStyle: {
          opacity: 0.2,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.palette.primary.main },
            { offset: 1, color: 'transparent' }
          ])
        }
      }
    ]
  };

  return (
    <Stack gap={4}>
      <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
      <Typography variant="h5" color="text.secondary" fontWeight={600} sx={{ mt: -2 }}>AI 수요 예측 및 탄소 절감 리포트</Typography>
      
      <Grid container spacing={3.5}>
        <Grid item xs={12}>
          <Paper sx={{ p: 4, bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" color="text.primary" fontWeight={700} sx={{ mb: 4 }}>주간 메뉴 판매량 예측 (친환경 최적화 지수)</Typography>
            <ReactEChart option={chartOption} echarts={echarts} sx={{ height: 400 }} />
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, bgcolor: 'primary.light', height: 1, border: `1px solid ${theme.palette.primary.main}20` }}>
            <Typography variant="h6" gutterBottom color="primary.dark" fontWeight={700}>🌿 AI 분석 리포트</Typography>
            <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, lineHeight: 1.8 }}>
              • 이번 주 금요일(내일)은 주변 지역 행사로 인해 수요가 약 <b>15% 증가</b>할 것으로 예상됩니다.<br/>
              • 메인 메뉴 '돼지고기 김치찌개'의 식자재 재고가 예측 판매량 대비 부족할 가능성이 있습니다.<br/>
              • 권장 발주 시기: <b>오늘 오후 6시 이전</b>
            </Typography>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 4, bgcolor: 'secondary.light', height: 1, border: `1px solid ${theme.palette.secondary.main}20` }}>
            <Typography variant="h6" gutterBottom color="secondary.dark" fontWeight={700}>🔄 순환 경제 행동 지침</Typography>
            <Typography variant="body1" sx={{ color: 'text.primary', mt: 2, lineHeight: 1.8 }}>
              1. <b>돼지고기(전지) 10kg</b> 추가 발주 권장<br/>
              2. 대파 및 양파 재고 확인 후 소량 추가 매입 고려<br/>
              3. 불필요한 전력 소모를 줄이기 위해 식재료 입고 시간을 최적화하세요.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Predictions;
