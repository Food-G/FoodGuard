import { useEffect, useState } from 'react';
import {
  Typography, Box, Paper, Button, CircularProgress, Stack,
  useTheme, Chip, Alert, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, IconButton, Popover,
} from '@mui/material';
import IconifyIcon from '../components/base/IconifyIcon';
import { api } from '../services/api';
import { useConfirm } from '../hooks/useConfirm';
import { useMyStore } from '../hooks/useMyStore';

const UNIT_OPTIONS = ['kg', 'L', '개'];

const Ingredients = ({ user }: any) => {
  const theme = useTheme();
  const confirm = useConfirm();
  const { storeId, storeLoading } = useMyStore(user);

  const [allIngredients, setAllIngredients] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showIngForm, setShowIngForm] = useState(false);
  const [ingForm, setIngForm] = useState({ name: '', unit: '' });
  const [editingIng, setEditingIng] = useState<any | null>(null);
  const [ingSubmitting, setIngSubmitting] = useState(false);
  const [ingUnitAnchor, setIngUnitAnchor] = useState<HTMLElement | null>(null);
  const [editUnitAnchor, setEditUnitAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (storeId) loadAllIngredients(storeId);
  }, [storeId]);

  const loadAllIngredients = async (sid: number) => {
    try {
      const data = await api.get(`/ingredients?storeId=${sid}`);
      setAllIngredients(data ?? []);
    } catch {
      setError('식자재 목록을 불러오지 못했습니다.');
    }
  };

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingForm.name || !ingForm.unit || !storeId) return;
    setIngSubmitting(true);
    setError('');
    try {
      await api.post('/ingredients', { ...ingForm, storeId });
      setSuccess('식자재가 등록되었습니다.');
      setIngForm({ name: '', unit: '' });
      setShowIngForm(false);
      await loadAllIngredients(storeId);
    } catch {
      setError('식자재 등록에 실패했습니다.');
    } finally {
      setIngSubmitting(false);
    }
  };

  const handleUpdateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIng) return;
    setIngSubmitting(true);
    setError('');
    try {
      await api.put(`/ingredients/${editingIng.id}`, {
        name: editingIng.name,
        unit: editingIng.unit,
      });
      setSuccess('식자재가 수정되었습니다.');
      setEditingIng(null);
      if (storeId) await loadAllIngredients(storeId);
    } catch {
      setError('식자재 수정에 실패했습니다.');
    } finally {
      setIngSubmitting(false);
    }
  };

  const handleDeleteIngredient = async (id: number, name: string) => {
    if (!await confirm({ message: `"${name}" 식자재를 삭제하시겠습니까?`, confirmLabel: '삭제', severity: 'error' })) return;
    try {
      await api.delete(`/ingredients/${id}`);
      setSuccess('식자재가 삭제되었습니다.');
      if (storeId) await loadAllIngredients(storeId);
    } catch {
      setError('식자재 삭제에 실패했습니다.');
    }
  };

  return (
    <Stack gap={4} sx={{ bgcolor: 'background.default' }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={700}>식자재 목록</Typography>
          <Button
            size="small" variant="outlined"
            startIcon={<IconifyIcon icon="mingcute:add-line" />}
            onClick={() => { setShowIngForm((v) => !v); setEditingIng(null); }}
          >
            식자재 등록
          </Button>
        </Stack>

        {showIngForm && (
          <Box component="form" onSubmit={handleCreateIngredient}
            sx={{ p: 2, mb: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} alignItems="center">
              <TextField label="식자재명" size="small" required sx={{ flex: 2 }}
                value={ingForm.name} onChange={(e) => setIngForm((p) => ({ ...p, name: e.target.value }))} />
              <Button
                size="small" variant="outlined"
                endIcon={<IconifyIcon icon="mingcute:down-line" width={14} />}
                onClick={(e) => setIngUnitAnchor(e.currentTarget)}
                sx={{ minWidth: 100, justifyContent: 'space-between', color: ingForm.unit ? 'text.primary' : 'text.secondary' }}
              >
                {ingForm.unit || '단위 선택'}
              </Button>
              <Popover
                open={Boolean(ingUnitAnchor)}
                anchorEl={ingUnitAnchor}
                onClose={() => setIngUnitAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <Box sx={{ p: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', maxWidth: 220 }}>
                  {UNIT_OPTIONS.map((u) => (
                    <Chip
                      key={u} label={u} size="small" clickable
                      color={ingForm.unit === u ? 'primary' : 'default'}
                      variant={ingForm.unit === u ? 'filled' : 'outlined'}
                      onClick={() => { setIngForm((p) => ({ ...p, unit: u })); setIngUnitAnchor(null); }}
                      sx={{ fontWeight: ingForm.unit === u ? 700 : 400 }}
                    />
                  ))}
                </Box>
              </Popover>
              <Button type="submit" variant="contained" size="medium" disabled={ingSubmitting || !ingForm.unit}
                startIcon={ingSubmitting ? <CircularProgress size={14} color="inherit" /> : null}>
                등록
              </Button>
              <Button size="medium" onClick={() => setShowIngForm(false)}>취소</Button>
            </Stack>
          </Box>
        )}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>식자재명</TableCell>
                <TableCell>단위</TableCell>
                <TableCell align="center" width={120}>관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allIngredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                      등록된 식자재가 없습니다.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : allIngredients.map((ing) => (
                <TableRow key={ing.id} hover>
                  {editingIng?.id === ing.id ? (
                    <>
                      <TableCell>
                        <TextField size="small" value={editingIng.name} sx={{ width: 140 }}
                          onChange={(e) => setEditingIng((p: any) => ({ ...p, name: e.target.value }))} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small" variant="outlined"
                          endIcon={<IconifyIcon icon="mingcute:down-line" width={14} />}
                          onClick={(e) => setEditUnitAnchor(e.currentTarget)}
                          sx={{ minWidth: 90, justifyContent: 'space-between', color: editingIng.unit ? 'text.primary' : 'text.secondary' }}
                        >
                          {editingIng.unit || '단위'}
                        </Button>
                        <Popover
                          open={Boolean(editUnitAnchor)}
                          anchorEl={editUnitAnchor}
                          onClose={() => setEditUnitAnchor(null)}
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                          <Box sx={{ p: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', maxWidth: 220 }}>
                            {UNIT_OPTIONS.map((u) => (
                              <Chip
                                key={u} label={u} size="small" clickable
                                color={editingIng.unit === u ? 'primary' : 'default'}
                                variant={editingIng.unit === u ? 'filled' : 'outlined'}
                                onClick={() => { setEditingIng((p: any) => ({ ...p, unit: u })); setEditUnitAnchor(null); }}
                                sx={{ fontWeight: editingIng.unit === u ? 700 : 400 }}
                              />
                            ))}
                          </Box>
                        </Popover>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={0.5} justifyContent="center">
                          <Button size="small" variant="contained" disabled={ingSubmitting}
                            onClick={handleUpdateIngredient}>저장</Button>
                          <Button size="small" onClick={() => setEditingIng(null)}>취소</Button>
                        </Stack>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell><Typography variant="body2" fontWeight={600}>{ing.name}</Typography></TableCell>
                      <TableCell>{ing.unit}</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" gap={0.5} justifyContent="center">
                          <IconButton size="small" color="primary"
                            onClick={() => { setEditingIng({ ...ing }); setShowIngForm(false); }}>
                            <IconifyIcon icon="mingcute:edit-2-line" width={17} />
                          </IconButton>
                          <IconButton size="small" color="error"
                            onClick={() => handleDeleteIngredient(ing.id, ing.name)}>
                            <IconifyIcon icon="mingcute:delete-2-line" width={17} />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
};

export default Ingredients;
