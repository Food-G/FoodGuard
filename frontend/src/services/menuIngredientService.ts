import { api } from './api';

export interface MenuIngredient {
  id: number;
  ingredient: { id: number; name: string; category: string; unit: string };
  qtyPerUnit: number;
  unit: string;
}

export const menuIngredientService = {
  getByMenu: async (menuId: number): Promise<MenuIngredient[]> => {
    return api.get(`/menu-ingredients/menu/${menuId}`);
  },
  add: async (data: { menuId: number; ingredientId: number; qtyPerUnit: number; unit: string }) => {
    return api.post('/menu-ingredients', data);
  },
  // AI 레시피 초안 (저장하지 않음): 이 매장 식자재 중 들어갈 것과 1개당 사용량, 목록에 없는 주재료
  draft: async (menuId: number) => {
    return api.post(`/menu-ingredients/menu/${menuId}/draft`, {});
  },
  delete: async (id: number) => {
    return api.delete(`/menu-ingredients/${id}`);
  },
};
