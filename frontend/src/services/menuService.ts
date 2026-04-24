import { api } from './api';

export const menuService = {
  getByStore: async (storeId: number) => {
    return api.get(`/menus/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/menus', data);
  },
  update: async (id: number, data: any) => {
    return api.put(`/menus/${id}`, data);
  },
  deactivate: async (id: number) => {
    return api.delete(`/menus/${id}`);
  },
};
