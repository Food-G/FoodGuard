import { api } from './api';

export interface Employee {
  id: number;
  storeId: number;
  name: string;
  phone: string | null;
  hourlyWage: number;
  active: boolean;
}

export interface EmployeeSchedule {
  id: number;
  employeeId: number;
  weekday: number; // 1=월 … 7=일
  startTime: string; // HH:mm:ss
  endTime: string;
}

export interface Attendance {
  id: number;
  employeeId: number;
  clockIn: string; // yyyy-MM-ddTHH:mm:ss
  clockOut: string | null;
}

export interface WeeklyPayRow {
  employeeId: number;
  name: string;
  hourlyWage: number;
  workedMinutes: number;
  openShifts: number;
  basePay: number;
  holidayEligible: boolean;
  holidayPay: number;
  totalPay: number;
}

export const employeeService = {
  getByStore: async (storeId: number): Promise<Employee[]> => api.get(`/employees/${storeId}`),
  create: async (data: { storeId: number; name: string; phone?: string; hourlyWage: number; pin: string }): Promise<Employee> =>
    api.post('/employees', data),
  update: async (id: number, data: Partial<{ name: string; phone: string; hourlyWage: number; pin: string; active: boolean }>): Promise<Employee> =>
    api.put(`/employees/${id}`, data),

  getSchedules: async (storeId: number): Promise<EmployeeSchedule[]> => api.get(`/employee-schedules/${storeId}`),
  createSchedule: async (data: { storeId: number; employeeId: number; weekday: number; startTime: string; endTime: string }): Promise<EmployeeSchedule> =>
    api.post('/employee-schedules', data),
  deleteSchedule: async (id: number) => api.delete(`/employee-schedules/${id}`),
};

export const attendanceService = {
  // 직원이 PIN 으로 출근/퇴근 (근무 중이면 퇴근)
  clock: async (storeId: number, pin: string): Promise<{ employeeName: string; action: 'IN' | 'OUT'; time: string }> =>
    api.post('/attendance/clock', { storeId, pin }),
  getByStore: async (storeId: number, start: string, end: string): Promise<Attendance[]> =>
    api.get(`/attendance/${storeId}?start=${start}&end=${end}`),
  weeklyPay: async (storeId: number, weekStart: string): Promise<WeeklyPayRow[]> =>
    api.get(`/attendance/${storeId}/weekly-pay?weekStart=${weekStart}`),
  update: async (id: number, data: { clockIn: string; clockOut: string | null }): Promise<Attendance> =>
    api.put(`/attendance/${id}`, data),
  delete: async (id: number) => api.delete(`/attendance/${id}`),
};
