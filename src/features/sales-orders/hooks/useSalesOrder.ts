/**
 * useSalesOrder Hook
 *
 * Hook for fetching and managing a single sales order.
 * Uses server actions with client-side state management.
 *
 * Future Integration:
 * - Replace with useQuery from @tanstack/react-query
 * - Add queryKey: ['salesOrders', 'detail', id]
 * - Add automatic refetching and caching
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SalesOrderWithItems } from '../types';
import { getSalesOrder, getSalesOrderByNumber } from '../actions';

interface UseSalesOrderResult {
  data: SalesOrderWithItems | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseSalesOrderOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch a single sales order by ID
 */
export function useSalesOrder(
  id: string | undefined,
  options: UseSalesOrderOptions = {}
): UseSalesOrderResult {
  const { enabled = true } = options;

  const [data, setData] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!enabled || !id) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getSalesOrder(id);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch sales order'));
        setData(null);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch sales order'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchOrder,
  };
}

/**
 * Hook to fetch a single sales order by order number
 */
export function useSalesOrderByNumber(
  orderNumber: string | undefined,
  options: UseSalesOrderOptions = {}
): UseSalesOrderResult {
  const { enabled = true } = options;

  const [data, setData] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!enabled || !orderNumber) {
      setIsLoading(false);
      setData(null);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getSalesOrderByNumber(orderNumber);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch sales order'));
        setData(null);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch sales order'));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, orderNumber]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchOrder,
  };
}
