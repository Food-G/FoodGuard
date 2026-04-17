import { api } from './api';

export const orderService = {
  getByStore: async (storeId: number) => {
    return api.get(`/orders/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/orders', data);
  },
  updateStatus: async (id: number, status: string) => {
    return api.put(`/orders/${id}/status`, { status });
  },
  cancel: async (id: number) => {
    return api.delete(`/orders/${id}`);
  },
};
