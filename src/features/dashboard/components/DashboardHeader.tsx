'use client';

/**
 * DashboardHeader Component
 *
 * Welcome header with user greeting and primary actions.
 * Gets user name from auth store (hydrated by layout).
 */

import { useAuthStore } from '@/shared/stores';

// ============================================
// TYPES
// ============================================

interface DashboardHeaderProps {
  title?: string;
  description?: string;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardHeader({
  title = 'Dashboard',
  description,
}: DashboardHeaderProps) {
  const { appUser } = useAuthStore();
  const userName = appUser?.firstName || 'User';
  const greeting = description || `Welcome back, ${userName}! Here's what's happening today.`;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-muted-foreground">{greeting}</p>
      </div>
      <div className="flex gap-2">
      </div>
    </div>
  );
}
