// 상단 GNB·메가메뉴, 서브 페이지 헤더(브레드크럼·탭), 메인 화면 서비스 카드가 함께 쓰는 메뉴 정의
export interface MenuLink { title: string; path: string; icon: string }
export interface MenuGroup { title: string; en: string; desc: string; icon: string; color: string; items: MenuLink[] }

const OWNER_MENU: MenuGroup[] = [
  {
    title: '매장 운영', en: 'STORE', icon: 'mdi:cash-register', color: '#E0533D',
    desc: '주문을 받고 메뉴를 관리하는 매장의 시작점',
    items: [
      { title: 'POS 시스템', path: '/pos', icon: 'mdi:cash-register' },
      { title: '메뉴 관리', path: '/menus', icon: 'mingcute:fork-spoon-line' },
    ],
  },
  {
    title: '식자재 관리', en: 'INGREDIENTS', icon: 'mdi:carrot', color: '#2F7DD1',
    desc: '발주부터 입고, 재고까지 한 흐름으로',
    items: [
      { title: '식자재 발주', path: '/orders', icon: 'mingcute:refresh-2-line' },
      { title: '식자재 목록', path: '/ingredients', icon: 'mdi:carrot' },
      { title: '재고 현황', path: '/inventory', icon: 'mingcute:box-3-line' },
    ],
  },
  {
    title: '매출 · 나눔', en: 'SALES & SHARE', icon: 'mingcute:heart-line', color: '#C2477E',
    desc: '판매를 기록하고, 남는 식자재는 이웃과 나눕니다',
    items: [
      { title: '판매 입력', path: '/sales', icon: 'mingcute:chart-line-line' },
      { title: '판매 내역', path: '/sales/history', icon: 'mingcute:list-check-line' },
      { title: '폐기 예측 & 기부', path: '/waste-prediction', icon: 'mingcute:delete-2-line' },
      { title: '기부 이력', path: '/donations', icon: 'mingcute:heart-line' },
    ],
  },
  {
    title: 'AI 비서', en: 'AI ASSISTANT', icon: 'mingcute:sparkles-line', color: '#7A4FD6',
    desc: '수요를 예측하고 에이전트가 먼저 제안합니다',
    items: [
      { title: 'AI 수요 예측', path: '/predictions', icon: 'mingcute:brain-fill' },
      { title: 'AI 에이전트 센터', path: '/agents', icon: 'mingcute:robot-line' },
      { title: 'AI 승인함', path: '/agent-inbox', icon: 'mingcute:inbox-line' },
    ],
  },
];

const HQ_MENU: MenuGroup[] = [
  {
    title: '가맹점 관리', en: 'NETWORK', icon: 'mingcute:grid-fill', color: '#1D9E75',
    desc: '전 매장의 운영과 발주를 한곳에서',
    items: [
      { title: '가맹점 네트워크', path: '/admin/stores', icon: 'mingcute:grid-fill' },
      { title: '발주 관리', path: '/admin/orders', icon: 'mingcute:refresh-2-line' },
      { title: '환경 통계 분석', path: '/admin/stats', icon: 'mingcute:chart-bar-fill' },
    ],
  },
  {
    title: 'AI 비서', en: 'AI ASSISTANT', icon: 'mingcute:sparkles-line', color: '#7A4FD6',
    desc: '에이전트 실행 현황과 승인 대기 제안',
    items: [
      { title: 'AI 에이전트 센터', path: '/agents', icon: 'mingcute:robot-line' },
      { title: 'AI 승인함', path: '/agent-inbox', icon: 'mingcute:inbox-line' },
    ],
  },
];

export const menuFor = (role?: string): MenuGroup[] => (role === 'HQ_ADMIN' ? HQ_MENU : OWNER_MENU);

export const findPage = (role: string | undefined, path: string) => {
  for (const group of menuFor(role)) {
    const item = group.items.find((i) => i.path === path);
    if (item) return { group, item };
  }
  return null;
};
