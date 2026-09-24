/**
 * useSalesOrderMasterData Hook
 *
 * Centralized hook for fetching and caching master data.
 * Uses server actions with client-side caching.
 *
 * Future Integration:
 * - Replace with useQuery from @tanstack/react-query
 * - Add queryKey: ['salesOrders', 'masterData']
 * - Add staleTime for caching
 * - Add automatic request deduplication
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SalesOrderMasterData, Customer, Product, Warehouse, SalesRep } from '../types';
import { getSalesOrderMasterData } from '../actions';
import { MOCK_MASTER_DATA } from '../lib/mock-data';
// Permanent configuration data (won't break if mock-data.ts is deleted)
import {
  SHIPPING_METHODS,
  CURRENCIES,
  UNITS,
  TAX_RATES,
} from '@/shared/lib/global-data';

interface UseSalesOrderMasterDataResult {
  data: SalesOrderMasterData;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Cache the master data at module level
let cachedMasterData: SalesOrderMasterData | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch and cache sales order master data.
 *
 * Master data includes:
 * - Customers
 * - Products
 * - Warehouses
 * - Sales Representatives
 * - Currencies
 * - Shipping Methods
 * - Units
 * - Tax Rates
 *
 * This data is fetched once and shared across all components
 * in the Sales Order module to avoid duplicate API requests.
 */
export function useSalesOrderMasterData(): UseSalesOrderMasterDataResult {
  const [data, setData] = useState<SalesOrderMasterData>(cachedMasterData || MOCK_MASTER_DATA);
  const [isLoading, setIsLoading] = useState(!cachedMasterData);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMasterData = useCallback(async () => {
    // Check cache validity
    const now = Date.now();
    if (cachedMasterData && (now - cacheTimestamp) < CACHE_DURATION) {
      setData(cachedMasterData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);
    setError(null);

    try {
      const result = await getSalesOrderMasterData();

      if (result.success && result.data) {
        // Transform to match expected format
        const masterData: SalesOrderMasterData = {
          customers: (result.data.customers || []).map((c): Customer => ({
            id: c.id,
            code: c.code,
            name: c.name,
            email: c.email || '',
            phone: c.phone || '',
            billingAddress: {
              street: '',
              city: '',
              state: '',
              postalCode: '',
              country: 'US',
            },
            shippingAddress: {
              street: '',
              city: '',
              state: '',
              postalCode: '',
              country: 'US',
            },
          })),
          products: (result.data.products || []).map((p): Product => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            description: p.description || '',
            unitPrice: p.unitPrice / 100, // Convert from cents to dollars
            unitId: 'EA', // Default unit code
          })),
          warehouses: (result.data.warehouses || []).map((w): Warehouse => ({
            id: w.id,
            code: w.code,
            name: w.name,
          })),
          salesReps: (result.data.salesReps || []).map((u): SalesRep => ({
            id: u.id,
            name: u.name,
            email: u.email,
          })),
          // Permanent configuration from global-data.ts
          // (Could be fetched from database in the future)
          currencies: CURRENCIES,
          shippingMethods: SHIPPING_METHODS,
          units: UNITS,
          taxRates: TAX_RATES,
        };

        cachedMasterData = masterData;
        cacheTimestamp = now;
        setData(masterData);
      } else {
        // Fall back to mock data on error
        setData(MOCK_MASTER_DATA);
        console.warn('Failed to fetch master data, using mock data:', result.error);
      }
    } catch (err) {
      setIsError(true);
      setError(err instanceof Error ? err : new Error('Failed to fetch master data'));
      // Fall back to mock data on error
      setData(MOCK_MASTER_DATA);
      console.warn('Error fetching master data, using mock data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  return {
    data,
    isLoading,
    isError,
    error,
    refetch: fetchMasterData,
  };
}

/**
 * Helper hook to get a specific customer by ID
 */
export function useCustomerById(customerId: string | undefined) {
  const { data } = useSalesOrderMasterData();

  return useMemo(() => {
    if (!customerId) {return null;}
    return data.customers.find((c) => c.id === customerId) ?? null;
  }, [data.customers, customerId]);
}

/**
 * Helper hook to get a specific product by ID
 */
export function useProductById(productId: string | undefined) {
  const { data } = useSalesOrderMasterData();

  return useMemo(() => {
    if (!productId) {return null;}
    return data.products.find((p) => p.id === productId) ?? null;
  }, [data.products, productId]);
}

/**
 * Clear the master data cache
 */
export function clearMasterDataCache() {
  cachedMasterData = null;
  cacheTimestamp = 0;
}
