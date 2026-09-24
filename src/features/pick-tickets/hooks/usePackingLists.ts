/**
 * usePackingLists Hook
 *
 * Fetches paginated list of packing lists with filters.
 */

import { useState, useEffect, useCallback } from 'react';
import { listPackingLists } from '../actions/packing-list.actions';
import type { PackingListListItem, PackingListListParams } from '../types';

interface UsePackingListsResult {
  data: PackingListListItem[];
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
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  refetch: () => void;
}

export function usePackingLists(
  params: PackingListListParams = {}
): UsePackingListsResult {
  const [data, setData] = useState<PackingListListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listPackingLists(params);
      if (result.success && result.data) {
        setData(result.data.data);
        setTotal(result.data.meta.total);
        setPage(result.data.meta.page);
        setLimit(result.data.meta.limit);
        setTotalPages(result.data.meta.totalPages);
        setHasNextPage(result.data.meta.hasNextPage);
        setHasPreviousPage(result.data.meta.hasPreviousPage);
      } else {
        setError(result.error || 'Failed to fetch packing lists');
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch packing lists');
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
    isLoading,
    error,
    total,
    page,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    refetch: fetchData,
  };
}
