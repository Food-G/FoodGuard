import { api } from './api';

export const predictionService = {
  getByStore: async (storeId: number) => {
    return api.get(`/predictions/store/${storeId}`);
  },
};
