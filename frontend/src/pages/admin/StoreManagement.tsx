import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, CircularProgress, Stack, useTheme,
  Chip, Alert, Grid,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { storeService } from '../../services/storeService';
import { salesService } from '../../services/salesService';
import ReactEChart from '../../components/base/ReactEChart';
import * as echarts from 'echarts';

const StoreManagement = () => {
  const theme = useTheme();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weeklySummary, setWeeklySummary] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const stores = await storeService.getAll();
        const storeList = (stores ?? []).map((s: any) => ({
          id: s.id,
          storeName: s.storeName,
          address: s.address,
          phone: s.phone,
          ownerEmail: s.user?.email ?? '-',
          region: s.region ?? '-',
          createdAt: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-',
        }));
        setRows(storeList);

        // 각 가맹점 주간 매출 조회
        setSummaryLoading(true);
        const summaries = await Promise.allSettled(
          storeList.map((s: any) => salesService.getWeeklySummary(s.id).then((r: any) => ({ id: s.id, revenue: r.thisWeekRevenue ?? 0 })))
        );
        const map: Record<string, number> = {};
        summaries.forEach((r) => {
          if (r.status === 'fulfilled') map[r.value.id] = r.value.revenue;
        });
        setWeeklySummary(map);
      } catch {
        setError('가맹점 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
        setSummaryLoading(false);
      }
    };
    fetchAll();
  }, []);

  const totalWeeklyRevenue = Object.values(weeklySummary).reduce((s, v) => s + v, 0);
  const topStore = rows.reduce((top: any, s: any) => {
    const rev = weeklySummary[s.id] ?? 0;
    return rev > (weeklySummary[top?.id] ?? 0) ? s : top;
  }, rows[0]);

  // 가맹점별 주간 매출 차트
  const storesWithRevenue = rows
    .map((s) => ({ name: s.storeName, value: weeklySummary[s.id] ?? 0 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const barChartOption = {
    color: [theme.palette.primary.main],
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>₩${p[0].value.toLocaleString()}` },
    grid: { top: '8%', left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: { type: 'category', data: storesWithRevenue.map((s) => s.name), axisLabel: { color: theme.palette.text.secondary, fontSize: 11 } },
    yAxis: { type: 'value', axisLabel: { color: theme.palette.text.secondary, formatter: (v: number) => v >= 10000 ? `${Math.round(v/10000)}만` : String(v) } },
    series: [{ type: 'bar', data: storesWithRevenue.map((s) => s.value), itemStyle: { color: theme.palette.primary.main, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 50 }],
  };

  const columns: GridColDef[] = [
    { field: 'storeName', headerName: '가맹점명', flex: 1, minWidth: 140 },
    { field: 'region', headerName: '지역', width: 100 },
    { field: 'ownerEmail', headerName: '점주 이메일', width: 200 },
    { field: 'phone', headerName: '전화번호', width: 140 },
    {
      field: 'weeklyRevenue', headerName: '이번 주 매출', width: 140, align: 'right', headerAlign: 'right',
      valueGetter: (params) => weeklySummary[params.row.id] ?? 0,
      renderCell: (params) => (
        summaryLoading
          ? <CircularProgress size={14} />
          : <Typography fontWeight={700} fontSize={13} color="primary.main">
              ₩{(weeklySummary[params.row.id] ?? 0).toLocaleString()}
            </Typography>
      ),
    },
    { field: 'createdAt', headerName: '등록일', width: 110 },
  ];

  return (
    <Stack gap={4}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>지속 가능한 가맹점 네트워크 관리</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* 요약 카드 */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>전체 가맹점 수</Typography>
            <Typography variant="h3" fontWeight={800} color="primary.main">{rows.length}개</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>이번 주 네트워크 총매출</Typography>
            {summaryLoading ? <CircularProgress size={28} /> : (
              <Typography variant="h3" fontWeight={800} color="secondary.main">
                ₩{totalWeeklyRevenue.toLocaleString()}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 3, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>이번 주 매출 1위</Typography>
            {summaryLoading ? <CircularProgress size={28} /> : (
              <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
                <Typography variant="h5" fontWeight={800} color="success.main">{topStore?.storeName ?? '-'}</Typography>
                {topStore && <Chip label={`₩${(weeklySummary[topStore.id] ?? 0).toLocaleString()}`} color="success" size="small" />}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 가맹점별 주간 매출 차트 */}
      {storesWithRevenue.length > 0 && (
        <Paper sx={{ p: 4, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={700} mb={2.5}>가맹점별 이번 주 매출 현황</Typography>
          <ReactEChart option={barChartOption} echarts={echarts} sx={{ height: 280 }} />
        </Paper>
      )}

      {/* 가맹점 목록 */}
      <Paper sx={{ bgcolor: 'background.paper', p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>가맹점 목록</Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 20]}
            sx={{
              border: 'none',
              '& .MuiDataGrid-cell': { color: 'text.primary' },
              '& .MuiDataGrid-columnHeaders': { bgcolor: 'background.default' },
            }}
          />
        )}
      </Paper>
    </Stack>
  );
};

export default StoreManagement;
