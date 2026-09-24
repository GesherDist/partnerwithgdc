/**
 * useQuotes Hook
 *
 * Hook for fetching and managing quotes list.
 * Uses server actions with client-side state management.
 *
 * Performance: Uses useRef to track params and prevent duplicate fetches.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { QuoteListItem, QuoteListParams, QuoteStatus } from '../types';
import { getQuotes, getQuoteStatusCounts } from '../actions';

interface UseQuotesResult {
  data: QuoteListItem[];
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

interface UseQuotesOptions {
  enabled?: boolean;
  initialParams?: QuoteListParams;
}

/**
 * Hook to fetch paginated quotes list
 */
export function useQuotes(
  params: QuoteListParams = {},
  options: UseQuotesOptions = {}
): UseQuotesResult {
  const { enabled = true } = options;

  const [data, setData] = useState<QuoteListItem[]>([]);
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

  const fetchQuotes = useCallback(async (force = false) => {
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
      const result = await getQuotes(params);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch quotes'));
        setData([]);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch quotes'));
      setData([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, params]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastParamsRef.current = ''; // Clear last params to force refetch
    await fetchQuotes(true);
  }, [fetchQuotes]);

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
 * Hook to fetch quote status counts
 */
export function useQuoteStatusCounts() {
  const [data, setData] = useState<Record<QuoteStatus, number>>({
    draft: 0,
    pending_approval: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    converted: 0,
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
      const result = await getQuoteStatusCounts();

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
