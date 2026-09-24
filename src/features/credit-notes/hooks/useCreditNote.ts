'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCreditNote } from '../actions';
import type { CreditNoteWithItems } from '../types';

interface UseCreditNoteResult {
  data: CreditNoteWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCreditNote(id: string | null): UseCreditNoteResult {
  const [data, setData] = useState<CreditNoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditNote = useCallback(async () => {
    if (!id) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCreditNote(id);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch credit note');
        setData(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setData(null);
      console.error('useCreditNote error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCreditNote();
  }, [fetchCreditNote]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCreditNote,
  };
}
