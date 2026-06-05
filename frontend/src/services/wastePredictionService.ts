import { api } from './api';

export const wastePredictionService = {
  predict: async (storeId: number) => {
    return api.get(`/waste-prediction/${storeId}`);
  },
  summary: async (storeId: number) => {
    return api.get(`/waste-prediction/${storeId}/summary`);
  },
};
