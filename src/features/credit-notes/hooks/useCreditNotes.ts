'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listCreditNotes } from '../actions';
import type { CreditNoteListItem, CreditNoteListParams } from '../types';

interface UseCreditNotesResult {
  data: CreditNoteListItem[];
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

export function useCreditNotes(params: CreditNoteListParams = {}): UseCreditNotesResult {
  const [data, setData] = useState<CreditNoteListItem[]>([]);
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

  const fetchCreditNotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listCreditNotes(paramsRef.current);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch credit notes');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useCreditNotes error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchCreditNotes();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchCreditNotes();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.search,
    params.status,
    params.customerId,
    params.invoiceId,
    params.reason,
    params.dateFrom,
    params.dateTo,
    params.sortBy,
    params.sortOrder,
    fetchCreditNotes,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchCreditNotes,
  };
}
