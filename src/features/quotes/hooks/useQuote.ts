/**
 * useQuote Hook
 *
 * Hook for fetching and managing a single quote.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { QuoteWithItems } from '../types';
import { getQuote } from '../actions';

interface UseQuoteResult {
  data: QuoteWithItems | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseQuoteOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch a single quote by ID
 */
export function useQuote(
  id: string | null,
  options: UseQuoteOptions = {}
): UseQuoteResult {
  const { enabled = true } = options;

  const [data, setData] = useState<QuoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  // Track the last fetched ID
  const lastIdRef = useRef<string | null>(null);

  const fetchQuote = useCallback(async (force = false) => {
    if (!enabled || !id) {
      setIsLoading(false);
      setData(null);
      return;
    }

    // Skip if already fetching or ID hasn't changed (unless forced)
    if (!force && (isFetchingRef.current || id === lastIdRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    lastIdRef.current = id;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getQuote(id);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch quote'));
        setData(null);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch quote'));
      setData(null);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, id]);

  // Fetch on mount and when ID changes
  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastIdRef.current = null; // Clear last ID to force refetch
    await fetchQuote(true);
  }, [fetchQuote]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
