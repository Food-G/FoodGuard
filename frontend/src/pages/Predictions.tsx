import React, { useEffect, useState } from 'react';
import { Typography, Box, Paper, Grid, Card, CardContent } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { storeService } from '../services/storeService';

const Predictions = ({ user }: any) => {
  const [storeId, setStoreId] = useState<number | null>(null);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        if (user?.id) {
          const stores = await storeService.getMyStores(user.id);
          if (stores && stores.length > 0) setStoreId(stores[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch store:', error);
      }
    };
    fetchStore();
  }, [user]);

  // Mock data for AI Prediction
  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['실제 판매량', 'AI 예측 판매량'], textStyle: { color: '#stone-200' } },
    xAxis: {
      type: 'category',
      data: ['월', '화', '수', '목', '금', '토', '일'],
      axisLabel: { color: '#stone-500' }
    },
    yAxis: { type: 'value', axisLabel: { color: '#stone-500' }, splitLine: { lineStyle: { color: '#stone-800' } } },
    series: [
      {
        name: '실제 판매량',
        type: 'line',
        data: [120, 132, 101, 134, 90, 230, 210],
        itemStyle: { color: '#3498db' }
      },
      {
        name: 'AI 예측 판매량',
        type: 'line',
        data: [115, 140, 110, 130, 100, 245, 220],
        itemStyle: { color: '#aa3bff' },
        lineStyle: { type: 'dashed' }
      }
    ]
  };

  return (
    <Box>
      <Typography variant="h4" color="text.primary" sx={{ mb: 3 }}>AI 수요 예측</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 3 }}>주간 메뉴 판매량 예측 (전체 메뉴 합계)</Typography>
            <ReactECharts option={chartOption} style={{ height: '400px' }} />
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">AI 분석 리포트</Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                - 이번 주 금요일(내일)은 주변 지역 행사로 인해 수요가 약 15% 증가할 것으로 예상됩니다.<br/>
                - 메인 메뉴 '돼지고기 김치찌개'의 식자재 재고가 예측 판매량 대비 부족할 가능성이 있습니다.<br/>
                - 권장 발주 시기: 오늘 오후 6시 이전
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="secondary">추천 행동 지침</Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                1. 돼지고기(전지) 10kg 추가 발주 권장<br/>
                2. 대파 및 양파 재고 확인 후 소량 추가 매입 고려<br/>
                3. 금요일 저녁 시간대 아르바이트 인원 1명 추가 배치 검토
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Predictions;
