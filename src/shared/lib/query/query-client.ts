/**
 * React Query Client Configuration
 *
 * Centralized configuration for TanStack Query (React Query).
 * This file sets up the QueryClient with enterprise-grade defaults.
 */

import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

/**
 * Default options for all queries
 *
 * These can be overridden per-query when needed.
 */
const defaultQueryOptions: DefaultOptions['queries'] = {
  /**
   * Time in milliseconds that cached data is considered fresh.
   * During this time, no background refetch will occur.
   * Default: 30 seconds
   */
  staleTime: 30 * 1000,

  /**
   * Time in milliseconds that unused/inactive cache data remains in memory.
   * After this time, inactive queries are garbage collected.
   * Default: 5 minutes
   */
  gcTime: 5 * 60 * 1000,

  /**
   * Whether to refetch on window focus.
   * Disabled to prevent unexpected refetches when switching tabs.
   */
  refetchOnWindowFocus: false,

  /**
   * Whether to refetch when component mounts.
   * Enabled to ensure fresh data on navigation.
   */
  refetchOnMount: true,

  /**
   * Whether to refetch when reconnecting to the internet.
   * Useful for mobile/unstable connections.
   */
  refetchOnReconnect: true,

  /**
   * Number of retry attempts for failed queries.
   * Default: 1 (one retry after initial failure)
   */
  retry: 1,

  /**
   * Delay between retry attempts.
   * Uses exponential backoff: 1s, 2s, 4s...
   */
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Default options for all mutations
 */
const defaultMutationOptions: DefaultOptions['mutations'] = {
  /**
   * Number of retry attempts for failed mutations.
   * Default: 0 (no retries for mutations to prevent duplicate operations)
   */
  retry: 0,
};

/**
 * Create a new QueryClient instance
 *
 * This should be called once per application/session.
 * For Next.js, this is typically done in a client provider component.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
      mutations: defaultMutationOptions,
    },
  });
}

/**
 * Singleton QueryClient for use in components
 *
 * This pattern ensures we don't create a new QueryClient on every render.
 * The actual instance is created in the QueryProvider.
 */
let browserQueryClient: QueryClient | undefined;

/**
 * Get the QueryClient instance
 *
 * On the server, always creates a new client.
 * On the client, reuses the existing client or creates one.
 */
export function getQueryClient(): QueryClient {
  // Server-side: always create a new client
  if (typeof window === 'undefined') {
    return createQueryClient();
  }

  // Client-side: reuse the existing client or create one
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient();
  }

  return browserQueryClient;
}
