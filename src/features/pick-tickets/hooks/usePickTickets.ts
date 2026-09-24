'use client';

import { useState, useEffect, useCallback } from 'react';
import { listPickTickets } from '../actions';
import type { PickTicketListItem, PickTicketListParams, PaginatedResult } from '../types';

export function usePickTickets(params: PickTicketListParams = {}) {
  const [data, setData] = useState<PaginatedResult<PickTicketListItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPickTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listPickTickets(params);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch pick tickets');
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchPickTickets();
  }, [fetchPickTickets]);

  return {
    data: data?.data ?? [],
    meta: data?.meta ?? {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    isLoading,
    error,
    refetch: fetchPickTickets,
  };
}
