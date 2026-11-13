import { api } from './api';

export const orderService = {
  getByStore: async (storeId: number) => {
    return api.get(`/orders/${storeId}`);
  },
  create: async (data: any) => {
    return api.post('/orders', data);
  },
  updateStatus: async (id: number, status: string) => {
    return api.put(`/orders/${id}/status`, { status });
  },
  approve: async (id: number) => {
    return api.put(`/orders/${id}/status`, { status: 'APPROVED' });
  },
  hqSend: async (id: number, expiryDate?: string) => {
    return api.post(`/orders/${id}/hq-send`, { expiryDate: expiryDate ?? null });
  },
  scanQr: async (qrData: string) => {
    return api.post('/orders/scan', { qrData });
  },
  scanQrByDriver: async (token: string) => {
    return api.get(`/orders/driver-scan?token=${encodeURIComponent(token)}`);
  },
  scanQrByOwner: async (token: string) => {
    return api.get(`/orders/owner-scan?token=${encodeURIComponent(token)}`);
  },
  driverReceive: async (id: number) => {
    return api.post(`/orders/${id}/driver-receive`, {});
  },
  cancel: async (id: number) => {
    return api.delete(`/orders/${id}`);
  },
  getAll: async () => {
    return api.get('/orders/admin/all');
  },
  // 추천 발주량 + AI(claude CLI) 근거 설명 (10~20초)
  explainRecommend: async (storeId: number) => {
    return api.post(`/orders/recommend/${storeId}/explain`, {});
  },
  autoOrder: async (storeId: number) => {
    return api.post(`/orders/auto/${storeId}`, {});
  },
};
