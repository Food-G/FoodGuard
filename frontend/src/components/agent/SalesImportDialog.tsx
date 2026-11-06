import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Typography, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, MenuItem, Checkbox, Chip,
} from '@mui/material';
import { agentService, errorText, fileToBase64, SalesImportRow } from '../../services/agentService';

interface Props {
  open: boolean;
  storeId: number;
  menus: { id: number; menuName: string }[];
  onClose: () => void;
  onSaved: () => void;
}

type Row = SalesImportRow & { checked: boolean };

// POS 판매 파일 → AI 가 열 의미와 메뉴명을 맞춤 → 점주 확인 → 저장. 수량·날짜는 파일 값을 코드가 읽는다
const SalesImportDialog = ({ open, storeId, menus, onClose, onSaved }: Props) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [skipped, setSkipped] = useState<Record<string, number>>({});
  const [defaultDate, setDefaultDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setRows(null); setSkipped({}); setError(''); };
  const close = () => { reset(); onClose(); };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res = await agentService.previewSales(storeId, {
        filename: file.name,
        contentBase64: await fileToBase64(file),
        ...(defaultDate ? { defaultDate } : {}),
      });
      setRows(res.rows.map((r: SalesImportRow) => ({ ...r, checked: r.menuId != null && !r.alreadyEntered })));
      setSkipped(res.skipped ?? {});
    } catch (e) {
      setError(errorText(e, '파일을 해석하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((prev) => prev!.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const selected = rows?.filter((r) => r.checked && r.menuId != null) ?? [];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await agentService.commitSales(storeId, selected.map((r) => ({ menuId: r.menuId!, saleDate: r.saleDate, quantity: r.quantity })));
      onSaved();
      close();
    } catch (e) {
      setError(errorText(e, '저장하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const skippedTotal = Object.values(skipped).reduce((a, b) => a + b, 0);

  return (
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={700}>POS 판매 파일로 등록</DialogTitle>
      <DialogContent>
        <Stack gap={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {!rows && (
            <>
              <Typography variant="body2" color="text.secondary">
                POS에서 내보낸 CSV 또는 엑셀(XLSX) 파일을 올리면 AI가 형식을 파악합니다. 파일의 처음 15행과 메뉴명만 AI에 전달하고, 저장은 확인 후에 합니다.
              </Typography>
              <TextField
                type="date" label="판매 일자 (파일에 날짜가 없을 때만)" InputLabelProps={{ shrink: true }}
                value={defaultDate} onChange={(e) => setDefaultDate(e.target.value)} sx={{ maxWidth: 320 }}
              />
              <Button component="label" variant="outlined" disabled={busy} sx={{ alignSelf: 'flex-start' }}
                startIcon={busy ? <CircularProgress size={16} /> : null}>
                {busy ? 'AI 분석 중 (10~30초)...' : '파일 선택'}
                <input hidden type="file" accept=".csv,.txt,.xlsx" onChange={(e) => handleFile(e.target.files?.[0])} />
              </Button>
            </>
          )}
          {rows && (
            <>
              {rows.length === 0 && <Alert severity="warning">등록할 판매 행을 찾지 못했습니다.</Alert>}
              {skippedTotal > 0 && (
                <Alert severity="warning">
                  읽지 못해 뺀 행 {skippedTotal}개: {Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ')}
                </Alert>
              )}
              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>일자</TableCell>
                      <TableCell>파일의 메뉴명</TableCell>
                      <TableCell>우리 메뉴</TableCell>
                      <TableCell align="right">수량</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={`${r.saleDate}-${r.rawName}`}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={r.checked} disabled={r.menuId == null} onChange={(e) => update(i, { checked: e.target.checked })} />
                        </TableCell>
                        <TableCell>{r.saleDate}</TableCell>
                        <TableCell>
                          {r.rawName}
                          {r.alreadyEntered && <Chip size="small" color="warning" variant="outlined" label="이미 입력됨" sx={{ ml: 1 }} />}
                        </TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <TextField
                            select size="small" fullWidth value={r.menuId ?? ''}
                            onChange={(e) => update(i, { menuId: Number(e.target.value), checked: !r.alreadyEntered })}
                          >
                            {menus.map((m) => <MenuItem key={m.id} value={m.id}>{m.menuName}</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell align="right">{r.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary">
                메뉴를 못 맞춘 행(합계·할인 등)은 저장하지 않습니다. 이미 입력된 날짜·메뉴는 저장 때 건너뜁니다.
              </Typography>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {rows && <Button onClick={reset}>다른 파일</Button>}
        <Button onClick={close}>닫기</Button>
        {rows && <Button variant="contained" disabled={busy || selected.length === 0} onClick={save}>{selected.length}건 저장</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default SalesImportDialog;
