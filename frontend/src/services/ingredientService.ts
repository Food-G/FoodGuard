import { api } from './api';

export interface Ingredient {
  id: number;
  name: string;
  unit: string;     // 기준 단위: kg / L / 개
  category?: string;
}

// dev 백엔드는 식자재가 매장별이다 (조회·등록에 storeId 필수)
export const ingredientService = {
  getAll: async (storeId: number): Promise<Ingredient[]> => {
    return api.get(`/ingredients?storeId=${storeId}`);
  },
  create: async (data: { name: string; unit: string; storeId: number }): Promise<Ingredient> => {
    return api.post('/ingredients', data);
  },
};
