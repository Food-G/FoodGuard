import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Paper, Grid, Stack, useTheme,
  TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel,
  CircularProgress, Alert, Chip, Divider, Button,
} from '@mui/material';
import { storeService } from '../../services/storeService';
import IconifyIcon from '../../components/base/IconifyIcon';

const StoreManagement = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [selectedStore, setSelectedStore] = useState<any>(null);

  useEffect(() => {
    storeService.getAll()
      .then((list: any[]) => setStores(list ?? []))
      .catch(() => setError('가맹점 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const regions = ['ALL', ...Array.from(new Set(stores.map((s: any) => s.region).filter(Boolean))) as string[]];

  const filtered = stores.filter((s: any) => {
    const matchSearch = s.storeName?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = regionFilter === 'ALL' || s.region === regionFilter;
    return matchSearch && matchRegion;
  });

  const infoItems = selectedStore
    ? [
        { label: '지역', value: selectedStore.region ?? '-', icon: 'mingcute:location-line' },
        { label: '전화번호', value: selectedStore.phone ?? '-', icon: 'mingcute:phone-line' },
        { label: '점주 이메일', value: selectedStore.user?.email ?? '-', icon: 'mingcute:mail-line' },
        { label: '개점일', value: selectedStore.openedAt ?? '-', icon: 'mingcute:calendar-line' },
        { label: '등록일', value: selectedStore.createdAt ? new Date(selectedStore.createdAt).toLocaleDateString() : '-', icon: 'mingcute:time-line' },
        { label: '주소', value: selectedStore.address ?? '미등록', icon: 'mingcute:map-pin-line' },
      ]
    : [];

  return (
    <Stack gap={3.5} sx={{ bgcolor: 'background.default' }}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>FoodGuard</Typography>
        <Typography variant="h5" color="text.secondary" fontWeight={600}>가맹점 네트워크 관리</Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* 검색 + 필터 바 */}
      <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          size="small"
          placeholder="가맹점명 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <IconifyIcon icon="mingcute:search-2-line" width={18} color={theme.palette.text.secondary} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>지역</InputLabel>
          <Select value={regionFilter} label="지역" onChange={(e) => setRegionFilter(e.target.value as string)}>
            {regions.map((r) => (
              <MenuItem key={r} value={r}>{r === 'ALL' ? '전체 지역' : r}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip
          label={loading ? '로딩 중...' : `총 ${filtered.length}개 가맹점`}
          color="primary" variant="outlined" size="small"
        />
      </Stack>

      <Grid container spacing={2.5}>
        {/* 왼쪽: 가맹점 목록 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{
            border: `1px solid ${theme.palette.divider}`, borderRadius: 3,
            height: 600, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">가맹점 목록</Typography>
            </Box>

            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <IconifyIcon icon="mingcute:search-2-line" width={32} color={theme.palette.text.disabled} />
                <Typography color="text.secondary" fontSize={14}>검색 결과가 없습니다.</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {filtered.map((store: any, idx: number) => {
                  const isSelected = selectedStore?.id === store.id;
                  return (
                    <Box
                      key={store.id}
                      onClick={() => setSelectedStore(store)}
                      sx={{
                        px: 2.5, py: 1.75,
                        cursor: 'pointer',
                        borderLeft: `3px solid ${isSelected ? theme.palette.primary.main : 'transparent'}`,
                        bgcolor: isSelected ? `${theme.palette.primary.main}0A` : 'transparent',
                        transition: 'background 0.12s',
                        borderTop: idx > 0 ? `1px solid ${theme.palette.divider}` : 'none',
                        '&:hover': { bgcolor: isSelected ? `${theme.palette.primary.main}12` : 'action.hover' },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography
                          fontWeight={700} fontSize={14}
                          color={isSelected ? 'primary.main' : 'text.primary'}
                          noWrap sx={{ maxWidth: 170 }}
                        >
                          {store.storeName}
                        </Typography>
                        <Chip
                          label={store.isActive ? '운영중' : '비활성'}
                          size="small"
                          color={store.isActive ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
                        />
                      </Stack>
                      <Stack direction="row" gap={0.5} mt={0.5} alignItems="center">
                        <IconifyIcon icon="mingcute:location-line" width={12} color={theme.palette.text.disabled} />
                        <Typography variant="caption" color="text.secondary">{store.region ?? '-'}</Typography>
                        <Typography variant="caption" color="text.disabled" mx={0.25}>·</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 140 }}>
                          {store.user?.email ?? '-'}
                        </Typography>
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* 오른쪽: 가맹점 상세 */}
        <Grid item xs={12} md={8}>
          {!selectedStore ? (
            <Paper sx={{
              border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: 600,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2,
            }}>
              <Box sx={{ p: 3, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex' }}>
                <IconifyIcon icon="mingcute:store-2-line" width={44} color={theme.palette.text.disabled} />
              </Box>
              <Typography color="text.secondary" fontWeight={600}>가맹점을 선택하면 상세 정보가 표시됩니다.</Typography>
              <Typography variant="caption" color="text.disabled">왼쪽 목록에서 가맹점을 클릭하세요</Typography>
            </Paper>
          ) : (
            <Paper sx={{ p: 3.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 3, height: 600, display: 'flex', flexDirection: 'column' }}>
              {/* 헤더 */}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5}>
                <Box>
                  <Typography variant="h5" fontWeight={800} color="text.primary">{selectedStore.storeName}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={0.5}>
                    {selectedStore.address ?? '주소 미등록'}
                  </Typography>
                </Box>
                <Chip
                  label={selectedStore.isActive ? '운영중' : '비활성'}
                  color={selectedStore.isActive ? 'success' : 'default'}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>

              <Divider sx={{ mb: 2.5 }} />

              {/* 기본 정보 */}
              <Grid container spacing={2} sx={{ flex: 1 }}>
                {infoItems.map((item) => (
                  <Grid item xs={12} sm={6} key={item.label}>
                    <Stack direction="row" gap={1} alignItems="center">
                      <IconifyIcon icon={item.icon} width={15} color={theme.palette.text.secondary} />
                      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72 }}>{item.label}</Typography>
                      <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>{item.value}</Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>

              {/* 매출 통계 이동 버튼 */}
              <Box sx={{ mt: 'auto', pt: 3 }}>
                <Divider sx={{ mb: 2.5 }} />
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<IconifyIcon icon="mingcute:chart-bar-fill" width={20} />}
                  sx={{ borderRadius: 3, py: 1.5 }}
                  onClick={() =>
                    navigate(`/admin/stats?storeId=${selectedStore.id}&storeName=${encodeURIComponent(selectedStore.storeName)}`)
                  }
                >
                  {selectedStore.storeName} 매출 통계 보기
                </Button>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Stack>
  );
};

export default StoreManagement;
