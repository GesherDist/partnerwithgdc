/**
 * useCustomerDocuments Hook
 *
 * Fetches and manages customer documents state.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCustomerDocuments } from '../actions';
import type { CustomerDocumentListItem } from '../types';

// ============================================
// TYPES
// ============================================

interface UseCustomerDocumentsOptions {
  enabled?: boolean;
}

interface UseCustomerDocumentsResult {
  data: CustomerDocumentListItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useCustomerDocuments(
  customerId: string,
  options: UseCustomerDocumentsOptions = {}
): UseCustomerDocumentsResult {
  const { enabled = true } = options;

  const [data, setData] = useState<CustomerDocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFetchingRef = useRef(false);
  const lastCustomerIdRef = useRef<string>('');

  const fetchDocuments = useCallback(
    async (force = false) => {
      if (!enabled || !customerId) {
        setIsLoading(false);
        return;
      }

      // Skip if already fetching or same customer
      if (!force && (isFetchingRef.current || customerId === lastCustomerIdRef.current)) {
        return;
      }

      isFetchingRef.current = true;
      lastCustomerIdRef.current = customerId;
      setIsLoading(true);
      setIsError(false);
      setError(null);

      try {
        const result = await getCustomerDocuments(customerId);

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setIsError(true);
          setError(new Error(result.error || 'Failed to fetch documents'));
        }
      } catch (err) {
        setIsError(true);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    },
    [customerId, enabled]
  );

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const refetch = useCallback(async () => {
    lastCustomerIdRef.current = '';
    await fetchDocuments(true);
  }, [fetchDocuments]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
