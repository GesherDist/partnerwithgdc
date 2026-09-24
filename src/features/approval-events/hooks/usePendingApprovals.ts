'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingApprovals } from '../actions';
import type { ApprovalEventListItem } from '../types';

interface UsePendingApprovalsResult {
  data: ApprovalEventListItem[];
  count: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePendingApprovals(): UsePendingApprovalsResult {
  const [data, setData] = useState<ApprovalEventListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingApprovals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getPendingApprovals();

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch pending approvals');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('usePendingApprovals error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  return {
    data,
    count: data.length,
    isLoading,
    error,
    refetch: fetchPendingApprovals,
  };
}
