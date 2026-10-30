import { api } from './api';

export interface SalesPlanDay {
  date: string;
  type: 'ACTUAL' | 'FORECAST' | 'NONE';
  amount: number;
}

export interface SalesPlan {
  weekStart: string;
  targetAmount: number | null;
  actualToDate: number;
  forecastRemaining: number;
  expectedTotal: number;
  gap: number | null;
  achievementRate: number | null;
  days: SalesPlanDay[];
}

// 매출 계획: 주간 목표 매출 vs (지난 날 실제 + 남은 날 AI 예측) 매출
export const salesPlanService = {
  get: async (storeId: number): Promise<SalesPlan> => {
    return api.get(`/sales-plan/${storeId}`);
  },
  saveTarget: async (storeId: number, weekStart: string, targetAmount: number) => {
    return api.put(`/sales-plan/${storeId}/target`, { weekStart, targetAmount });
  },
};
