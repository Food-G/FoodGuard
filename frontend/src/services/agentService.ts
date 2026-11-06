import { api } from './api';

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });

// 백엔드 GlobalExceptionHandler 의 {"error": ...} 를 꺼낸다
export const errorText = (e: any, fallback: string): string => {
  try {
    return JSON.parse(e.message).error ?? fallback;
  } catch {
    return fallback;
  }
};

export interface SalesImportRow {
  saleDate: string;
  rawName: string;
  menuId: number | null;
  quantity: number;
  alreadyEntered: boolean;
}

export interface InvoiceItem {
  rawName: string;
  ingredientId: number | null;
  quantity: number;
  unit: string;
  expiryDate: string | null;
  unitMismatch: boolean;
}

export interface SettingSuggestion {
  ingredientId: number;
  shelfLifeDays: number;
  storage: string;
  orderCycleDays: number;
  leadTimeDays: number;
  reason: string;
  cycleSource: 'history' | 'ai';
  leadSource: 'history' | 'ai';
}

export interface OrderReview {
  summary: string;
  recommendation: 'execute' | 'revise' | 'wait';
  concerns: string[];
  items: { ingredientId: number; verdict: 'approve' | 'reduce' | 'hold'; suggestedQty: number; reason: string }[];
}

export interface WatchdogFinding {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
}

export interface WeeklyReport {
  facts: {
    periodStart: string;
    periodEnd: string;
    stores: { storeId: number; storeName: string; revenue: number; previousRevenue: number; changePct: number | null; flags: string[] }[];
  };
  report: {
    headline: string;
    stores: { storeId: number; finding: string; hypothesis: string }[];
    actions: string[];
    unverifiedNumbers: string[];
  };
}

export interface ClearanceCandidate {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  stock: number;
  expiryDate: string;
  daysLeft: number;
  expectedUsage: number;
  surplus: number;
  forecastAvailable: boolean;
  menus: {
    menuId: number;
    menuName: string;
    price: number;
    extraUnitsToClear: number;
    activeDiscountPct: number | null;
    activeDiscountId: number | null;
    activeEndDate: string | null;
  }[];
}

export interface ClearanceBriefing {
  summary: string;
  items: { ingredientId: number; advice: string }[];
  unverifiedNumbers: string[];
}

export interface ActiveDiscount {
  id: number;
  menuId: number;
  menuName: string;
  price: number;
  discountPct: number;
  discountedPrice: number;
  endDate: string;
}

export interface CheckoutResult {
  total: number;
  lines: { menuId: number; menuName: string; quantity: number; unitPrice: number; listPrice: number; discountPct: number | null }[];
}

export const discountService = {
  candidates: (storeId: number): Promise<ClearanceCandidate[]> => api.get(`/discounts/store/${storeId}/candidates`),
  briefing: (storeId: number): Promise<ClearanceBriefing> => api.post(`/discounts/store/${storeId}/briefing`, {}),
  active: (storeId: number): Promise<ActiveDiscount[]> => api.get(`/discounts/store/${storeId}`),
  apply: (body: { storeId: number; menuId: number; ingredientId: number; discountPct: number; endDate: string }) => api.post('/discounts', body),
  end: (id: number) => api.delete(`/discounts/${id}`),
  checkout: (storeId: number, items: { menuId: number; quantity: number }[]): Promise<CheckoutResult> =>
    api.post(`/pos/${storeId}/checkout`, items),
};

export const agentService = {
  previewSales: (storeId: number, body: { filename: string; contentBase64: string; defaultDate?: string }) =>
    api.post(`/ingest/${storeId}/sales/preview`, body),
  commitSales: (storeId: number, rows: { menuId: number; saleDate: string; quantity: number }[]) =>
    api.post(`/ingest/${storeId}/sales/commit`, rows),
  previewInvoice: (storeId: number, body: { contentBase64: string; mediaType: string }) =>
    api.post(`/ingest/${storeId}/invoice/preview`, body),
  commitInvoice: (storeId: number, items: { ingredientId: number; quantity: number; expiryDate: string | null }[]) =>
    api.post(`/ingest/${storeId}/invoice/commit`, items),
  suggestSettings: (storeId: number) => api.post(`/ingredients/suggest/${storeId}`, {}),
  reviewOrder: (storeId: number) => api.post(`/orders/recommend/${storeId}/review`, {}),
  agentOrder: (storeId: number, items: { ingredientId: number; quantity: number }[]) =>
    api.post(`/orders/agent/${storeId}`, items),
  watchdog: (storeId: number): Promise<WatchdogFinding[]> => api.get(`/watchdog/${storeId}`),
  weeklyReport: (): Promise<WeeklyReport> => api.post('/stats/hq/weekly-report', {}),
  ask: (storeId: number, question: string) => api.post(`/assistant/${storeId}/ask`, { question }),
};
