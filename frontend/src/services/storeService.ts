import { api } from './api';

export const storeService = {
  getMyStores: async (userId: number) => {
    return api.get(`/stores/my/${userId}`);
  },
  getAll: async () => {
    return api.get('/stores');
  },
  create: async (data: any) => {
    return api.post('/stores', data);
  },
  update: async (id: number, data: any) => {
    return api.put(`/stores/${id}`, data);
  },
  // ── junho 화면이 쓰는 함수 ──
  delete: async (id: number) => {
    return api.delete(`/stores/${id}`);
  },
};
