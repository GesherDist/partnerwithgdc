/**
 * useDocumentTypes Hook
 *
 * Fetches document types for dropdown.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDocumentTypes } from '../actions';
import type { DocumentTypeDropdownItem } from '../types';

// ============================================
// TYPES
// ============================================

interface UseDocumentTypesResult {
  data: DocumentTypeDropdownItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// ============================================
// HOOK
// ============================================

export function useDocumentTypes(): UseDocumentTypesResult {
  const [data, setData] = useState<DocumentTypeDropdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchTypes = useCallback(async (force = false) => {
    // Skip if already fetching or already fetched (unless forced)
    if (isFetchingRef.current || (!force && hasFetchedRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getDocumentTypes();

      if (result.success && result.data) {
        setData(result.data);
        hasFetchedRef.current = true;
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch document types'));
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const refetch = useCallback(async () => {
    hasFetchedRef.current = false;
    await fetchTypes(true);
  }, [fetchTypes]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
