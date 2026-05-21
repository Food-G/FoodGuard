import { api } from './api';

export const notificationService = {
  getUnread: async (storeId: number) => {
    return api.get(`/notifications/${storeId}/unread`);
  },
  markAsRead: async (id: number) => {
    return api.put(`/notifications/${id}/read`, {});
  },
};
