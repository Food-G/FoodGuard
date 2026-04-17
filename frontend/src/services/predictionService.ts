import { api } from './api';

export const predictionService = {
  getByStore: async (storeId: number) => {
    return api.get(`/predictions/${storeId}`); // Assuming this endpoint exists or will exist
  },
};
