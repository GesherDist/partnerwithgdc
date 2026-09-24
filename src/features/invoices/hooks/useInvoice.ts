'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getInvoice } from '../actions';
import type { InvoiceWithItems } from '../types';

interface UseInvoiceResult {
  data: InvoiceWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useInvoice(id: string | null): UseInvoiceResult {
  const [data, setData] = useState<InvoiceWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef(id);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const fetchInvoice = useCallback(async () => {
    if (!idRef.current) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getInvoice(idRef.current);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch invoice');
        setData(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setData(null);
      console.error('useInvoice error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchInvoice();
    } else {
      setData(null);
      setIsLoading(false);
      setError(null);
    }
  }, [id, fetchInvoice]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchInvoice,
  };
}
