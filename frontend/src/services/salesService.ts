import { api } from './api';

export interface SalesSummary {
  start: string;
  end: string;
  totalQuantity: number;
  revenue: number;
  discountQuantity: number;
  discountAmount: number;
  previousQuantity: number;
  previousRevenue: number;
  byMenu: { menuId: number; menuName: string; quantity: number; revenue: number; discountQuantity: number }[];
  byDay: { date: string; quantity: number; revenue: number }[];
}

export interface SalesInsight {
  summary: string;
  highlights: string[];
  unverifiedNumbers: string[];
}

export interface SalesCorrectionChange {
  menuId: number;
  menuName: string;
  saleDate: string;
  currentTotal: number;
  newTotal: number;
  amountChange: number;
  stockChanges: { ingredient: string; change: number; unit: string }[];
}

export interface SalesCorrectionProposal {
  understood: string;
  clarification: string | null;
  changes: SalesCorrectionChange[];
}

export const salesService = {
  proposeCorrection: async (storeId: number, message: string): Promise<SalesCorrectionProposal> => {
    return api.post(`/sales/${storeId}/corrections/propose`, { message });
  },
  applyCorrection: async (storeId: number, changes: SalesCorrectionChange[], reason: string) => {
    return api.post(`/sales/${storeId}/corrections/apply`, { changes, reason });
  },
  // 판매량 집계 (POS 결제가 자동 기록한 판매 기준)
  getSummary: async (storeId: number, start: string, end: string): Promise<SalesSummary> => {
    return api.get(`/sales/${storeId}/summary?start=${start}&end=${end}`);
  },
  getInsight: async (storeId: number, start: string, end: string): Promise<SalesInsight> => {
    return api.post(`/sales/${storeId}/insight?start=${start}&end=${end}`, {});
  },
  getByDateRange: async (storeId: number, start: string, end: string) => {
    return api.get(`/sales/${storeId}/range?start=${start}&end=${end}`);
  },
  getTodaySummary: async (storeId: number) => {
    return api.get(`/sales/${storeId}/today-summary`);
  },
  getWeeklySummary: async (storeId: number) => {
    return api.get(`/sales/${storeId}/weekly-summary`);
  },
  // 휴무·품절 기록 (AI 학습에서 판매량을 수요로 쓰지 않을 날)
  getFlags: async (storeId: number) => {
    return api.get(`/sales-flags/${storeId}`);
  },
  createFlag: async (data: { storeId: number; flagDate: string; flagType: 'CLOSED' | 'SOLD_OUT'; menuId?: number }) => {
    return api.post('/sales-flags', data);
  },
  deleteFlag: async (id: number) => {
    return api.delete(`/sales-flags/${id}`);
  },
  // 특이사항 메모 (저장 시 AI 가 유형·증감 배율로 바꿔 수요 예측 피처로 사용)
  getEventNotes: async (storeId: number) => {
    return api.get(`/event-notes/${storeId}`);
  },
  createEventNote: async (data: { storeId: number; eventDate: string; note: string }) => {
    return api.post('/event-notes', data);
  },
  deleteEventNote: async (id: number) => {
    return api.delete(`/event-notes/${id}`);
  },
};
