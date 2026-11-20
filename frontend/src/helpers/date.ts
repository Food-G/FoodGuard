// 로컬 날짜 기준 (toISOString 은 UTC 라 한국 오전 9시 전에는 전날이 된다)
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// 그 주 월요일 0시
export const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() + 6) % 7));
};

// "yyyy-MM-ddTHH:mm:ss" 또는 "HH:mm:ss" → "HH:mm"
export const hhmm = (s: string | null | undefined) => (s ? s.slice(s.indexOf('T') + 1, s.indexOf('T') + 6) : '-');

export const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;

// 백엔드(Duration.toMinutes)와 같게 분 미만은 버린다
export const minutesBetween = (start: string, end: string | Date) =>
  Math.max(0, Math.floor(((end instanceof Date ? end : new Date(end)).getTime() - new Date(start).getTime()) / 60_000));
