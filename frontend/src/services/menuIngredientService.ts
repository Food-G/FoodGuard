import { api } from './api';

export interface MenuIngredient {
  id: number;
  ingredient: { id: number; name: string; category: string; unit: string };
  qtyPerUnit: number;
  unit: string;
}

export interface StoreRecipeItem {
  id: number;
  menuId: number;
  ingredientId: number;
  ingredientName: string;
  baseUnit: string;
  qtyPerUnit: number;
  unit: string;
}

export interface MenuAgentChange {
  op: 'ADD_MENU' | 'UPDATE_MENU' | 'DELETE_MENU' | 'ADD_INGREDIENTS' | 'REMOVE_INGREDIENTS' | 'DELETE_INGREDIENT';
  menuId?: number;
  menuName?: string;
  price?: number;
  category?: string | null;
  currentName?: string;
  currentPrice?: number;
  ingredientId?: number;
  ingredientName?: string;
  usedBy?: string[];
  removeIngredients?: { ingredientId: number; name: string }[];
  ingredients?: { name: string; qtyPerUnit: number; unit: string; baseUnit: string; isNew: boolean; estimated: boolean; previousQty?: string }[];
}

export interface MenuAgentProposal {
  understood: string;
  clarification: string | null;
  changes: MenuAgentChange[];
}

export const menuIngredientService = {
  getByStore: async (storeId: number): Promise<StoreRecipeItem[]> => {
    return api.get(`/menu-ingredients/store/${storeId}`);
  },
  // 비상용 수동 입력
  add: async (data: { menuId: number; ingredientId: number; qtyPerUnit: number; unit: string }) => {
    return api.post('/menu-ingredients', data);
  },
  remove: async (id: number) => {
    return api.delete(`/menu-ingredients/${id}`);
  },
  // 문자 요청 → 변경 미리보기 / 확인 후 반영
  propose: async (storeId: number, message: string): Promise<MenuAgentProposal> => {
    return api.post(`/menu-agent/${storeId}/propose`, { message });
  },
  apply: async (storeId: number, changes: MenuAgentChange[]) => {
    return api.post(`/menu-agent/${storeId}/apply`, changes);
  },
};
