/**
 * useCustomerContacts Hook
 *
 * Hook for fetching and managing customer contacts.
 * Uses server actions with client-side state management.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CustomerContactListItem } from '../types';
import { getCustomerContacts } from '../actions/customer-contact.actions';

interface UseCustomerContactsResult {
  data: CustomerContactListItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseCustomerContactsOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch contacts for a specific customer
 */
export function useCustomerContacts(
  customerId: string | null,
  options: UseCustomerContactsOptions = {}
): UseCustomerContactsResult {
  const { enabled = true } = options;

  const [data, setData] = useState<CustomerContactListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  // Track the last fetched customer ID
  const lastCustomerIdRef = useRef<string | null>(null);

  const fetchContacts = useCallback(async (force = false) => {
    if (!enabled || !customerId) {
      setIsLoading(false);
      setData([]);
      return;
    }

    // Skip if already fetching or customer ID hasn't changed (unless forced)
    if (!force && (isFetchingRef.current || customerId === lastCustomerIdRef.current)) {
      return;
    }

    isFetchingRef.current = true;
    lastCustomerIdRef.current = customerId;
    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getCustomerContacts(customerId);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch contacts'));
        setData([]);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch contacts'));
      setData([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, customerId]);

  // Fetch on mount and when customerId changes
  useEffect(() => {
    if (customerId) {
      fetchContacts();
    } else {
      setData([]);
      setIsLoading(false);
    }
  }, [fetchContacts, customerId]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastCustomerIdRef.current = null; // Clear to force refetch
    await fetchContacts(true);
  }, [fetchContacts]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch,
  };
}
