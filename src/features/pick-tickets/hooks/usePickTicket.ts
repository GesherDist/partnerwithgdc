'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPickTicket } from '../actions';
import type { PickTicketWithItems } from '../types';

export function usePickTicket(pickTicketId: string | null) {
  const [data, setData] = useState<PickTicketWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPickTicket = useCallback(async () => {
    if (!pickTicketId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPickTicket(pickTicketId);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch pick ticket');
        setData(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [pickTicketId]);

  useEffect(() => {
    fetchPickTicket();
  }, [fetchPickTicket]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchPickTicket,
  };
}
