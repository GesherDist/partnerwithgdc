/**
 * useSalesOrders Hook
 *
 * Hook for fetching and managing sales orders list.
 * Uses server actions with client-side state management.
 *
 * Performance: Uses useRef to track params and prevent duplicate fetches.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SalesOrderListItem, SalesOrderListParams, OrderStatus } from '../types';
import { getSalesOrders, getSalesOrderStatusCounts } from '../actions';

interface UseSalesOrdersResult {
  data: SalesOrderListItem[];
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

interface UseSalesOrdersOptions {
  enabled?: boolean;
  initialParams?: SalesOrderListParams;
}

/**
 * Hook to fetch paginated sales orders list
 */
export function useSalesOrders(
  params: SalesOrderListParams = {},
  options: UseSalesOrdersOptions = {}
): UseSalesOrdersResult {
  const { enabled = true } = options;

  const [data, setData] = useState<SalesOrderListItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
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

  const fetchOrders = useCallback(async (force = false) => {
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
      const result = await getSalesOrders(params);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch sales orders'));
        setData([]);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch sales orders'));
      setData([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, params]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastParamsRef.current = ''; // Clear last params to force refetch
    await fetchOrders(true);
  }, [fetchOrders]);

  return {
    data,
    meta,
    isLoading,
    isError,
    error,
    refetch,
  };
}

/**
 * Hook to fetch sales order status counts
 */
export function useSalesOrderStatusCounts() {
  const [data, setData] = useState<Record<OrderStatus, number>>({
    draft: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchCounts = useCallback(async (force = false) => {
    // Skip if already fetching or already fetched (unless forced)
    if (!force && (isFetchingRef.current || hasFetchedRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getSalesOrderStatusCounts();

      if (result.success && result.data) {
        setData(result.data);
        hasFetchedRef.current = true;
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch status counts'));
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch status counts'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    hasFetchedRef.current = false; // Clear flag to force refetch
    await fetchCounts(true);
  }, [fetchCounts]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
