'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listApprovalEvents } from '../actions';
import type { ApprovalEventListItem, ApprovalEventListParams } from '../types';

interface UseApprovalEventsResult {
  data: ApprovalEventListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApprovalEvents(params: ApprovalEventListParams = {}): UseApprovalEventsResult {
  const [data, setData] = useState<ApprovalEventListItem[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const fetchApprovalEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listApprovalEvents(paramsRef.current);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch approval events');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useApprovalEvents error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchApprovalEvents();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchApprovalEvents();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.eventType,
    params.subjectType,
    params.subjectId,
    params.status,
    params.requestedBy,
    params.decidedBy,
    params.sortBy,
    params.sortOrder,
    fetchApprovalEvents,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchApprovalEvents,
  };
}
