'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listInvoices } from '../actions';
import type { InvoiceListItem, InvoiceListParams } from '../types';

interface UseInvoicesResult {
  data: InvoiceListItem[];
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

export function useInvoices(params: InvoiceListParams = {}): UseInvoicesResult {
  const [data, setData] = useState<InvoiceListItem[]>([]);
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

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listInvoices(paramsRef.current);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch invoices');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useInvoices error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchInvoices();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchInvoices();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.search,
    params.status,
    params.customerId,
    params.dateFrom,
    params.dateTo,
    params.sortBy,
    params.sortOrder,
    fetchInvoices,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchInvoices,
  };
}
