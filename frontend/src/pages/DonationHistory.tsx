import { useEffect, useState } from 'react';
import { Typography, Box, Button, Stack, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { TOSS, TossPage, BigStat, Segmented, ListRow, EmptyState, tossButtonSx, TwoColumn, SidePanel, PanelTitle, BarRow, StackedBar } from '../components/TossUI';
import { donationService } from '../services/donationService';
import { useMyStore } from '../hooks/useMyStore';
import { useConfirm } from '../hooks/useConfirm';
import AlertMessages from '../components/AlertMessages';

const STATUS_LABEL: Record<string, string> = {
  PLANNED: '기부 예정',
  COMPLETED: '기부 완료',
  CANCELLED: '취소됨',
};
const ORG_TYPE_LABEL: Record<string, string> = {
  ORPHANAGE: '고아원',
  NURSING_HOME: '양로원',
  FOOD_BANK: '푸드뱅크',
  OTHER: '기타',
};
const DONATION_TYPE_LABEL: Record<string, string> = {
  FOOD: '음식',
  INGREDIENT: '식재료',
};

const DonationHistory = ({ user }: any) => {
  const navigate = useNavigate();
  const { storeId, storeLoading } = useMyStore(user);
  const confirm = useConfirm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (sid: number) => {
    try {
      const data = await donationService.getByStore(sid);
      setRows((data ?? []).map((item: any) => ({ ...item, id: item.id })));
    } catch {
      setError('기부 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!storeId) { if (!storeLoading) setLoading(false); return; }
    load(storeId);
  }, [storeId, storeLoading]);

  const handleComplete = async (id: number) => {
    try {
      await donationService.complete(id);
      setSuccess('기부가 완료 처리되었습니다. 재고에서 차감되었습니다.');
      if (storeId) await load(storeId);
    } catch (e) {
      setError((e as Error)?.message || '완료 처리에 실패했습니다.');
    }
  };

  const handleCancel = async (id: number) => {
    if (!await confirm('기부를 취소하시겠습니까?')) return;
    try {
      await donationService.cancel(id);
      setSuccess('기부가 취소되었습니다.');
      if (storeId) await load(storeId);
    } catch {
      setError('취소 처리에 실패했습니다.');
    }
  };

  const [filter, setFilter] = useState<'ALL' | 'PLANNED' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const shown = rows
    .filter((r) => filter === 'ALL' || r.status === filter)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
  const STATUS_TEXT_COLOR: Record<string, string> = { PLANNED: '#F59F00', COMPLETED: '#1D9E75', CANCELLED: TOSS.sub };

  // 기부 성과 (완료된 기부 기준): 단위별로 나눈 양, 많이 나눈 식자재, 함께한 기관
  const completed = rows.filter((r) => r.status === 'COMPLETED');
  const sumBy = (key: (r: any) => string) => {
    const m = new Map<string, number>();
    for (const r of completed) if (r.quantity) m.set(key(r), (m.get(key(r)) ?? 0) + Number(r.quantity));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byUnit = sumBy((r) => r.unit ?? '');
  const byIngredient = sumBy((r) => `${r.ingredientName ?? '기타'}|${r.unit ?? ''}`);
  const orgs = new Map<string, number>();
  for (const r of completed) orgs.set(r.orgName, (orgs.get(r.orgName) ?? 0) + 1);
  const topOrgs = [...orgs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const fmt = (v: number, unit: string) => `${unit === '개' ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;

  const side = (
    <SidePanel>
      <BigStat label="이웃과 나눈 기부" value={loading ? '…' : `${completed.length}건`} color="#1D9E75" />
      <Typography sx={{ fontSize: 14, color: TOSS.sub, mt: 0.75 }}>
        {loading ? '' : byUnit.length > 0 ? `${byUnit.map(([u, v]) => fmt(v, u)).join(' · ')} 나눴어요` : '완료한 기부가 아직 없어요'}
      </Typography>

      {!loading && rows.length > 0 && (
        <>
          <PanelTitle right={`전체 ${rows.length}건`}>진행 상태</PanelTitle>
          <StackedBar parts={[
            { label: '완료', value: count('COMPLETED'), color: '#1D9E75' },
            { label: '진행 중', value: count('PLANNED'), color: '#F59F00' },
            { label: '취소', value: count('CANCELLED'), color: '#C9CED6' },
          ]} />
        </>
      )}

      {!loading && byIngredient.length > 0 && (
        <>
          <PanelTitle>많이 나눈 식자재</PanelTitle>
          {byIngredient.slice(0, 4).map(([key, v]) => {
            const [name, unit] = key.split('|');
            const maxSameUnit = Math.max(...byIngredient.filter(([k]) => k.endsWith(`|${unit}`)).map(([, x]) => x));
            return <BarRow key={key} label={name} value={fmt(v, unit)} ratio={maxSameUnit ? v / maxSameUnit : 0} />;
          })}
        </>
      )}

      {!loading && topOrgs.length > 0 && (
        <>
          <PanelTitle>함께한 기관</PanelTitle>
          {topOrgs.map(([name, n]) => (
            <ListRow key={name} icon="mingcute:hand-heart-line" iconColor="#1D9E75" title={name} right={`${n}건`} />
          ))}
        </>
      )}

      <Button fullWidth variant="contained" onClick={() => navigate('/waste-prediction')} sx={{ ...tossButtonSx, py: 1.1, fontSize: 15, mt: 3 }}>
        남을 식자재 기부하기
      </Button>
    </SidePanel>
  );

  const main = (
    <Box>
      <AlertMessages error={error} success={success}
        onClearError={() => setError('')} onClearSuccess={() => setSuccess('')} />
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: TOSS.text, mb: 1.5, letterSpacing: '-0.02em' }}>기부 내역</Typography>
      <Segmented value={filter} onChange={setFilter} options={[
        { value: 'ALL', label: '전체' }, { value: 'PLANNED', label: '진행 중' },
        { value: 'COMPLETED', label: '완료' }, { value: 'CANCELLED', label: '취소' },
      ]} />
      <Box mt={1}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : shown.length === 0 ? (
          <EmptyState icon="mingcute:hand-heart-line"
            title={rows.length === 0 ? '아직 기부한 내역이 없어요' : '이 상태의 기부가 없어요'}
            desc={rows.length === 0 ? '폐기 예측에서 남을 식자재를 골라 이웃에게 나눠 보세요.' : undefined} />
        ) : shown.map((r) => (
          <Box key={r.id}>
            <ListRow icon="mingcute:heart-line" iconColor={STATUS_TEXT_COLOR[r.status] ?? TOSS.sub}
              title={r.orgName}
              desc={[
                r.ingredientName && r.quantity ? `${r.ingredientName} ${r.quantity}${r.unit ?? ''}` : r.ingredientName,
                DONATION_TYPE_LABEL[r.donationType] ?? r.donationType,
                ORG_TYPE_LABEL[r.orgType] ?? r.orgType,
                r.createdAt ? new Date(r.createdAt).toLocaleDateString() : null,
              ].filter(Boolean).join(' · ')}
              right={<Typography component="span" sx={{ fontSize: 15, fontWeight: 700, color: STATUS_TEXT_COLOR[r.status] ?? TOSS.sub }}>
                {STATUS_LABEL[r.status] ?? r.status}
              </Typography>} />
            {r.status === 'PLANNED' && (
              <Stack direction="row" gap={1} sx={{ pl: 7, pb: 1.5 }}>
                <Button size="small" onClick={() => handleComplete(r.id)}
                  sx={{ borderRadius: '8px', fontWeight: 700, bgcolor: '#E8F5F1', color: '#1D9E75', '&:hover': { bgcolor: '#D5EEE6' } }}>
                  기부 완료
                </Button>
                <Button size="small" onClick={() => handleCancel(r.id)}
                  sx={{ borderRadius: '8px', fontWeight: 700, bgcolor: TOSS.bg, color: TOSS.sub, '&:hover': { bgcolor: 'rgba(15,30,50,0.08)' } }}>
                  취소
                </Button>
              </Stack>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <TossPage wide>
      <TwoColumn main={main} side={side} />
    </TossPage>
  );
};

export default DonationHistory;
