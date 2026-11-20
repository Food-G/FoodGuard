import { api } from './api';

export const wasteService = {
  create: async (storeId: number, data: { ingredientId: number; quantity: number; reason: string }) => {
    return api.post(`/waste/${storeId}`, data);
  },
};
