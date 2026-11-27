import { api } from './api';

export interface Staff {
  id: number;
  storeId: number;
  name: string;
  role: string;
  workDays: string;   // "MON,WED,FRI"
  startTime: string;  // "HH:MM"
  endTime: string;
}
export interface StaffInput { name: string; role: string; workDays: string[]; startTime: string; endTime: string }

// 월→일 순서. js Date.getDay() 는 일요일이 0
export const DAYS = [
  { code: 'MON', label: '월' }, { code: 'TUE', label: '화' }, { code: 'WED', label: '수' }, { code: 'THU', label: '목' },
  { code: 'FRI', label: '금' }, { code: 'SAT', label: '토' }, { code: 'SUN', label: '일' },
];
export const todayCode = (d = new Date()) => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][d.getDay()];
export const daysOf = (s: Staff) => s.workDays.split(',').filter(Boolean);
export const daysLabel = (s: Staff) => DAYS.filter((d) => daysOf(s).includes(d.code)).map((d) => d.label).join('·');

const COLORS = ['#1D9E75', '#2F7DD1', '#D0457F', '#6A4BD1', '#E0803D', '#00897B'];
export const staffColor = (s: Staff) => COLORS[s.id % COLORS.length];

// 400 은 문자열, 503 은 {message} 로 온다
export const staffError = (e: unknown, fallback: string) => {
  const raw = (e as Error)?.message;
  try { return JSON.parse(raw)?.message ?? fallback; } catch { return raw || fallback; }
};

export const staffService = {
  getByStore: (storeId: number): Promise<Staff[]> => api.get(`/staff/store/${storeId}`),
  create: (storeId: number, data: StaffInput): Promise<Staff> => api.post(`/staff/${storeId}`, data),
  update: (id: number, data: StaffInput): Promise<Staff> => api.put(`/staff/${id}`, data),
  remove: (id: number) => api.delete(`/staff/${id}`),
};
