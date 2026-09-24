'use client';

/**
 * React Query Provider
 *
 * Provides the QueryClient context to the application.
 * Must be used in a client component due to React Query requirements.
 *
 * Usage:
 * ```tsx
 * // In layout.tsx or a parent component
 * import { QueryProvider } from '@/shared/providers/query-provider';
 *
 * export default function Layout({ children }) {
 *   return <QueryProvider>{children}</QueryProvider>;
 * }
 * ```
 */

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/shared/lib/query';

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient instance once per component lifecycle
  // Using useState ensures the client is created only once on the client
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
