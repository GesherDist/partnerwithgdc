'use client';

import { useState, useEffect, useCallback } from 'react';
import { getInventory } from '../actions';
import type { InventoryWithDetails } from '../types';

interface UseInventoryItemResult {
  data: InventoryWithDetails | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInventoryItem(id: string | null): UseInventoryItemResult {
  const [data, setData] = useState<InventoryWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInventoryItem = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getInventory(id);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch inventory');
        setData(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setData(null);
      console.error('useInventoryItem error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInventoryItem();
  }, [fetchInventoryItem]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchInventoryItem,
  };
}
