import React from 'react';
import { Typography, Grid, Box, Card, CardContent } from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';

const StatusCard = ({ title, value, icon, color }: any) => (
  <Card sx={{ bgcolor: 'background.paper', borderRadius: 2, height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box sx={{ p: 1, borderRadius: 1, bgcolor: `${color}20`, color: color, display: 'flex' }}>
          <IconifyIcon icon={icon} />
        </Box>
        <Typography variant="subtitle2" sx={{ ml: 1.5, color: 'text.secondary' }}>{title}</Typography>
      </Box>
      <Typography variant="h4" sx={{ color: 'text.primary' }}>{value}</Typography>
    </CardContent>
  </Card>
);

const Dashboard = ({ user }: any) => {
  const role = user?.role || 'owner';

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, color: 'text.primary' }}>
        {role === 'HQ' ? '본사 관리자 대시보드' : '가맹점 대시보드'}
      </Typography>
      <Grid container spacing={3}>
        {role !== 'HQ' ? (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatusCard title="오늘의 매출" value="₩1,240,000" icon="mingcute:currency-line" color="#27ae60" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatusCard title="내일 예측 판매량" value="450건" icon="mingcute:brain-line" color="#aa3bff" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatusCard title="재고 부족 알림" value="3건" icon="mingcute:alert-line" color="#e67e22" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatusCard title="미승인 발주" value="1건" icon="mingcute:time-line" color="#3498db" />
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} sm={6} md={4}>
              <StatusCard title="전체 가맹점 매출" value="₩45,000,000" icon="mingcute:store-2-line" color="#2ecc71" />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <StatusCard title="평균 폐기율" value="12.5%" icon="mingcute:delete-2-line" color="#e74c3c" />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <StatusCard title="대기 중인 발주" value="14건" icon="mingcute:clipboard-line" color="#f1c40f" />
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};

export default Dashboard;
