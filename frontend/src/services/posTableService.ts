import { api } from './api';

export interface PosTableLayout {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  seats: number;
}

export const posTableService = {
  getByStore: async (storeId: number): Promise<PosTableLayout[]> => {
    return api.get(`/pos-tables/${storeId}`);
  },
  // 배치 전체를 한 번에 저장 (기존 배치는 지워진다)
  save: async (storeId: number, tables: PosTableLayout[]): Promise<PosTableLayout[]> => {
    return api.put(`/pos-tables/${storeId}`, tables);
  },
};
