import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, MenuItem, Checkbox, Chip,
} from '@mui/material';
import { agentService, errorText, fileToBase64, InvoiceItem } from '../../services/agentService';

interface Props {
  open: boolean;
  storeId: number;
  ingredients: { id: number; name: string; unit: string }[];  // 드롭다운용 전체 목록
  onClose: () => void;
  onSaved: () => void;
}

type Row = InvoiceItem & { checked: boolean };

// 거래명세서 사진 → AI 가 품목을 읽음 → 점주가 값을 확인·수정 → 재고에 반영
const InvoiceImportDialog = ({ open, storeId, ingredients, onClose, onSaved }: Props) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setRows(null); setUnreadable([]); setError(''); };
  const close = () => { reset(); onClose(); };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res = await agentService.previewInvoice(storeId, { contentBase64: await fileToBase64(file), mediaType: file.type });
      // 단위가 다른 품목은 환산하지 않으므로 점주가 직접 고른 뒤 체크하게 둔다
      setRows(res.items.map((i: InvoiceItem) => ({ ...i, checked: i.ingredientId != null && !i.unitMismatch })));
      setUnreadable(res.unreadable ?? []);
    } catch (e) {
      setError(errorText(e, '사진을 읽지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const selected = rows?.filter((r) => r.checked && r.ingredientId != null && r.quantity > 0) ?? [];
  const unitOf = (id: number | null) => ingredients.find((x) => x.id === id)?.unit;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await agentService.commitInvoice(storeId, selected.map((r) => ({ ingredientId: r.ingredientId!, quantity: r.quantity, expiryDate: r.expiryDate || null })));
      onSaved();
      close();
    } catch (e) {
      setError(errorText(e, '저장하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>거래명세서로 입고</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          <Alert severity="warning">
            QR 검수로 이미 입고 처리한 발주는 올리지 마세요. 재고가 두 번 더해집니다.
          </Alert>
          {!rows && (
            <Button component="label" variant="outlined" disabled={busy} sx={{ alignSelf: 'flex-start' }}
              startIcon={busy ? <CircularProgress size={16} /> : null}>
              {busy ? 'AI가 읽는 중...' : '사진 선택 (PNG, JPG, WEBP)'}
              <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => handleFile(e.target.files?.[0])} />
            </Button>
          )}
          {unreadable.length > 0 && <Alert severity="warning">읽지 못한 품목: {unreadable.join(', ')}</Alert>}
          {rows && (
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>명세서 품명</TableCell>
                    <TableCell>우리 식자재</TableCell>
                    <TableCell>수량</TableCell>
                    <TableCell>유통기한</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r, i) => {
                    const mismatch = r.ingredientId != null && unitOf(r.ingredientId) !== r.unit;
                    return (
                      <TableRow key={`${r.rawName}-${i}`}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={r.checked} disabled={r.ingredientId == null} onChange={(e) => update(i, { checked: e.target.checked })} />
                        </TableCell>
                        <TableCell>{r.rawName}</TableCell>
                        <TableCell sx={{ minWidth: 170 }}>
                          <TextField select size="small" fullWidth value={r.ingredientId ?? ''}
                            onChange={(e) => update(i, { ingredientId: Number(e.target.value) })}>
                            {ingredients.map((x) => <MenuItem key={x.id} value={x.id}>{x.name} ({x.unit})</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell sx={{ minWidth: 150 }}>
                          <Stack direction="row" alignItems="center" gap={0.5}>
                            <TextField size="small" type="number" value={r.quantity} sx={{ width: 90 }}
                              onChange={(e) => update(i, { quantity: Number(e.target.value) })} />
                            <Typography variant="caption">{r.unit}</Typography>
                          </Stack>
                          {mismatch && <Chip size="small" color="warning" label={`재고 단위는 ${unitOf(r.ingredientId)}. 환산해서 입력`} sx={{ mt: 0.5 }} />}
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="date" value={r.expiryDate ?? ''} onChange={(e) => update(i, { expiryDate: e.target.value })} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {rows && <Button onClick={reset}>다른 사진</Button>}
        <Button onClick={close}>닫기</Button>
        {rows && <Button variant="contained" disabled={busy || selected.length === 0} onClick={save}>{selected.length}건 입고</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceImportDialog;
