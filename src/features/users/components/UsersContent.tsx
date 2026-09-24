'use client';

/**
 * Users Content
 *
 * Client shell for the users admin page: live stat cards plus the table.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized cards array with useMemo
 * - Server-side initial data hydration for faster FCP/LCP
 */

import { memo, useMemo } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';

import { useUserStatusCounts } from '../hooks/use-users';
import { UsersTable } from './UsersTable';
import type { UserStatusCounts } from '../types';

// ============================================
// TYPES
// ============================================

interface UsersContentProps {
  /** Initial users data from server (for React Query hydration) */
  initialUsers?: unknown;
  /** Initial counts data from server (for React Query hydration) */
  initialCounts?: UserStatusCounts | null;
}

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  label: string;
  value: number | undefined;
  loading: boolean;
}

const StatCard = memo(function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">
          {loading || value === undefined ? '—' : value}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
});

// ============================================
// COMPONENT
// ============================================

function UsersContentComponent({ initialUsers, initialCounts }: UsersContentProps) {
  const { counts, loading, refetch } = useUserStatusCounts(initialCounts);

  // Memoized cards data
  const cards = useMemo(() => [
    { label: 'Total Users', value: counts?.total },
    { label: 'Active Users', value: counts?.active },
    { label: 'Pending', value: counts?.pending },
    { label: 'Inactive', value: (counts?.inactive ?? 0) + (counts?.suspended ?? 0) },
  ], [counts]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            loading={loading}
          />
        ))}
      </div>

      <UsersTable onDataChange={refetch} initialData={initialUsers} />
    </div>
  );
}

// Export memoized component
export const UsersContent = memo(UsersContentComponent);
