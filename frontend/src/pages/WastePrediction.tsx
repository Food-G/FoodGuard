import { useEffect, useState } from 'react';
import {
  Typography, Box, Button, CircularProgress, Stack, useTheme, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TOSS, TossPage, BigStat, ListRow, EmptyState, tossButtonSx, tossSubButtonSx, TwoColumn, SidePanel, PanelTitle, BarRow, StackedBar } from '../components/TossUI';
import { wastePredictionService } from '../services/wastePredictionService';
import { donationService } from '../services/donationService';
import IconifyIcon from '../components/base/IconifyIcon';
import { useMyStore } from '../hooks/useMyStore';
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

const WastePrediction = ({ user }: any) => {
  const theme = useTheme();
  const { storeId, storeLoading } = useMyStore(user);
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [donationTarget, setDonationTarget] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [donationForm, setDonationForm] = useState({
    donationType: 'INGREDIENT',
    orgName: '',
    orgType: 'FOOD_BANK',
    orgContact: '',
    quantity: '',
    description: '',
  });

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    wastePredictionService.predict(storeId)
      .then((data: any[]) => setRows((data ?? []).map((item: any, idx: number) => ({ ...item, id: item.inventoryId ?? idx }))))
      .catch(() => setError('폐기 예측 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [storeId, storeLoading]);

  // 목록을 못 불러와도(008 적용 전 등) 기관을 직접 입력해 등록할 수 있다
  const openDonation = (row: any) => {
    setDonationTarget(row);
    setOrgs([]);
    if (!storeId) return;
    donationService.getOrgs(storeId, row.category).then((data: any[]) => setOrgs(data ?? [])).catch(() => setOrgs([]));
  };

  const selectOrg = (orgId: string) => {
    const org = orgs.find((o) => String(o.id) === orgId);
    if (org) setDonationForm((f) => ({ ...f, orgName: org.orgName, orgType: org.orgType, orgContact: org.contact ?? '' }));
  };

  const handleDonate = async () => {
    if (!storeId || !donationTarget) return;
    try {
      await donationService.create(storeId, {
        ...donationForm,
        ingredientId: donationTarget.ingredientId,
        ingredientName: donationTarget.ingredientName,
        quantity: donationForm.quantity ? Number(donationForm.quantity) : donationTarget.wastePrediction,
        unit: donationTarget.unit,
      });
      setSuccess(`${donationTarget.ingredientName} 기부 등록이 완료되었습니다.`);
      setDonationTarget(null);
      setDonationForm({ donationType: 'INGREDIENT', orgName: '', orgType: 'FOOD_BANK', orgContact: '', quantity: '', description: '' });
    } catch (e) {
      setDonationTarget(null);
      setError((e as Error)?.message || '기부 등록에 실패했습니다.');
    }
  };

  // 버려질 양이 많은 것부터, 같으면 기한이 급한 것부터
  const sorted = [...rows].sort((a, b) => (b.wastePrediction - a.wastePrediction) || (a.daysUntilExpiry - b.daysUntilExpiry));
  const wasteItems = rows.filter(r => r.wastePrediction > 0);
  const dLabel = (d: number) => (d < 0 ? '기한 지남' : d === 0 ? '오늘까지' : `D-${d}`);
  // 개는 정수, kg·L 는 소수 첫째 자리까지
  const q = (v: number, unit: string) => `${unit === '개' ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;

  // 기한 긴급도 (식품 폐기 관리 도구들이 쓰는 3단계)
  const urgent = rows.filter((r) => r.daysUntilExpiry <= 3).length;
  const soon = rows.filter((r) => r.daysUntilExpiry > 3 && r.daysUntilExpiry <= 7).length;
  const later = rows.length - urgent - soon;
  const topWaste = [...wasteItems].sort((a, b) => b.wastePrediction / Math.max(b.currentQty, 1e-9) - a.wastePrediction / Math.max(a.currentQty, 1e-9)).slice(0, 4);
  const riskColor = wasteItems.length > 0 ? TOSS.red : TOSS.green;

  const side = (
    <SidePanel glow={riskColor}>
      <BigStat label="7일 안에 다 못 쓰고 버려질 식자재"
        value={loading ? '…' : `${wasteItems.length}개`} color={wasteItems.length > 0 ? TOSS.red : undefined} />
      <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
        {loading ? '' : wasteItems.length > 0
          ? '할인 판매나 기부로 줄일 수 있어요. 에이전트가 방법을 먼저 제안해요.'
          : '지금은 버려질 걱정이 없어요.'}
      </Typography>

      {!loading && rows.length > 0 && (
        <>
          <PanelTitle right={`${rows.length}개 식자재`}>유통기한까지</PanelTitle>
          <StackedBar parts={[
            { label: '3일 이내', value: urgent, color: TOSS.red },
            { label: '7일 이내', value: soon, color: '#F59F00' },
            { label: '여유', value: later, color: TOSS.green },
          ]} />
        </>
      )}

      {!loading && topWaste.length > 0 && (
        <>
          <PanelTitle right="재고 대비">남을 양</PanelTitle>
          {topWaste.map((r) => (
            <BarRow key={r.id} label={`${r.ingredientName} · ${dLabel(r.daysUntilExpiry)}`} value={q(r.wastePrediction, r.unit)}
              ratio={r.currentQty ? r.wastePrediction / r.currentQty : 0} color={TOSS.red} />
          ))}
        </>
      )}

      <Stack direction="row" gap={1} mt={3}>
        <Button variant="contained" onClick={() => navigate('/agent-inbox?agent=waste')}
          startIcon={<IconifyIcon icon="mingcute:robot-line" width={18} />} sx={{ ...tossButtonSx, py: 1.1, fontSize: 15, flex: 1 }}>
          에이전트 제안
        </Button>
        <Button onClick={() => navigate('/donations')} sx={{ ...tossSubButtonSx, py: 1.1, fontSize: 15, flex: 1, bgcolor: '#FFFFFF' }}>
          기부 이력
        </Button>
      </Stack>
    </SidePanel>
  );

  const main = (
    <Box>
      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, mb: 1, letterSpacing: '-0.02em' }}>식자재별 폐기 예측</Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : sorted.length === 0 ? (
        <EmptyState icon="mingcute:leaf-line" title="유통기한이 있는 재고가 없어요"
          desc="보관일수가 정해진 식자재가 입고되면 언제 얼마나 버려질지 미리 알려 드려요."
          action={<Button variant="outlined" sx={{ borderRadius: '12px' }} onClick={() => navigate('/inventory')}>재고 현황 보기</Button>} />
      ) : sorted.map((r) => {
        const waste = r.wastePrediction > 0;
        const color = !waste ? '#1D9E75' : r.riskLevel === 'HIGH' ? TOSS.red : '#F59F00';
        // 기한이 오늘이거나 지난 식자재는 기부할 수 없다 (식품 안전)
        const donatable = waste && r.daysUntilExpiry >= 1;
        return (
          <ListRow key={r.id} icon={waste ? 'mingcute:alert-line' : 'mingcute:check-circle-line'} iconColor={color}
            title={r.ingredientName}
            desc={`${dLabel(r.daysUntilExpiry)} · 재고 ${q(r.currentQty, r.unit)} · 7일 사용 ${q(r.expectedConsumption, r.unit)}`}
            right={<Typography component="span" sx={{ fontSize: 16, fontWeight: 700, color: waste ? TOSS.red : TOSS.sub }}>
              {waste ? `${q(r.wastePrediction, r.unit)} 남아요` : '다 쓸 수 있어요'}
            </Typography>}
            rightSub={donatable ? (
              <Button size="small" onClick={() => openDonation(r)}
                sx={{ mt: 0.5, borderRadius: '8px', px: 1.25, py: 0.25, minWidth: 0, fontSize: 13, fontWeight: 700, bgcolor: '#FFF0F1', color: TOSS.red, '&:hover': { bgcolor: '#FFE3E5' } }}>
                기부하기
              </Button>
            ) : waste ? `폐기율 ${r.wasteRate}%` : undefined} />
        );
      })}
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />

      {/* 기부 등록 다이얼로그 */}
      <Dialog open={!!donationTarget} onClose={() => setDonationTarget(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: TOSS.radius, p: 1, bgcolor: '#FFFFFF', backgroundImage: 'none', backdropFilter: 'none' } }}>
        <DialogTitle>
          <Stack direction="row" gap={1} alignItems="center">
            <IconifyIcon icon="mingcute:heart-fill" color={theme.palette.secondary.main} width={20} />
            기부 등록 — {donationTarget?.ingredientName}
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} pt={1}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              예측 폐기량: <strong>{donationTarget?.wastePrediction} {donationTarget?.unit}</strong>
              (유통기한: {donationTarget?.expiryDate}, D-{donationTarget?.daysUntilExpiry})
            </Alert>
            {orgs.length > 0 && (
              <TextField select label="기부처 목록에서 선택" defaultValue=""
                onChange={(e) => selectOrg(e.target.value)} size="small" fullWidth>
                {orgs.map(o => <MenuItem key={o.id} value={String(o.id)}>{o.orgName} ({o.region})</MenuItem>)}
              </TextField>
            )}
            <TextField select label="기부 유형" value={donationForm.donationType}
              onChange={(e) => setDonationForm(f => ({ ...f, donationType: e.target.value }))} size="small" fullWidth>
              {DONATION_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="기관 유형" value={donationForm.orgType}
              onChange={(e) => setDonationForm(f => ({ ...f, orgType: e.target.value }))} size="small" fullWidth>
              {ORG_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField label="기관명" value={donationForm.orgName} required
              onChange={(e) => setDonationForm(f => ({ ...f, orgName: e.target.value }))} size="small" fullWidth />
            <TextField label="연락처 (선택)" value={donationForm.orgContact}
              onChange={(e) => setDonationForm(f => ({ ...f, orgContact: e.target.value }))} size="small" fullWidth />
            <TextField
              label={`기부 수량 (${donationTarget?.unit ?? ''})`}
              value={donationForm.quantity}
              placeholder={`${donationTarget?.wastePrediction}`}
              onChange={(e) => setDonationForm(f => ({ ...f, quantity: e.target.value }))}
              size="small" fullWidth type="number"
            />
            <TextField label="메모 (선택)" value={donationForm.description}
              onChange={(e) => setDonationForm(f => ({ ...f, description: e.target.value }))}
              size="small" fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setDonationTarget(null)}
            sx={{ ...tossSubButtonSx, py: 1.1, px: 3, fontSize: 15 }}>취소</Button>
          <Button variant="contained" onClick={handleDonate} disabled={!donationForm.orgName}
            sx={{ ...tossButtonSx, py: 1.1, px: 3, fontSize: 15 }}>
            기부 등록
          </Button>
        </DialogActions>
      </Dialog>
    </TossPage>
  );
};

export default WastePrediction;
