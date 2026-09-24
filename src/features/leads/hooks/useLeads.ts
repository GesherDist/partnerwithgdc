/**
 * useLeads Hook
 *
 * Hook for fetching and managing leads list.
 * Uses server actions with client-side state management.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LeadListItem, LeadListParams, LeadStatus } from '../types';
import { getLeads, getLeadStats } from '../actions';

// ============================================
// TYPES
// ============================================

interface UseLeadsResult {
  data: LeadListItem[];
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

interface UseLeadsOptions {
  enabled?: boolean;
}

interface LeadStatsData {
  total: number;
  newThisMonth: number;
  qualified: number;
  converted: number;
  totalDealValue: number;
}

// ============================================
// useLeads HOOK
// ============================================

/**
 * Hook to fetch paginated leads list
 */
export function useLeads(
  params: LeadListParams = {},
  options: UseLeadsOptions = {}
): UseLeadsResult {
  const { enabled = true } = options;

  const [data, setData] = useState<LeadListItem[]>([]);
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

  const fetchLeads = useCallback(async (force = false) => {
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
      const result = await getLeads(params);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch leads'));
        setData([]);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch leads'));
      setData([]);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [enabled, params]);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Refetch function that forces a new fetch
  const refetch = useCallback(async () => {
    lastParamsRef.current = ''; // Clear last params to force refetch
    await fetchLeads(true);
  }, [fetchLeads]);

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
// useLeadStats HOOK
// ============================================

/**
 * Hook to fetch lead statistics
 */
export function useLeadStats() {
  const [data, setData] = useState<LeadStatsData>({
    total: 0,
    newThisMonth: 0,
    qualified: 0,
    converted: 0,
    totalDealValue: 0,
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
      const result = await getLeadStats();

      if (result.success && result.data) {
        setData(result.data);
        hasFetchedRef.current = true;
      } else {
        setIsError(true);
        setError(new Error(result.error || 'Failed to fetch lead stats'));
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch lead stats'));
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
// useLeadStatusCounts HOOK
// ============================================

/**
 * Hook to fetch lead counts by status
 */
export function useLeadStatusCounts() {
  const [data, setData] = useState<Record<LeadStatus, number>>({
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    negotiation: 0,
    deal: 0,
    converted: 0,
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
      // Fetch all leads and count by status
      const result = await getLeads({ limit: 10000 });

      if (result.success && result.data) {
        const counts: Record<LeadStatus, number> = {
          new: 0,
          contacted: 0,
          qualified: 0,
          proposal: 0,
          negotiation: 0,
          deal: 0,
          converted: 0,
          lost: 0,
        };

        for (const lead of result.data.data) {
          counts[lead.status] = (counts[lead.status] || 0) + 1;
        }

        setData(counts);
        hasFetchedRef.current = true;
      }
    } catch (err) {
      console.error('[useLeadStatusCounts] Error:', err);
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
