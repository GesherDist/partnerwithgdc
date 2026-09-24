'use client';

/**
 * Products Query Hooks
 *
 * React Query hooks for fetching products and their categories.
 * Paging, searching and filtering all happen on the server - the table only
 * ever holds the current page, so the list stays fast as the catalog grows.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/shared/lib/query';

import type { ProductTableRow, ProductListParams } from '../types';

// ============================================
// TYPES
// ============================================

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ProductsData {
  products: ProductTableRow[];
  meta: ListMeta | null;
}

interface UseProductsResult {
  products: ProductTableRow[];
  meta: ListMeta | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseProductCategoriesResult {
  categories: string[];
  loading: boolean;
  error: string | null;
}

// ============================================
// API FETCHERS
// ============================================

/**
 * Fetch a page of products from the API
 */
async function fetchProducts(params: ProductListParams): Promise<ProductsData> {
  const query = new URLSearchParams();

  if (params.page) {query.set('page', String(params.page));}
  if (params.limit) {query.set('limit', String(params.limit));}
  if (params.search) {query.set('search', params.search);}
  if (params.status) {query.set('status', params.status);}
  if (params.category) {query.set('category', params.category);}
  if (params.isSellable !== undefined) {query.set('isSellable', String(params.isSellable));}
  if (params.sortBy) {query.set('sortBy', String(params.sortBy));}
  if (params.sortOrder) {query.set('sortOrder', params.sortOrder);}

  const response = await fetch(`/api/products?${query.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch products');
  }

  // Dates survive JSON as strings - rebuild them so the table can format
  const rows: ProductTableRow[] = (data.data?.data ?? []).map(
    (row: ProductTableRow & { createdAt: string }) => ({
      ...row,
      createdAt: new Date(row.createdAt),
    })
  );

  return {
    products: rows,
    meta: data.data?.meta ?? null,
  };
}

/**
 * Fetch the distinct categories currently in use
 */
async function fetchProductCategories(): Promise<string[]> {
  // The list endpoint returns up to 100 rows; categories come from a dedicated
  // pass over the catalog so the filter is not limited to the current page.
  const response = await fetch('/api/products/categories');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch categories');
  }

  return data.data ?? [];
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch a page of products
 *
 * @param params - Pagination, filtering, and sorting parameters
 * @param initialData - Server-side fetched data for hydration (improves FCP/LCP)
 */
export function useProducts(params: ProductListParams = {}, initialData?: unknown): UseProductsResult {
  const serverData = initialData as { data?: ProductTableRow[]; meta?: ListMeta } | undefined;
  const transformedInitialData: ProductsData | undefined = serverData?.data
    ? {
        products: serverData.data.map((row) => ({
          ...row,
          createdAt: new Date(row.createdAt),
        })),
        meta: serverData.meta ?? null,
      }
    : undefined;

  const query = useQuery({
    queryKey: queryKeys.products.list({
      ...params,
      sortBy: params.sortBy ? String(params.sortBy) : undefined,
    }),
    queryFn: () => fetchProducts(params),
    // The catalog changes less often than users, but stale prices are costly
    staleTime: 30 * 1000,
    initialData: transformedInitialData,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    products: query.data?.products ?? [],
    meta: query.data?.meta ?? null,
    loading: query.isLoading || query.isFetching,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch the distinct product categories (for the filter dropdown)
 */
export function useProductCategories(initialData?: string[]): UseProductCategoriesResult {
  const query = useQuery({
    queryKey: queryKeys.products.categories(),
    queryFn: fetchProductCategories,
    // Categories rarely change - cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    initialData,
  });

  return {
    categories: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
