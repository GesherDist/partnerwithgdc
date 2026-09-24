/**
 * usePackingList Hook
 *
 * Fetches a single packing list by ID with all related data.
 */

import { useState, useEffect, useCallback } from 'react';
import { getPackingList } from '../actions/packing-list.actions';
import type { PackingListWithItems } from '../types';

interface UsePackingListResult {
  data: PackingListWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePackingList(packingListId: string | null): UsePackingListResult {
  const [data, setData] = useState<PackingListWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!packingListId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPackingList(packingListId);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch packing list');
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packing list');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [packingListId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}
