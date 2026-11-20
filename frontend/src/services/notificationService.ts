import { api } from './api';

export const notificationService = {
  getUnread: async (storeId: number) => {
    return api.get(`/notifications/${storeId}/unread`);
  },
  getHqUnread: async () => {
    return api.get('/notifications/hq/unread');
  },
  markAsRead: async (id: number) => {
    return api.put(`/notifications/${id}/read`, {});
  },
};
