import { useEffect, useState, useCallback } from 'react';
import {
  Typography, Paper, Stack, Button, TextField,
  Alert, CircularProgress, Chip, Box,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton,
} from '@mui/material';
import { storeService } from '../services/storeService';
import { menuService } from '../services/menuService';
import IconifyIcon from '../components/base/IconifyIcon';

const MenuManagement = ({ user }: any) => {
  const [storeId, setStoreId] = useState<number | null>(null);
  const [menus, setMenus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ menuName: '', price: '' });

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    storeService.getMyStores(user.id).then((stores: any[]) => {
      if (stores?.length > 0) setStoreId(stores[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  const loadMenus = useCallback(async (sid: number) => {
    setLoading(true);
    try {
      const data = await menuService.getByStore(sid);
      setMenus(data ?? []);
    } catch {
      setError('메뉴 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeId) loadMenus(storeId);
  }, [storeId, loadMenus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.menuName || !form.price || !storeId) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await menuService.create({
        storeId,
        menuName: form.menuName,
        price: parseInt(form.price),
      });
      setSuccess(`"${form.menuName}" 메뉴가 등록되었습니다.`);
      setForm({ menuName: '', price: '' });
      await loadMenus(storeId);
    } catch {
      setError('메뉴 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (menuId: number, menuName: string) => {
    if (!window.confirm(`"${menuName}" 메뉴를 비활성화하시겠습니까?`)) return;
    try {
      await menuService.deactivate(menuId);
      setSuccess(`"${menuName}" 메뉴가 비활성화되었습니다.`);
      if (storeId) await loadMenus(storeId);
    } catch {
      setError('메뉴 비활성화에 실패했습니다.');
    }
  };

  return (
    <Stack gap={4} maxWidth={720}>
      <Box>
        <Typography variant="h2" color="primary.main" fontWeight={800}>메뉴 관리</Typography>
        <Typography variant="h6" color="text.secondary" fontWeight={400} sx={{ mt: 0.5 }}>
          AI 예측을 위해 메뉴를 먼저 등록하세요.
        </Typography>
      </Box>

      {!storeId && !loading && (
        <Alert severity="warning">등록된 가게가 없습니다. 먼저 가게를 등록해주세요.</Alert>
      )}
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      {/* 메뉴 등록 폼 */}
      {storeId && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={2.5}>
            <IconifyIcon icon="mingcute:add-circle-fill" color="primary.main" />
            <Typography variant="h6" fontWeight={700}>새 메뉴 등록</Typography>
          </Stack>
          <Stack component="form" onSubmit={handleSubmit} direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems="flex-start">
            <TextField
              label="메뉴 이름"
              name="menuName"
              value={form.menuName}
              onChange={handleChange}
              size="small"
              required
              sx={{ flex: 2 }}
            />
            <TextField
              label="가격 (원)"
              name="price"
              type="number"
              value={form.price}
              onChange={handleChange}
              size="small"
              required
              sx={{ flex: 1 }}
            />
            <Button
              type="submit"
              variant="contained"
              size="medium"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ whiteSpace: 'nowrap', height: 40 }}
            >
              등록
            </Button>
          </Stack>
        </Paper>
      )}

      {/* 메뉴 목록 */}
      {storeId && (
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6" fontWeight={700}>등록된 메뉴 목록</Typography>
            <Chip label={`총 ${menus.length}개`} size="small" color="primary" variant="outlined" />
          </Stack>
          {loading ? (
            <CircularProgress size={24} />
          ) : menus.length === 0 ? (
            <Typography color="text.secondary" variant="body2">
              등록된 메뉴가 없습니다. 위에서 메뉴를 추가하세요.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>메뉴명</TableCell>
                    <TableCell align="right">가격</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">삭제</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {menus.map((menu) => (
                    <TableRow key={menu.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{menu.menuName}</Typography>
                      </TableCell>
                      <TableCell align="right">{menu.price?.toLocaleString()}원</TableCell>
                      <TableCell align="center">
                        <Chip
                          label={menu.isActive !== false ? '활성' : '비활성'}
                          color={menu.isActive !== false ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeactivate(menu.id, menu.menuName)}
                        >
                          <IconifyIcon icon="mingcute:delete-2-line" width={18} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Stack>
  );
};

export default MenuManagement;
