'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuditLogs } from '../actions';
import type { AuditLog, AuditLogListParams } from '../types';

interface UseAuditLogsResult {
  data: AuditLog[];
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

export function useAuditLogs(params: AuditLogListParams = {}): UseAuditLogsResult {
  const [data, setData] = useState<AuditLog[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 25,
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

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getAuditLogs(paramsRef.current);

      if (result.success && result.data) {
        // Convert date strings back to Date objects
        const logs = result.data.data.map((log) => ({
          ...log,
          createdAt: new Date(log.createdAt),
        }));
        setData(logs);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch audit logs');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useAuditLogs error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchAuditLogs();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchAuditLogs();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.search,
    params.action,
    params.module,
    params.userId,
    params.entityType,
    params.entityId,
    params.dateFrom,
    params.dateTo,
    params.sortOrder,
    fetchAuditLogs,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchAuditLogs,
  };
}
