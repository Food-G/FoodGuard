import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Typography, Paper, Button, Stack, useTheme, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { donationService } from '../services/donationService';
import { wastePredictionService } from '../services/wastePredictionService';
import { inventoryService } from '../services/inventoryService';
import { errorText } from '../services/agentService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';

const ORG_TYPES = [
  { value: 'ORPHANAGE', label: '고아원' },
  { value: 'NURSING_HOME', label: '양로원' },
  { value: 'FOOD_BANK', label: '푸드뱅크' },
  { value: 'OTHER', label: '기타' },
];

const DONATION_TYPES = [
  { value: 'FOOD', label: '음식 (조리 후 기부)' },
  { value: 'INGREDIENT', label: '식재료 (원재료 기부)' },
];

const orgTypeLabel = (value: string) => ORG_TYPES.find((t) => t.value === value)?.label ?? value;

const EMPTY_FORM = { donationType: 'INGREDIENT', orgName: '', orgType: 'FOOD_BANK', orgContact: '', quantity: '', description: '' };

interface Candidate {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  currentQty: number;
  donatableQty: number;
  wastePrediction: number;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

// 기부: 재고에서 기부할 식재료를 골라 등록하고, 진행 중인 기부를 완료·취소한다 (완료해야 재고가 줄어든다)
const Donations = ({ user }: any) => {
  const theme = useTheme();
  const location = useLocation();
  const confirm = useConfirm();
  const { storeId, storeLoading } = useMyStore(user);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [planned, setPlanned] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [target, setTarget] = useState<Candidate | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async (sid: number) => {
    try {
      const [inventory, waste, donations] = await Promise.all([
        inventoryService.getByStore(sid), wastePredictionService.predict(sid), donationService.getByStore(sid),
      ]);
      const wasteById = new Map((waste ?? []).map((w: any) => [w.ingredientId, w]));
      const list: Candidate[] = (inventory ?? []).map((inv: any): Candidate => {
        const w: any = wasteById.get(inv.ingredient?.id);
        return {
          ingredientId: inv.ingredient?.id,
          ingredientName: inv.ingredient?.name ?? '',
          unit: inv.ingredient?.unit ?? '',
          currentQty: Number(inv.currentQty ?? 0),
          donatableQty: w ? w.donatableQty : Number(inv.currentQty ?? 0),
          wastePrediction: w ? w.wastePrediction : 0,
          expiryDate: inv.expiryDate ?? null,
          daysUntilExpiry: w ? w.daysUntilExpiry : null,
        };
      }).filter((c: Candidate) => c.donatableQty > 0);
      // 폐기될 양이 많은 것부터
      list.sort((a: Candidate, b: Candidate) => b.wastePrediction - a.wastePrediction);
      setCandidates(list);
      setPlanned((donations ?? []).filter((d: any) => d.status === 'PLANNED'));
      return list;
    } catch (e) {
      setError(errorText(e, '기부 정보를 불러오지 못했습니다.'));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    load(storeId).then((list) => {
      // 재고·폐기 화면의 기부 버튼으로 왔으면 바로 등록 창을 연다
      const wanted = (location.state as any)?.ingredientId;
      if (wanted) setTarget(list.find((c) => c.ingredientId === wanted) ?? null);
    });
  }, [storeId, storeLoading]);

  const qty = form.quantity ? Number(form.quantity) : target?.wastePrediction ?? 0;
  const qtyInvalid = target != null && (!(qty > 0) || qty > target.donatableQty);

  const closeDialog = () => { setTarget(null); setForm(EMPTY_FORM); };

  const handleDonate = async () => {
    if (!storeId || !target) return;
    try {
      await donationService.create(storeId, { ...form, ingredientId: target.ingredientId, ingredientName: target.ingredientName, quantity: qty, unit: target.unit });
      setSuccess(`${target.ingredientName} 기부를 등록했습니다.`);
      closeDialog();
      load(storeId);
    } catch (e) {
      setError(errorText(e, '기부 등록에 실패했습니다.'));
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await donationService.complete(id);
      setSuccess('기부를 완료 처리했습니다. 재고에서 차감했습니다.');
      if (storeId) load(storeId);
    } catch (e) {
      setError(errorText(e, '완료 처리에 실패했습니다.'));
    }
  };

  const handleCancel = async (id: number) => {
    if (!await confirm('기부를 취소하시겠습니까?')) return;
    try {
      await donationService.cancel(id);
      setSuccess('기부를 취소했습니다.');
      if (storeId) load(storeId);
    } catch (e) {
      setError(errorText(e, '취소 처리에 실패했습니다.'));
    }
  };

  if (loading) return <Stack alignItems="center" py={8}><CircularProgress /></Stack>;

  return (
    <Stack gap={3}>
      <AlertMessages error={error} success={success} onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={2}>진행 중인 기부</Typography>
        {planned.length === 0 ? (
          <Typography variant="body2" color="text.secondary">진행 중인 기부가 없습니다.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>식재료</TableCell>
                  <TableCell>기관</TableCell>
                  <TableCell align="right">수량</TableCell>
                  <TableCell align="right">처리</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {planned.map((d) => (
                  <TableRow key={d.id} hover>
                    <TableCell>{d.ingredientName ?? '-'}</TableCell>
                    <TableCell>{d.orgName} <Typography component="span" variant="caption" color="text.secondary">{orgTypeLabel(d.orgType)}</Typography></TableCell>
                    <TableCell align="right">{d.quantity} {d.unit}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="success" onClick={() => handleComplete(d.id)} sx={{ mr: 0.5 }}>완료</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleCancel(d.id)}>취소</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
        <Typography variant="h6" fontWeight={700} mb={0.5}>기부할 식재료 선택</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>폐기가 예상되는 식재료부터 보여 줍니다.</Typography>
        {candidates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">기부할 수 있는 재고가 없습니다.</Typography>
        ) : (
          <TableContainer sx={{ maxHeight: 460 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>식재료</TableCell>
                  <TableCell align="right">기부 가능</TableCell>
                  <TableCell>유통기한</TableCell>
                  <TableCell align="right">폐기 예측</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.ingredientId} hover>
                    <TableCell>{c.ingredientName}</TableCell>
                    <TableCell align="right">{c.donatableQty} {c.unit}</TableCell>
                    <TableCell>
                      {c.expiryDate
                        ? <Chip size="small" variant="outlined" color={(c.daysUntilExpiry ?? 99) <= 3 ? 'error' : 'default'} label={c.expiryDate} />
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {c.wastePrediction > 0
                        ? <Typography variant="body2" color="error.main" fontWeight={700}>{c.wastePrediction} {c.unit}</Typography>
                        : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" color="secondary" onClick={() => setTarget(c)}
                        startIcon={<IconifyIcon icon="mingcute:heart-fill" width={14} />}>
                        기부 등록
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!target} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>기부 등록 — {target?.ingredientName}</DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            {target && target.wastePrediction > 0 && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                예측 폐기량: <strong>{target.wastePrediction} {target.unit}</strong> (유통기한 {target.expiryDate})
              </Alert>
            )}
            <TextField select label="기부 유형" value={form.donationType} size="small" fullWidth
              onChange={(e) => setForm((f) => ({ ...f, donationType: e.target.value }))}>
              {DONATION_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="기관 유형" value={form.orgType} size="small" fullWidth
              onChange={(e) => setForm((f) => ({ ...f, orgType: e.target.value }))}>
              {ORG_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField label="기관명" required value={form.orgName} size="small" fullWidth
              onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))} />
            <TextField label="연락처 (선택)" value={form.orgContact} size="small" fullWidth
              onChange={(e) => setForm((f) => ({ ...f, orgContact: e.target.value }))} />
            <TextField label={`기부 수량 (${target?.unit ?? ''})`} type="number" value={form.quantity} size="small" fullWidth
              placeholder={target && target.wastePrediction > 0 ? String(target.wastePrediction) : ''}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              error={qtyInvalid}
              helperText={`기부 가능 수량: ${target?.donatableQty ?? 0} ${target?.unit ?? ''} (재고 - 이미 기부 예정인 양)`} />
            <TextField label="메모 (선택)" value={form.description} size="small" fullWidth multiline rows={2}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>취소</Button>
          <Button variant="contained" color="secondary" onClick={handleDonate} disabled={!form.orgName || qtyInvalid}>기부 등록</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default Donations;
