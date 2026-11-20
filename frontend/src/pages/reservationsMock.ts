// 예약 API 가 아직 없어 예약 화면과 대시보드가 함께 쓰는 예시 데이터
export type ReservationStatus = '예약중' | '방문완료' | '취소';

export interface Reservation {
  id: number;
  name: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  note: string;
}

export const MOCK_RESERVATIONS: Reservation[] = [
  { id: 1, name: '정태현', phone: '010-1234-5678', date: '2026-06-05', time: '12:00', guests: 4, status: '예약중',   note: '창가 자리 요청' },
  { id: 2, name: '서준호', phone: '010-2345-6789', date: '2026-06-05', time: '13:30', guests: 2, status: '예약중',   note: '' },
  { id: 3, name: '김지환', phone: '010-3456-7890', date: '2026-06-05', time: '18:00', guests: 6, status: '방문완료', note: '단체 예약' },
  { id: 4, name: '지현윤', phone: '010-4567-8901', date: '2026-06-05', time: '19:30', guests: 3, status: '취소',     note: '' },
  { id: 5, name: '몽흐데르겔', phone: '010-5678-9012', date: '2026-06-06', time: '12:00', guests: 5, status: '예약중',   note: '알레르기: 견과류' },
  { id: 6, name: '정태현', phone: '010-1234-5678', date: '2026-06-06', time: '18:30', guests: 2, status: '예약중',   note: '' },
  { id: 7, name: '서준호', phone: '010-2345-6789', date: '2026-06-07', time: '13:00', guests: 4, status: '예약중',   note: '생일 파티' },
];
