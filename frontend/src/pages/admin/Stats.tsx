import { Typography, Paper, Grid, Stack, useTheme } from '@mui/material';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';

const Stats = () => {
  const theme = useTheme();

  const wasteTrendOption = {
    color: [theme.palette.primary.main, theme.palette.error.main],
    tooltip: { trigger: 'axis' },
    legend: { data: ['전체 매출', '식자재 폐기 비용'], bottom: 0 },
    xAxis: { type: 'category', data: ['1월', '2월', '3월', '4월', '5월', '6월'] },
    yAxis: { type: 'value' },
    series: [
      { 
        name: '전체 매출', 
        type: 'bar', 
        data: [450, 520, 480, 610, 590, 680],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: theme.palette.primary.main },
            { offset: 1, color: theme.palette.primary.light }
          ])
        }
      },
      { 
        name: '식자재 폐기 비용', 
        type: 'line', 
        data: [45, 48, 40, 35, 30, 25], 
        smooth: true,
        lineStyle: { width: 4 }
      }
    ]
  };

  const storeWasteOption = {
    tooltip: { trigger: 'item' },
    series: [
      {
        name: '가맹점별 폐기 비중',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: [
          { value: 1048, name: '강남점', itemStyle: { color: '#1D9E75' } },
          { value: 735, name: '홍대점', itemStyle: { color: '#3B6D11' } },
          { value: 580, name: '판교점', itemStyle: { color: '#43A047' } },
          { value: 484, name: '부산점', itemStyle: { color: '#81C784' } },
          { value: 300, name: '기타', itemStyle: { color: '#C8E6C9' } }
        ]
      }
    ]  };

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={700} mb={3}>네트워크 통합 매출 vs 자원 폐기 추이</Typography>
            <ReactEChart option={wasteTrendOption} echarts={echarts} sx={{ height: 350 }} />
          </Paper>
        </Grid>
        
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 4, height: 450, border: `1px solid ${theme.palette.divider}`, borderRadius: 5, bgcolor: 'background.paper' }}>
            <Typography variant="h6" fontWeight={700} mb={3}>가맹점별 자원 손실 비중</Typography>
            <ReactEChart option={storeWasteOption} echarts={echarts} sx={{ height: 350 }} />          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 4, border: `1px solid ${theme.palette.primary.main}30`, bgcolor: 'primary.light', borderRadius: 4 }}>
             <Stack direction="row" alignItems="center" gap={2}>
                <Typography variant="h5" color="primary.dark" fontWeight={800}>🌿 환경 분석 임팩트:</Typography>
                <Typography variant="body1" color="primary.dark" fontWeight={500}>
                  지난 3개월간 전체 폐기율이 <b>12.5% 감소</b>했습니다. 이는 소나무 124그루를 심은 것과 동일한 탄소 절감 효과입니다.
                </Typography>
             </Stack>          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
};

export default Stats;
