import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Stack, Typography, TextField, Button, IconButton,
  Divider, Alert, CircularProgress, useTheme, alpha,
} from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import { menuService } from '../services/menuService';
import { fileToDataUrl } from '../utils/image';

// 메뉴 설정: 새 메뉴 등록 + 기존 메뉴 수정/삭제/사진 관리
interface Props {
  open: boolean;
  onClose: () => void;
  storeId: number | null;
  menus: any[];
  onChanged: () => void;
}

const emptyForm = { menuName: '', price: '', category: '', imageUrl: '' };

const MenuSettingsDialog = ({ open, onClose, storeId, menus, onChanged }: Props) => {
  const theme = useTheme();
  const [form, setForm] = useState({ ...emptyForm });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ menuName: '', price: '', category: '' });

  const placeholder = (
    <IconifyIcon icon="mingcute:bowl-line" width={24} color={theme.palette.text.disabled} />
  );

  const thumb = (src?: string, alt = '') => (
    <Box sx={{
      width: 52, height: 52, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden',
      bgcolor: alpha(theme.palette.primary.main, 0.06),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src
        ? <Box component="img" src={src} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : placeholder}
    </Box>
  );

  const handleNewPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const imageUrl = await fileToDataUrl(file);
      setForm(f => ({ ...f, imageUrl }));
    } catch { setError('이미지를 불러오지 못했습니다.'); }
  };

  const handleAdd = async () => {
    if (!storeId || !form.menuName || !form.price) {
      setError('메뉴 이름과 가격을 입력해주세요.');
      return;
    }
    setAdding(true);
    setError('');
    try {
      await menuService.create({
        storeId,
        menuName: form.menuName,
        price: parseInt(form.price, 10),
        category: form.category || null,
        imageUrl: form.imageUrl || null,
      });
      setForm({ ...emptyForm });
      onChanged();
    } catch {
      setError('메뉴 등록에 실패했습니다.');
    } finally {
      setAdding(false);
    }
  };

  const handleRowPhoto = async (menu: any, file?: File) => {
    if (!file) return;
    setBusyId(menu.id);
    setError('');
    try {
      const imageUrl = await fileToDataUrl(file);
      await menuService.update(menu.id, {
        menuName: menu.menuName, price: menu.price, category: menu.category ?? null, imageUrl,
      });
      onChanged();
    } catch {
      setError('사진 변경에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (menu: any) => {
    setEditingId(menu.id);
    setEditForm({ menuName: menu.menuName ?? '', price: String(menu.price ?? ''), category: menu.category ?? '' });
  };

  const saveEdit = async (menu: any) => {
    if (!editForm.menuName || !editForm.price) { setError('메뉴 이름과 가격을 입력해주세요.'); return; }
    setBusyId(menu.id);
    setError('');
    try {
      await menuService.update(menu.id, {
        menuName: editForm.menuName,
        price: parseInt(editForm.price, 10),
        category: editForm.category || null,
      });
      setEditingId(null);
      onChanged();
    } catch {
      setError('메뉴 수정에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (menu: any) => {
    if (!window.confirm(`"${menu.menuName}" 메뉴를 삭제하시겠습니까?`)) return;
    setBusyId(menu.id);
    setError('');
    try {
      await menuService.deactivate(menu.id);
      onChanged();
    } catch {
      setError('메뉴 삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" gap={1}>
          <IconifyIcon icon="mingcute:settings-3-line" color={theme.palette.primary.main} />
          메뉴 설정
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {!storeId && <Alert severity="warning" sx={{ mb: 2 }}>등록된 가게가 없습니다.</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

        {/* 새 메뉴 등록 */}
        <Typography variant="subtitle2" fontWeight={700} mb={1}>새 메뉴 등록</Typography>
        <Stack direction="row" gap={1.5} alignItems="flex-start" mb={1.5}>
          <Button component="label" sx={{ p: 0, minWidth: 0, borderRadius: 1.5 }}>
            {thumb(form.imageUrl, '미리보기')}
            <input hidden type="file" accept="image/*"
              onChange={e => handleNewPhoto(e.target.files?.[0])} />
          </Button>
          <Stack flex={1} gap={1.5}>
            <Stack direction="row" gap={1.5}>
              <TextField label="메뉴 이름" size="small" fullWidth required
                value={form.menuName} onChange={e => setForm(f => ({ ...f, menuName: e.target.value }))} />
              <TextField label="가격" size="small" type="number" sx={{ width: 120 }} required
                value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </Stack>
            <Stack direction="row" gap={1.5}>
              <TextField label="카테고리 (선택)" size="small" fullWidth
                value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <Button variant="contained" onClick={handleAdd} disabled={adding || !storeId}
                sx={{ whiteSpace: 'nowrap', width: 120 }}>
                {adding ? <CircularProgress size={18} color="inherit" /> : '등록'}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              썸네일을 눌러 사진을 선택하세요 (원본 그대로 등록).
            </Typography>
          </Stack>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* 기존 메뉴 목록 */}
        <Typography variant="subtitle2" fontWeight={700} mb={1}>
          등록된 메뉴 ({menus.length})
        </Typography>
        {menus.length === 0 ? (
          <Typography variant="body2" color="text.disabled" p={1}>등록된 메뉴가 없습니다.</Typography>
        ) : (
          <Stack gap={1}>
            {menus.map(menu => (
              <Stack key={menu.id} direction="row" alignItems="center" gap={1.5}
                sx={{ p: 1, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                {thumb(menu.imageUrl, menu.menuName)}

                {editingId === menu.id ? (
                  <Stack flex={1} gap={1}>
                    <Stack direction="row" gap={1}>
                      <TextField label="이름" size="small" fullWidth value={editForm.menuName}
                        onChange={e => setEditForm(f => ({ ...f, menuName: e.target.value }))} />
                      <TextField label="가격" size="small" type="number" sx={{ width: 100 }} value={editForm.price}
                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} />
                    </Stack>
                    <TextField label="카테고리" size="small" value={editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
                  </Stack>
                ) : (
                  <Box flex={1} minWidth={0}>
                    <Typography variant="body2" fontWeight={600} noWrap>{menu.menuName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      ₩{menu.price?.toLocaleString()}{menu.category ? ` · ${menu.category}` : ''}
                    </Typography>
                  </Box>
                )}

                <Stack direction="row" gap={0.3} alignItems="center">
                  {busyId === menu.id ? (
                    <CircularProgress size={20} sx={{ mx: 1 }} />
                  ) : editingId === menu.id ? (
                    <>
                      <IconButton size="small" color="primary" onClick={() => saveEdit(menu)}>
                        <IconifyIcon icon="mingcute:check-line" width={20} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setEditingId(null)}>
                        <IconifyIcon icon="mingcute:close-line" width={20} />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton size="small" component="label" title="사진 추가/변경">
                        <IconifyIcon icon="mingcute:pic-line" width={20} />
                        <input hidden type="file" accept="image/*"
                          onChange={e => handleRowPhoto(menu, e.target.files?.[0])} />
                      </IconButton>
                      <IconButton size="small" title="수정" onClick={() => startEdit(menu)}>
                        <IconifyIcon icon="mingcute:edit-2-line" width={20} />
                      </IconButton>
                      <IconButton size="small" color="error" title="삭제" onClick={() => handleDelete(menu)}>
                        <IconifyIcon icon="mingcute:delete-2-line" width={20} />
                      </IconButton>
                    </>
                  )}
                </Stack>
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained">닫기</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MenuSettingsDialog;
