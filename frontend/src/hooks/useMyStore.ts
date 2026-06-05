import { useEffect, useState } from 'react';
import { storeService } from '../services/storeService';

interface UseMyStoreResult {
  storeId: number | null;
  storeLoading: boolean;
}

export function useMyStore(user: any): UseMyStoreResult {
  const [storeId, setStoreId] = useState<number | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setStoreLoading(false);
      return;
    }
    storeService.getMyStores(user.id)
      .then((stores: any[]) => {
        if (stores?.length) setStoreId(stores[0].id);
      })
      .catch(() => {})
      .finally(() => setStoreLoading(false));
  }, [user]);

  return { storeId, storeLoading };
}
