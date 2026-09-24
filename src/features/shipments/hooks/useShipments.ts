'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { listShipments } from '../actions';
import type { ShipmentListItem, ShipmentListParams } from '../types';

interface UseShipmentsResult {
  data: ShipmentListItem[];
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

export function useShipments(params: ShipmentListParams = {}): UseShipmentsResult {
  const [data, setData] = useState<ShipmentListItem[]>([]);
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

  const fetchShipments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listShipments(paramsRef.current);

      if (result.success && result.data) {
        setData(result.data.data);
        setMeta(result.data.meta);
      } else {
        setError(result.error || 'Failed to fetch shipments');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useShipments error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchShipments();
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchShipments();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    params.page,
    params.limit,
    params.search,
    params.status,
    params.carrier,
    params.dateFrom,
    params.dateTo,
    params.sortBy,
    params.sortOrder,
    fetchShipments,
  ]);

  return {
    data,
    meta,
    isLoading,
    error,
    refetch: fetchShipments,
  };
}
