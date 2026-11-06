import { api } from './api';

export const donationService = {
  create: async (storeId: number, data: any) => {
    return api.post(`/donations/${storeId}`, data);
  },
  complete: async (id: number) => {
    return api.post(`/donations/${id}/complete`, {});
  },
  cancel: async (id: number) => {
    return api.post(`/donations/${id}/cancel`, {});
  },
  getByStore: async (storeId: number) => {
    return api.get(`/donations/store/${storeId}`);
  },
  getOrgs: async (storeId: number, category?: string | null) => {
    const q = category ? `&category=${encodeURIComponent(category)}` : '';
    return api.get(`/donation-orgs?storeId=${storeId}${q}`);
  },
};
