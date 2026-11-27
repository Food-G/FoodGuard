import { api } from './api';

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

// 백엔드 GlobalExceptionHandler 의 {"error": ...} 를 꺼낸다
export const errorText = (e: any, fallback: string): string => {
  try {
    return JSON.parse(e.message).error ?? fallback;
  } catch {
    return fallback;
  }
};

export interface SalesImportRow {
  saleDate: string;
  rawName: string;
  menuId: number | null;
  quantity: number;
  alreadyEntered: boolean;
}

export interface InvoiceItem {
  rawName: string;
  ingredientId: number | null;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  unitMismatch: boolean;
}

export interface SettingSuggestion {
  ingredientId: number;
  shelfLifeDays: number;
  storage: string;
  orderCycleDays: number;
  leadTimeDays: number;
  reason: string;
  cycleSource: 'history' | 'ai';
  leadSource: 'history' | 'ai';
}

export interface OrderReview {
  summary: string;
  recommendation: 'execute' | 'revise' | 'wait';
  concerns: string[];
  items: { ingredientId: number; verdict: 'approve' | 'reduce' | 'hold'; suggestedQty: number; reason: string }[];
}

export interface WatchdogFinding {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface WeeklyReport {
  facts: {
    periodStart: string;
    periodEnd: string;
    stores: { storeId: number; storeName: string; revenue: number; previousRevenue: number; changePct: number | null; flags: string[] }[];
  };
  report: {
    headline: string;
    stores: { storeId: number; finding: string; hypothesis: string }[];
    actions: string[];
    unverifiedNumbers: string[];
  };
}

export interface ClearanceCandidate {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  stock: number;
  expiryDate: string;
  daysLeft: number;
  expectedUsage: number;
  surplus: number;
  forecastAvailable: boolean;
  menus: {
    menuId: number;
    menuName: string;
    price: number;
    extraUnitsToClear: number;
    activeDiscountPct: number | null;
    activeDiscountId: number | null;
    activeEndDate: string | null;
  }[];
}

export interface ClearanceBriefing {
  summary: string;
  items: { ingredientId: number; advice: string }[];
  unverifiedNumbers: string[];
}

export interface ActiveDiscount {
  id: number;
  menuId: number;
  menuName: string;
  price: number;
  discountPct: number;
  discountedPrice: number;
  endDate: string;
}

export interface CheckoutResult {
  total: number;
  lines: { menuId: number; menuName: string; quantity: number; unitPrice: number; listPrice: number; discountPct: number | null }[];
}

export const discountService = {
  candidates: (storeId: number): Promise<ClearanceCandidate[]> => api.get(`/discounts/store/${storeId}/candidates`),
  briefing: (storeId: number): Promise<ClearanceBriefing> => api.post(`/discounts/store/${storeId}/briefing`, {}),
  active: (storeId: number): Promise<ActiveDiscount[]> => api.get(`/discounts/store/${storeId}`),
  apply: (body: { storeId: number; menuId: number; ingredientId: number; discountPct: number; endDate: string }) => api.post('/discounts', body),
  end: (id: number) => api.delete(`/discounts/${id}`),
  checkout: (storeId: number, items: { menuId: number; quantity: number }[]): Promise<CheckoutResult> =>
    api.post(`/pos/${storeId}/checkout`, items),
};

// ── junho 에이전트 런타임 API (dev 백엔드에는 아직 없음: 실패하면 화면이 빈 상태로 보여 준다) ──
export interface AgentProposal {
  id: number;
  runId: string;
  agent: string;
  storeId: number;
  type: string;
  payload: Record<string, any>;
  rationale: string;
  fingerprint: string | null;
  status: string;
  expiresAt: string;
  decidedBy: number | null;
  decidedAt: string | null;
  execResult: Record<string, any> | null;
  createdAt: string;
}

export interface AgentRun {
  runId: string;
  agent: string;
  storeId: number | null;
  triggerType: string;
  status: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  resultJson: Record<string, any> | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ChatReply {
  runId: string;
  answer: string;
  sources: string[];
  denied: boolean;
  action: 'none' | 'order_plan';
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const q = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return q ? `?${q}` : '';
};

export const agentService = {
  previewSales: (storeId: number, body: { filename: string; contentBase64: string; defaultDate?: string }) =>
    api.post(`/ingest/${storeId}/sales/preview`, body),
  commitSales: (storeId: number, rows: { menuId: number; saleDate: string; quantity: number }[]) =>
    api.post(`/ingest/${storeId}/sales/commit`, rows),
  previewInvoice: (storeId: number, body: { contentBase64: string; mediaType: string }) =>
    api.post(`/ingest/${storeId}/invoice/preview`, body),
  commitInvoice: (storeId: number, items: { ingredientId: number; quantity: number; expiryDate: string | null }[]) =>
    api.post(`/ingest/${storeId}/invoice/commit`, items),
  suggestSettings: (storeId: number) => api.post(`/ingredients/suggest/${storeId}`, {}),
  reviewOrder: (storeId: number) => api.post(`/orders/recommend/${storeId}/review`, {}),
  agentOrder: (storeId: number, items: { ingredientId: number; quantity: number }[]) =>
    api.post(`/orders/agent/${storeId}`, items),
  watchdog: (storeId: number): Promise<WatchdogFinding[]> => api.get(`/watchdog/${storeId}`),
  weeklyReport: (): Promise<WeeklyReport> => api.post('/stats/hq/weekly-report', {}),
  ask: (storeId: number, question: string) => api.post(`/assistant/${storeId}/ask`, { question }),

  // storeId 생략 = 전 매장 (본사만)
  getProposals: async (storeId?: number | null, status?: string): Promise<AgentProposal[]> =>
    api.get(`/agent/proposals${qs({ storeId, status })}`),
  // 본사 발주 심사 결과 (승인함이 아니라 발주 목록에 병합). 상태와 무관하게 최근 200건
  getOrderFlags: async (): Promise<AgentProposal[]> =>
    (await api.get(`/agent/proposals${qs({ type: 'ORDER_FLAG' })}`) ?? []).filter((p: AgentProposal) => p.agent === 'hq_review'),
  approve: async (id: number): Promise<AgentProposal> => api.post(`/agent/proposals/${id}/approve`, {}),
  reject: async (id: number, reason: string): Promise<AgentProposal> =>
    api.post(`/agent/proposals/${id}/reject`, { reason }),
  getRuns: async (storeId?: number | null, agent?: string): Promise<AgentRun[]> => api.get(`/agent/runs${qs({ storeId, agent })}`),
  getRun: async (runId: string): Promise<AgentRun> => api.get(`/agent/runs/${runId}`),
  // Spring → agent-service 프록시. 실행은 백그라운드라 runId 만 바로 돌아온다
  run: async (agent: string, storeId: number): Promise<{ runId: string }> =>
    api.post(`/agent/run/${agent}/${storeId}`, {}),
  // Copilot. 대화 기록은 화면 상태로만 들고 있다가 요청마다 보낸다
  chat: async (body: { question: string; history: { role: string; content: string }[]; storeId: number | null }): Promise<ChatReply> =>
    api.post('/agent/chat', body),
  // 모델 교체 되돌리기 (본사만). to = 승격 결과의 archived 시각
  rollbackModel: async (storeId: number, to: string) =>
    api.post(`/predictions/${storeId}/model/rollback${qs({ to })}`, {}),
};
