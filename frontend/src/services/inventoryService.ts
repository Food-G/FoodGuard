import { api } from './api';

export const inventoryService = {
  getByStore: async (storeId: number) => {
    return api.get(`/inventory/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/inventory', data);
  },
  update: async (id: number, data: any) => {
    return api.put(`/inventory/${id}`, data);
  },
  delete: async (id: number) => {
    return api.delete(`/inventory/${id}`);
  },
  clearByStore: async (storeId: number) => {
    return api.delete(`/inventory/store/${storeId}`);
  },
  // 폐기 기록 + 재고 차감
  recordWaste: async (data: { storeId: number; ingredientId: number; quantity: number; reason: string }) => {
    return api.post('/waste-records', data);
  },
};
