import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, ButtonBase, Dialog, Stack, TextField, Typography } from '@mui/material';
import IconifyIcon from './base/IconifyIcon';
import IngredientImage from './IngredientImage';
import { TOSS, Segmented, tossButtonSx, tossSubButtonSx } from './TossUI';
import { GALLERY, autoIcon, shrinkPhoto } from '../utils/ingredientImage';

const UNITS = [
  { value: 'kg', label: 'kg', hint: '무게로 사요 (고기·채소·치즈)' },
  { value: 'L', label: 'L', hint: '부피로 사요 (소스·기름·우유)' },
  { value: '개', label: '개', hint: '낱개로 사요 (빵·계란·통조림)' },
];

export interface IngredientDraft { name: string; unit: string; imageUrl: string | null }

// 식자재 등록·수정 창. 1 이름 → 2 단위 → 3 사진 순서로 채우고, 오른쪽(좁으면 위) 미리보기로 결과를 바로 보여 준다
const IngredientDialog = ({ open, initial, title, submitLabel, onClose, onSubmit }: {
  open: boolean; initial?: IngredientDraft; title: string; submitLabel: string;
  onClose: () => void; onSubmit: (d: IngredientDraft) => Promise<void>;
}) => {
  const [draft, setDraft] = useState<IngredientDraft>({ name: '', unit: 'kg', imageUrl: null });
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? { name: '', unit: 'kg', imageUrl: null });
    setPicking(false);
    setError('');
  }, [open, initial]);

  const upload = async (file?: File) => {
    if (!file) return;
    try {
      setDraft((d) => ({ ...d, imageUrl: null }));
      const url = await shrinkPhoto(file);
      setDraft((d) => ({ ...d, imageUrl: url }));
      setPicking(false);
    } catch (e: any) {
      setError(e?.message || '사진을 올리지 못했어요.');
    }
  };

  const submit = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit({ ...draft, name: draft.name.trim() });
    } catch (e: any) {
      setError(e?.message || '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  const imageMode = draft.imageUrl?.startsWith('data:image/') ? '올린 사진' : draft.imageUrl?.startsWith('icon:') ? '고른 그림' : '이름으로 자동 선택';
  const step = (n: number, label: string) => (
    <Stack direction="row" alignItems="center" gap={1} mb={1}>
      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: TOSS.green, color: '#fff', fontSize: 12, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</Box>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: TOSS.text }}>{label}</Typography>
    </Stack>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: '24px', bgcolor: '#FFFFFF', backgroundImage: 'none' } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px' } }}>
        {/* 입력 */}
        <Box sx={{ p: { xs: 2.5, md: 3.5 }, order: { xs: 2, md: 1 } }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: TOSS.text, mb: 3 }}>{title}</Typography>
          {error && <Alert severity="error" sx={{ borderRadius: '12px', mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          {step(1, '이름')}
          <TextField fullWidth autoFocus placeholder="예: 양상추, 소고기 패티, 체다치즈" value={draft.name}
            inputProps={{ 'aria-label': '식자재 이름', maxLength: 100 }}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            sx={{ mb: 3, '& .MuiInputBase-root': { borderRadius: '14px', bgcolor: TOSS.bg }, '& fieldset': { border: 'none' } }} />

          {step(2, '재고·발주 단위')}
          <Segmented value={draft.unit} onChange={(u: string) => setDraft((d) => ({ ...d, unit: u }))}
            options={UNITS.map((u) => ({ value: u.value, label: u.label }))} />
          <Typography sx={{ fontSize: 13, color: TOSS.sub, mt: 0.75, mb: 3 }}>
            {UNITS.find((u) => u.value === draft.unit)?.hint} · 레시피에는 g·ml 로 넣어도 돼요.
          </Typography>

          {step(3, '사진')}
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button onClick={() => setPicking((v) => !v)} startIcon={<IconifyIcon icon="mingcute:grid-line" width={18} />}
              sx={{ ...tossSubButtonSx, py: 0.9, px: 2, fontSize: 14 }}>그림 고르기</Button>
            <Button onClick={() => fileRef.current?.click()} startIcon={<IconifyIcon icon="mingcute:camera-line" width={18} />}
              sx={{ ...tossSubButtonSx, py: 0.9, px: 2, fontSize: 14 }}>내 사진 올리기</Button>
            {draft.imageUrl && (
              <Button onClick={() => setDraft((d) => ({ ...d, imageUrl: null }))}
                sx={{ py: 0.9, px: 1.5, fontSize: 14, fontWeight: 700, color: TOSS.sub }}>자동으로 되돌리기</Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
          </Stack>
          {picking && (
            <Box sx={{ mt: 1.5, p: 1, borderRadius: '16px', bgcolor: TOSS.bg, display: 'grid', gap: 0.75,
              gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', maxHeight: 200, overflowY: 'auto' }}>
              {GALLERY.map((icon) => {
                const on = draft.imageUrl === `icon:${icon}` || (!draft.imageUrl && autoIcon(draft.name) === icon);
                return (
                  <ButtonBase key={icon} aria-label={icon} onClick={() => { setDraft((d) => ({ ...d, imageUrl: `icon:${icon}` })); setPicking(false); }}
                    sx={{ borderRadius: '12px', p: 0.75, bgcolor: on ? '#FFFFFF' : 'transparent', boxShadow: on ? `inset 0 0 0 2px ${TOSS.green}` : 'none' }}>
                    <IconifyIcon icon={`fluent-emoji:${icon}`} width={34} height={34} />
                  </ButtonBase>
                );
              })}
            </Box>
          )}

          <Stack direction="row" gap={1} mt={4}>
            <Button onClick={onClose} sx={{ ...tossSubButtonSx, py: 1.2, flex: 1 }}>취소</Button>
            <Button variant="contained" onClick={submit} disabled={saving || !draft.name.trim()} sx={{ ...tossButtonSx, py: 1.2, flex: 2 }}>
              {saving ? '저장하는 중…' : submitLabel}
            </Button>
          </Stack>
        </Box>

        {/* 미리보기: 목록에서 이렇게 보여요 */}
        <Box sx={{ order: { xs: 1, md: 2 }, p: { xs: 2.5, md: 3 }, bgcolor: '#F6F8F7', borderRadius: { xs: '24px 24px 0 0', md: '0 24px 24px 0' },
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TOSS.sub, mb: 1.5 }}>목록에서 이렇게 보여요</Typography>
          <Box sx={{ width: { xs: 160, md: 190 }, p: 1.25, borderRadius: '20px', bgcolor: '#FFFFFF', boxShadow: '0 10px 30px rgba(15,30,50,0.08)' }}>
            <IngredientImage name={draft.name} imageUrl={draft.imageUrl} />
            <Typography noWrap sx={{ fontSize: 16, fontWeight: 800, color: draft.name ? TOSS.text : TOSS.sub, mt: 1 }}>{draft.name || '식자재 이름'}</Typography>
            <Typography sx={{ fontSize: 13, color: TOSS.sub }}>{draft.unit} 단위</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: TOSS.sub, mt: 1.5 }}>사진: {imageMode}</Typography>
        </Box>
      </Box>
    </Dialog>
  );
};

export default IngredientDialog;
