import { api } from './api';

export interface PredictionResult {
  id: number;
  menuId: number;
  menuName: string;
  predictionDate: string;
  predictedQty: number;
  recommendedOrderQty: number;
  confidence: number;
  modelVersion: string;
  createdAt: string;
}

export interface PredictionSummary {
  storeId: number;
  dates: string[];
  byMenu: Record<string, PredictionResult[]>;
  total: number;
}

export const predictionService = {
  getByStore: async (storeId: number): Promise<PredictionResult[]> => {
    return api.get(`/predictions/${storeId}`);
  },

  getSummary: async (storeId: number): Promise<PredictionSummary> => {
    return api.get(`/predictions/${storeId}/summary`);
  },

  trigger: async (storeId: number): Promise<{ status: string; message: string }> => {
    return api.post(`/predictions/${storeId}/trigger`, {});
  },
  // ── junho 화면이 쓰는 함수 ──
  getAccuracy: async (source: 'live' | 'backtest', storeId: number, windowDays?: number): Promise<any> => {
    const window = windowDays ? `&windowDays=${windowDays}` : '';
    return api.get(`/predictions/accuracy?source=${source}&storeId=${storeId}${window}`);
  },
};
