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
  delete: async (id: number) => {
    return api.delete(`/sales/${id}`);
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
};
