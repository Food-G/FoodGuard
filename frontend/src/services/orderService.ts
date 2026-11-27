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
  // 식자재별 추천 발주량 (orderQty, unit, coverageDays, currentStock ...)
  getRecommend: async (storeId: number) => {
    return api.get(`/orders/recommend/${storeId}`);
  },
  // 추천 발주량 + AI(claude CLI) 근거 설명 (10~20초)
  explainRecommend: async (storeId: number) => {
    return api.post(`/orders/recommend/${storeId}/explain`, {});
  },
  autoOrder: async (storeId: number) => {
    return api.post(`/orders/auto/${storeId}`, {});
  },
  // ── junho 화면이 쓰는 함수 ──
  driverReceiveGroup: async (groupToken: string) => {
    return api.post(`/delivery/group/${groupToken}/driver-receive`, {});
  },
  ownerReceive: async (id: number) => {
    return api.post(`/orders/${id}/owner-receive`, {});
  },
  recommend: async (storeId: number) => {
    return api.get(`/orders/recommend/${storeId}`);
  },
  // 결제 완료 후 호출 — 부족 식자재를 AI 예측 기반으로 발주에 자동 추가
  reorderAfterSale: async (storeId: number) => {
    return api.post(`/orders/reorder-after-sale/${storeId}`, {});
  },
};
