import { api } from './api';

export interface MenuIngredient {
  id: number;
  ingredient: { id: number; name: string; category: string; unit: string };
  qtyPerUnit: number;
  unit: string;
  tolerance: number;
}

export const menuIngredientService = {
  getByMenu: async (menuId: number): Promise<MenuIngredient[]> => {
    return api.get(`/menu-ingredients/menu/${menuId}`);
  },
  add: async (data: { menuId: number; ingredientId: number; qtyPerUnit: number; unit: string; tolerance?: number }) => {
    return api.post('/menu-ingredients', data);
  },
  delete: async (id: number) => {
    return api.delete(`/menu-ingredients/${id}`);
  },
};
