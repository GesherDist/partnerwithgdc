'use client';

import { useState, useEffect, useCallback } from 'react';
import { listPurchaseOrders } from '../actions';
import type { POListItem, POListParams } from '../types';

interface UsePurchaseOrdersResult {
  data: POListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePurchaseOrders(params: POListParams = {}): UsePurchaseOrdersResult {
  const [data, setData] = useState<POListItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPurchaseOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listPurchaseOrders(params);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch purchase orders');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('usePurchaseOrders error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchPurchaseOrders,
  };
}
