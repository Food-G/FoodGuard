// "방금 / 3분 전 / 2시간 전 / 5일 전"
export const timeAgo = (s?: string | null) => {
  if (!s) return '';
  const sec = Math.max(0, (Date.now() - new Date(s).getTime()) / 1000);
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
};

// "11월 27일 (목) 오후 2:03"
export const dateTimeLabel = (s?: string | null) =>
  (s ? new Date(s).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '');
