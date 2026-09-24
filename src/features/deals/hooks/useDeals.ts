/**
 * useDeals Hook
 *
 * Hook for fetching and managing deals list.
 * Uses server actions with client-side state management.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DealListItem, DealListParams, DealStatus } from '../types';
import { getDeals, getDealStats } from '../actions';

// ============================================
// TYPES
// ============================================

interface UseDealsResult {
  data: DealListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseDealsOptions {
  enabled?: boolean;
}

interface DealStatsData {
  total: number;
  totalValue: number;
  openDeals: number;
  openValue: number;
  wonDeals: number;
  wonValue: number;
  lostDeals: number;
  countByStatus: Record<string, number>;
  valueByPipeline: Array<{ pipeline: string; totalValue: number; count: number }>;
}

// ============================================
// useDeals HOOK
// ============================================

/**
 * Hook to fetch paginated deals list
 */
export function useDeals(
  params: DealListParams = {},
  options: UseDealsOptions = {}
): UseDealsResult {
  const { enabled = true } = options;

  const [data, setData] = useState<DealListItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  // Track the last fetched params to prevent unnecessary refetches
  const lastParamsRef = useRef<string>('');

  const fetchDeals = useCallback(async (force = false) => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Create a stable key from params
    const paramsKey = JSON.stringify(params);

    // Skip if already fetching (but allow if params changed or forced)
    if (isFetchingRef.current && paramsKey === lastParamsRef.current && !force) {
      return;
    }

    // Skip if params haven't changed and not forced
    if (!force && paramsKey === lastParamsRef.current) {
      return;
    }

    isFetchingRef.current = true;
    lastParamsRef.current = paramsKey;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getDeals(params);

      if (result.success) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch deals'));
        setData([]);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch deals'));
      setData([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, params]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastParamsRef.current = ''; // Clear last params to force refetch
    await fetchDeals(true);
  }, [fetchDeals]);

  return {
    data,
    meta,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================
// useDealStats HOOK
// ============================================

/**
 * Hook to fetch deal statistics
 */
export function useDealStats() {
  const [data, setData] = useState<DealStatsData>({
    total: 0,
    totalValue: 0,
    openDeals: 0,
    openValue: 0,
    wonDeals: 0,
    wonValue: 0,
    lostDeals: 0,
    countByStatus: {},
    valueByPipeline: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchStats = useCallback(async (force = false) => {
    // Skip if already fetching or already fetched (unless forced)
    if (!force && (isFetchingRef.current || hasFetchedRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getDealStats();

      if (result.success) {
        const { countByStatus, valueByStatus, valueByPipeline } = result.data;

        // Calculate totals
        const total = Object.values(countByStatus).reduce((sum, count) => sum + count, 0);
        const totalValue = valueByStatus.reduce((sum, item) => sum + item.totalValue, 0);

        const openStats = valueByStatus.find((v) => v.status === 'open');
        const wonStats = valueByStatus.find((v) => v.status === 'won');
        const lostStats = valueByStatus.find((v) => v.status === 'lost');

        setData({
          total,
          totalValue,
          openDeals: openStats?.count || 0,
          openValue: openStats?.totalValue || 0,
          wonDeals: wonStats?.count || 0,
          wonValue: wonStats?.totalValue || 0,
          lostDeals: lostStats?.count || 0,
          countByStatus,
          valueByPipeline,
        });
        hasFetchedRef.current = true;
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch deal stats'));
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch deal stats'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    hasFetchedRef.current = false; // Clear flag to force refetch
    await fetchStats(true);
  }, [fetchStats]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}

// ============================================
// useDealStatusCounts HOOK
// ============================================

/**
 * Hook to fetch deal counts by status
 */
export function useDealStatusCounts() {
  const [data, setData] = useState<Record<DealStatus, number>>({
    open: 0,
    won: 0,
    lost: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchCounts = useCallback(async (force = false) => {
    if (!force && (isFetchingRef.current || hasFetchedRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const result = await getDealStats();

      if (result.success) {
        const counts: Record<DealStatus, number> = {
          open: result.data.countByStatus['open'] || 0,
          won: result.data.countByStatus['won'] || 0,
          lost: result.data.countByStatus['lost'] || 0,
        };

        setData(counts);
        hasFetchedRef.current = true;
      }
    } catch (err) {
      console.error('[useDealStatusCounts] Error:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const refetch = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchCounts(true);
  }, [fetchCounts]);

  return { data, isLoading, refetch };
}
