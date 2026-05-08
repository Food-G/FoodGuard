import { api } from './api';

export const inventoryService = {
  getByStore: async (storeId: number) => {
    return api.get(`/inventory/${storeId}`);
  },
  // 간편 등록: 재고명+수량+가격+유통기한 한번에
  register: async (storeId: number, data: {
    ingredientName: string;
    quantity: number;
    price: number;
    expiryDate?: string;
    unit?: string;
  }) => {
    return api.post('/inventory/register', { storeId, ...data });
  },
  create: async (data: any) => {
    return api.post('/inventory', data);
  },
  update: async (id: number, data: any) => {
    return api.put(`/inventory/${id}`, data);
  },
  delete: async (id: number) => {
    return api.delete(`/inventory/${id}`);
  },
};
