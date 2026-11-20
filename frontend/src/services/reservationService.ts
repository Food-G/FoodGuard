import { api } from './api';

export type ReservationStatus = 'RESERVED' | 'VISITED' | 'CANCELLED';

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  RESERVED: '예약중',
  VISITED: '방문완료',
  CANCELLED: '취소',
};

export interface Reservation {
  id: number;
  storeId: number;
  customerName: string;
  phone: string | null;
  reservationDate: string; // yyyy-MM-dd
  reservationTime: string; // HH:mm:ss
  guests: number;
  status: ReservationStatus;
  note: string | null;
}

export interface ReservationInput {
  storeId: number;
  customerName: string;
  phone: string;
  reservationDate: string;
  reservationTime: string; // HH:mm
  guests: number;
  note: string;
}

export const reservationService = {
  // 최근 30일 이후 예약 (날짜·시간 순)
  getByStore: async (storeId: number): Promise<Reservation[]> => api.get(`/reservations/${storeId}`),
  create: async (body: ReservationInput): Promise<Reservation> => api.post('/reservations', body),
  updateStatus: async (id: number, status: ReservationStatus): Promise<Reservation> => api.put(`/reservations/${id}/status`, { status }),
};
