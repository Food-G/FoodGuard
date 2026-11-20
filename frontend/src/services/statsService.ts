import { api } from './api';

export interface HqStats {
  monthly: { month: string; revenue: number; wasteCount: number }[];
  stores: { storeId: number; storeName: string; wasteCount: number; wasteRate: number | null; donationCount: number }[];
  donationCount: number;
  discountSales: { quantity: number; revenue: number; discountAmount: number };
  forecastAccuracy: { evaluatedDays: number; wmape: number | null; menuWeeks: number; weeklyWithin10Pct: number | null };
  recommendation: {
    totalOrders: number;
    autoOrders: number;
    manualOrders: number;
    adoptionRate: number | null;
    manualWithRecommendation: number;
    manualAvgChangePct: number | null;
    manualWithoutRecommendation: number;
  };
}

export const statsService = {
  // 본사 통계: 월별 매출·폐기 기록, 가맹점별 폐기율, 추천 적용률
  hq: async (): Promise<HqStats> => {
    return api.get('/stats/hq');
  },
};
