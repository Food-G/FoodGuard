import { api } from './api';

export const orderService = {
  getAll: async () => {
    return api.get('/orders');
  },
  getByStore: async (storeId: number) => {
    return api.get(`/orders/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/orders', data);
  },
  updateStatus: async (id: number, status: string) => {
    return api.put(`/orders/${id}/status`, { status });
  },
  approve: async (id: number) => {
    return api.put(`/orders/${id}/status`, { status: 'CONFIRMED' });
  },
  cancel: async (id: number) => {
    return api.delete(`/orders/${id}`);
  },
};
