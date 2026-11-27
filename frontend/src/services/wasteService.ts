import { api } from './api';

export const wasteService = {
  // dev 백엔드는 /waste-records (본문에 storeId). 폐기 기록 + 재고 차감
  create: async (storeId: number, data: { ingredientId: number; quantity: number; reason: string }) => {
    return api.post('/waste-records', { storeId, ...data });
  },
};
