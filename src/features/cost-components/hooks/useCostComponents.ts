'use client';

import { useState, useEffect, useCallback } from 'react';
import { listCostComponents } from '../actions';
import type { CostComponent, CostComponentListParams } from '../types';

interface UseCostComponentsResult {
  data: CostComponent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCostComponents(params: CostComponentListParams = {}): UseCostComponentsResult {
  const [data, setData] = useState<CostComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCostComponents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listCostComponents(params);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch cost components');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('useCostComponents error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.purchaseOrderId, params.purchaseOrderItemId, params.componentType]);

  useEffect(() => {
    fetchCostComponents();
  }, [fetchCostComponents]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCostComponents,
  };
}
