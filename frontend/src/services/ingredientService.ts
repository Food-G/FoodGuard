import { api } from './api';

export interface Ingredient {
  id: number;
  name: string;
  unit: string;     // 기준 단위: kg / L / 개
  category?: string;
}

export const ingredientService = {
  getAll: async (): Promise<Ingredient[]> => {
    return api.get('/ingredients');
  },
  create: async (data: { name: string; unit: string }): Promise<Ingredient> => {
    return api.post('/ingredients', data);
  },
};
