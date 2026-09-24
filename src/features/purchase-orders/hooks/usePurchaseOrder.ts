'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getPurchaseOrder } from '../actions';
import type { PurchaseOrderWithItems } from '../types';

interface UsePurchaseOrderResult {
  data: PurchaseOrderWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePurchaseOrder(id: string | null): UsePurchaseOrderResult {
  const [data, setData] = useState<PurchaseOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef(id);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const fetchPurchaseOrder = useCallback(async () => {
    if (!idRef.current) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPurchaseOrder(idRef.current);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch purchase order');
        setData(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setData(null);
      console.error('usePurchaseOrder error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchPurchaseOrder();
    } else {
      setData(null);
      setIsLoading(false);
      setError(null);
    }
  }, [id, fetchPurchaseOrder]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchPurchaseOrder,
  };
}
