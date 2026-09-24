'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getShipment } from '../actions';
import type { ShipmentWithItems } from '../types';

interface UseShipmentResult {
  data: ShipmentWithItems | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useShipment(id: string | null): UseShipmentResult {
  const [data, setData] = useState<ShipmentWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef(id);

  useEffect(() => {
    idRef.current = id;
  }, [id]);

  const fetchShipment = useCallback(async () => {
    if (!idRef.current) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getShipment(idRef.current);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch shipment');
        setData(null);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setData(null);
      console.error('useShipment error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchShipment();
    } else {
      setData(null);
      setIsLoading(false);
      setError(null);
    }
  }, [id, fetchShipment]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchShipment,
  };
}
