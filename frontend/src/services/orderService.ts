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
  driverReceive: async (id: number) => {
    return api.post(`/orders/${id}/driver-receive`, {});
  },
  driverReceiveGroup: async (groupToken: string) => {
    return api.post(`/delivery/group/${groupToken}/driver-receive`, {});
  },
  ownerReceive: async (id: number) => {
    return api.post(`/orders/${id}/owner-receive`, {});
  },
  cancel: async (id: number) => {
    return api.delete(`/orders/${id}`);
  },
  getAll: async () => {
    return api.get('/orders/admin/all');
  },
  recommend: async (storeId: number) => {
    return api.get(`/orders/recommend/${storeId}`);
  },
  autoOrder: async (storeId: number) => {
    return api.post(`/orders/auto/${storeId}`, {});
  },
  // 결제 완료 후 호출 — 부족 식자재를 AI 예측 기반으로 발주에 자동 추가
  reorderAfterSale: async (storeId: number) => {
    return api.post(`/orders/reorder-after-sale/${storeId}`, {});
  },
};
