import { api } from './api';

export const salesService = {
  getByStore: async (storeId: number) => {
    return api.get(`/sales/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/sales', data);
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
  getAllStoreWeeklySummary: async () => {
    return api.get('/sales/all-stores/weekly-summary');
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
