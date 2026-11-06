import { api } from './api';

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
  // storeId 생략 = 전 매장 (본사만)
  getProposals: async (storeId?: number | null, status?: string): Promise<AgentProposal[]> =>
    api.get(`/agent/proposals${qs({ storeId, status })}`),
  // 본사 발주 심사 결과 (승인함이 아니라 발주 목록에 병합). 상태와 무관하게 최근 200건
  getOrderFlags: async (): Promise<AgentProposal[]> =>
    (await api.get(`/agent/proposals${qs({ type: 'ORDER_FLAG' })}`) ?? []).filter((p: AgentProposal) => p.agent === 'hq_review'),
  approve: async (id: number): Promise<AgentProposal> => api.post(`/agent/proposals/${id}/approve`, {}),
  reject: async (id: number, reason: string): Promise<AgentProposal> =>
    api.post(`/agent/proposals/${id}/reject`, { reason }),
  getRuns: async (storeId?: number | null): Promise<AgentRun[]> => api.get(`/agent/runs${qs({ storeId })}`),
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
