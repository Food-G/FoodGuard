import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography, useTheme,
} from '@mui/material';
import { discountService, errorText, ClearanceCandidate, ClearanceBriefing } from '../../services/agentService';

const BELOW_COST_PCT = 60;

// 유통기한 임박 식자재 소진: 남을 양과 메뉴를 보여 주고 점주가 메뉴별 할인율을 정한다. POS 결제에 바로 적용된다
const ClearanceCard = ({ storeId, onChanged }: { storeId: number; onChanged?: () => void }) => {
  const theme = useTheme();
  const [candidates, setCandidates] = useState<ClearanceCandidate[]>([]);
  const [pct, setPct] = useState<Record<string, string>>({});
  const [briefing, setBriefing] = useState<ClearanceBriefing | null>(null);
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () => discountService.candidates(storeId).then(setCandidates).catch((e) => setError(errorText(e, '소진 후보를 불러오지 못했습니다.')));
  useEffect(() => { load(); }, [storeId]);

  const apply = async (c: ClearanceCandidate, menuId: number) => {
    const key = `${c.ingredientId}-${menuId}`;
    setSaving(key);
    setError('');
    try {
      await discountService.apply({ storeId, menuId, ingredientId: c.ingredientId, discountPct: Number(pct[key]), endDate: c.expiryDate });
      await load();
      onChanged?.();
    } catch (e) {
      setError(errorText(e, '할인을 적용하지 못했습니다.'));
    } finally {
      setSaving(null);
    }
  };

  const end = async (id: number) => {
    setError('');
    try {
      await discountService.end(id);
      await load();
      onChanged?.();
    } catch (e) {
      setError(errorText(e, '할인을 끝내지 못했습니다.'));
    }
  };

  const brief = async () => {
    setBriefingBusy(true);
    setError('');
    try {
      setBriefing(await discountService.briefing(storeId));
    } catch (e) {
      setError(errorText(e, 'AI 정리를 받지 못했습니다.'));
    } finally {
      setBriefingBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} gap={1} flexWrap="wrap">
        <Typography variant="h6" fontWeight={700}>임박 식자재 할인 소진</Typography>
        <Button size="small" variant="outlined" disabled={briefingBusy || candidates.length === 0} onClick={brief}
          startIcon={briefingBusy ? <CircularProgress size={14} /> : null}>
          {briefingBusy ? 'AI 정리 중...' : 'AI로 우선순위 정리'}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={2}>
        7일 안에 기한이 끝나고 예측 판매로도 남을 식자재입니다. 할인율은 점주가 정하며, 저장하면 기한까지 POS 가격에 적용됩니다.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {briefing && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          {briefing.summary}
          {briefing.unverifiedNumbers?.length > 0 && <Typography variant="caption" display="block" mt={0.5}>후보 계산에 없는 숫자: {briefing.unverifiedNumbers.join(', ')}. 아래 수치를 기준으로 보세요.</Typography>}
        </Alert>
      )}
      {candidates.length === 0 && <Typography variant="body2" color="text.secondary">지금 소진이 필요한 식자재가 없습니다. 유통기한이 입력된 재고만 확인할 수 있습니다.</Typography>}
      <Stack gap={2}>
        {candidates.map((c) => {
          const advice = briefing?.items.find((i) => i.ingredientId === c.ingredientId);
          return (
            <Paper key={c.ingredientId} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                <Typography fontWeight={700}>{c.ingredientName}</Typography>
                <Chip size="small" color={c.daysLeft <= 1 ? 'error' : 'warning'} label={`D-${c.daysLeft} (${c.expiryDate})`} />
                <Typography variant="body2" color="text.secondary">
                  재고 {c.stock}{c.unit}, {c.forecastAvailable ? `예측 사용 ${c.expectedUsage}${c.unit}, ` : '예측 없음, '}남을 양 <b>{c.surplus}{c.unit}</b>
                </Typography>
              </Stack>
              {advice && <Typography variant="body2" color="primary.dark" mb={1}>{advice.advice}</Typography>}
              {c.menus.length === 0 && <Typography variant="caption" color="text.secondary">이 식자재를 쓰는 활성 메뉴가 없어 할인으로 소진할 수 없습니다. 기부를 검토해 주세요.</Typography>}
              <Stack gap={1} mt={1}>
                {c.menus.map((m) => {
                  const key = `${c.ingredientId}-${m.menuId}`;
                  const value = Number(pct[key]);
                  const valid = Number.isInteger(value) && value >= 1 && value <= 90;
                  return (
                    <Stack key={key} direction="row" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="body2" sx={{ minWidth: 130 }}>{m.menuName} ₩{m.price.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 150 }}>이 메뉴로만 소진하면 {m.extraUnitsToClear}개 더 판매</Typography>
                      {m.activeDiscountPct != null ? (
                        <>
                          <Chip size="small" color="primary" label={`${m.activeDiscountPct}% 할인 중 (~${m.activeEndDate})`} />
                          <Button size="small" onClick={() => end(m.activeDiscountId!)}>끝내기</Button>
                        </>
                      ) : (
                        <>
                          <TextField size="small" type="number" label="할인율 %" value={pct[key] ?? ''} sx={{ width: 100 }}
                            inputProps={{ min: 1, max: 90 }} onChange={(e) => setPct({ ...pct, [key]: e.target.value })} />
                          <Button size="small" variant="contained" disabled={!valid || saving === key} onClick={() => apply(c, m.menuId)}>적용</Button>
                          {valid && <Typography variant="caption" color={value > BELOW_COST_PCT ? 'error' : 'text.secondary'}>
                            약 ₩{(Math.round(m.price * (100 - value) / 1000) * 10).toLocaleString()}
                            {value > BELOW_COST_PCT && ' (원가 추정치 40% 밑)'}
                          </Typography>}
                        </>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Paper>
  );
};

export default ClearanceCard;
