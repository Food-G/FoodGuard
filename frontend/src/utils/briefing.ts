// "오늘의 에이전트 브리핑" 계산 (DEV_ROADMAP IN-1). 화면 없이 검증할 수 있게 순수 함수로 둔다.
// 입력이 null 이면 조회에 실패한 것이다. 0 건과 구분해서 "확인 불가"로 보여줘야
// 마이그레이션 전이나 서비스가 꺼졌을 때 위험이 없는 것처럼 보이지 않는다.

export type Tone = 'attention' | 'ok' | 'unknown';

export interface BriefingCard {
  title: string;
  value: string;
  sub: string;
  tone: Tone;
  to: string;
}

const UNKNOWN = '확인 불가';
const inbox = (agents: string) => `/agent-inbox?agent=${agents}`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const qty = (v: number) => String(Math.round(v * 10) / 10);

const pendingOf = (proposals: any[], type: string) => proposals.filter((p) => p.type === type && p.status === 'PENDING');

/** 단위가 섞여 있어 합치지 않고 단위별로 보여준다. */
export const totalByUnit = (items: any[]): string => {
  const sums = new Map<string, number>();
  items.forEach((i) => sums.set(i.unit, (sums.get(i.unit) ?? 0) + Number(i.orderQty)));
  return [...sums.entries()].map(([unit, sum]) => `${qty(sum)}${unit}`).join(', ');
};

export const orderPlanCard = (proposals: any[] | null): BriefingCard => {
  const base = { title: '발주안', to: inbox('order_advisor') };
  if (!proposals) return { ...base, value: UNKNOWN, sub: 'AI 승인함을 불러오지 못했습니다', tone: 'unknown' };
  const plans = pendingOf(proposals, 'ORDER_CREATE');
  const items = plans.flatMap((p) => p.payload?.items ?? []);
  return {
    ...base,
    value: `승인 대기 ${plans.length}건`,
    sub: plans.length ? `총 발주량 ${totalByUnit(items)}` : '오늘 승인할 발주안이 없습니다',
    tone: plans.length ? 'attention' : 'ok',
  };
};

export const wasteCard = (summary: any | null, proposals: any[] | null): BriefingCard => {
  const base = { title: '폐기 위험', to: inbox('waste,donation') };
  if (!summary) return { ...base, value: UNKNOWN, sub: '폐기 예측을 불러오지 못했습니다', tone: 'unknown' };
  const donations = proposals ? `기부 제안 ${pendingOf(proposals, 'DONATION_CREATE').length}건` : `기부 제안 ${UNKNOWN}`;
  return {
    ...base,
    value: `높음 ${summary.highRisk}개`,
    sub: `예상 폐기 ${qty(summary.expectedWasteKg ?? 0)}kg (kg 품목) · ${donations}`,
    tone: summary.highRisk > 0 ? 'attention' : 'ok',
  };
};

/** accuracy: 정확도 응답. error 가 no_log·no_actuals 면 조회는 됐지만 평가할 이력이 없는 것이다. */
export const forecastCard = (accuracy: any | null, proposals: any[] | null): BriefingCard => {
  const base = { title: '예측 건강도', to: inbox('mlops') };
  const promote = proposals ? `교체 제안 ${pendingOf(proposals, 'MODEL_PROMOTE').length}건` : `교체 제안 ${UNKNOWN}`;
  if (!accuracy) return { ...base, value: UNKNOWN, sub: `예측 오차를 불러오지 못했습니다 · ${promote}`, tone: 'unknown' };
  const overall = accuracy.overall;
  if (accuracy.error === 'no_log' || accuracy.error === 'no_actuals' || overall?.wape == null) {
    return { ...base, value: '평가 대기', sub: `최근 7일 대조할 판매가 없습니다 · ${promote}`, tone: 'unknown' };
  }
  const baseline = overall.baseline_wape;
  const worse = baseline != null && overall.wape > baseline;
  const hasPromote = !!proposals && pendingOf(proposals, 'MODEL_PROMOTE').length > 0;
  return {
    ...base,
    value: `최근 7일 오차 ${pct(overall.wape)}`,
    sub: `기준선 ${baseline != null ? pct(baseline) : '-'} · ${promote} · 합성 데이터 기준`,
    tone: worse || hasPromote ? 'attention' : 'ok',
  };
};

/** 진행 중인 실행은 건너뛰고 가장 최근 실행을 본다. 실패했으면 옛 결과를 믿지 않는다. */
const latestResult = (runs: any[] | null): { result: any } | null => {
  const latest = (runs ?? []).find((r) => r.status !== 'RUNNING');
  return latest?.status === 'OK' ? { result: latest.resultJson } : null;
};

export const issuesCard = (auditRuns: any[] | null, inboundRuns: any[] | null): BriefingCard => {
  const base = { title: '데이터·입고 이슈', to: inbox('audit') };
  if (!auditRuns || !inboundRuns) return { ...base, value: UNKNOWN, sub: '실행 기록을 불러오지 못했습니다', tone: 'unknown' };

  const audit = latestResult(auditRuns);
  const inbound = latestResult(inboundRuns);
  // 입고 추적은 지연이 있었던 매장만 실행하므로, 기록이 없으면 아직 지연이 없었던 것이다
  const inboundFailed = inboundRuns.length > 0 && !inbound;
  if (!audit || inboundFailed) {
    const why = auditRuns.length === 0 ? '데이터 감사가 아직 실행되지 않았습니다' : '최근 점검이 실패했습니다';
    return { ...base, value: UNKNOWN, sub: why, tone: 'unknown' };
  }
  const decision = audit.result?.decision ?? {};
  const auditHigh = (decision.findings ?? []).filter((f: any) => f.severity === 'high').length;
  const inboundHigh = (inbound?.result?.decision?.delays ?? []).filter((d: any) => d.severity === 'high').length;
  const notChecked = decision.notChecked?.length ?? 0;
  const total = auditHigh + inboundHigh;
  return {
    ...base,
    value: `심각 ${total}건`,
    sub: `데이터 ${auditHigh}건 · 입고 ${inboundHigh}건${notChecked ? ` · 미확인 점검 ${notChecked}개` : ''}`,
    tone: total > 0 ? 'attention' : notChecked ? 'unknown' : 'ok',
  };
};

// ── 본사: 매장별 위험 히트맵 ──────────────────────────────────────────

export type RiskLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface StoreRisk {
  storeId: number;
  storeName: string;
  rejectOrders: number | null;
  reviewOrders: number | null;
  wasteHigh: number | null;
  level: RiskLevel;
}

const REJECT_SCORE = 60;
const REVIEW_SCORE = 30;

/** 처리할 수 있는 승인 대기 발주의 심사 결과만 센다. 폐기 위험은 매장별 요약. null = 조회 실패. */
export const storeRisks = (
  stores: any[], orders: any[] | null, flags: any[] | null, wasteByStore: Record<number, any | null>,
): StoreRisk[] => {
  const scoreByOrder = new Map<number, number>();
  // 최신순으로 오므로 같은 발주는 가장 최근 심사를 쓴다
  (flags ?? []).forEach((p) => { if (!scoreByOrder.has(p.payload.orderId)) scoreByOrder.set(p.payload.orderId, p.payload.score); });

  const rows = stores.map((s): StoreRisk => {
    const waiting = (orders ?? []).filter((o) => o.store?.id === s.id && o.status === 'REQUESTED');
    const scores = waiting.map((o) => scoreByOrder.get(o.id)).filter((v): v is number => v !== undefined);
    const known = orders && flags;
    const rejectOrders = known ? scores.filter((v) => v >= REJECT_SCORE).length : null;
    const reviewOrders = known ? scores.filter((v) => v >= REVIEW_SCORE && v < REJECT_SCORE).length : null;
    const waste = wasteByStore[s.id];
    const wasteHigh = waste ? waste.highRisk : null;

    let level: RiskLevel = 'low';
    if ((rejectOrders ?? 0) > 0 || (wasteHigh ?? 0) > 0) level = 'high';
    else if ((reviewOrders ?? 0) > 0) level = 'medium';
    else if (rejectOrders === null || wasteHigh === null) level = 'unknown';
    return { storeId: s.id, storeName: s.storeName, rejectOrders, reviewOrders, wasteHigh, level };
  });

  const order: Record<RiskLevel, number> = { high: 0, medium: 1, unknown: 2, low: 3 };
  return rows.sort((a, b) => order[a.level] - order[b.level] || a.storeId - b.storeId);
};
