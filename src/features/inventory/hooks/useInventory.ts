'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listInventory } from '../actions';
import type { InventoryListItem, InventoryListParams } from '../types';

interface UseInventoryResult {
  data: InventoryListItem[];
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

export function useInventory(params: InventoryListParams = {}): UseInventoryResult {
  const [data, setData] = useState<InventoryListItem[]>([]);
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

  const isFirstRender = useRef(true);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listInventory(paramsRef.current);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch inventory');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useInventory error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchInventory();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchInventory();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.search,
    params.productId,
    params.locationId,
    params.lowStockOnly,
    params.sortBy,
    params.sortOrder,
    fetchInventory,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchInventory,
  };
}
