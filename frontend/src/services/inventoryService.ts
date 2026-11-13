import { api } from './api';

export const inventoryService = {
  getByStore: async (storeId: number) => {
    return api.get(`/inventory/${storeId}`);
  },
  clearByStore: async (storeId: number) => {
    return api.delete(`/inventory/store/${storeId}`);
  },
  // 폐기 기록 + 재고 차감
  recordWaste: async (data: { storeId: number; ingredientId: number; quantity: number; reason: string }) => {
    return api.post('/waste-records', data);
  },
};
