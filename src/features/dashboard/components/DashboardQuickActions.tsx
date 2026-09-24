'use client';

/**
 * DashboardQuickActions Component
 *
 * Displays a grid of quick action buttons for common tasks.
 */

import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

import type { QuickAction } from '../types';
import { getIcon } from '../lib/icons';

// ============================================
// TYPES
// ============================================

interface DashboardQuickActionsProps {
  actions: QuickAction[];
  title?: string;
  description?: string;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardQuickActions({
  actions,
  title = 'Quick Actions',
  description = 'Common tasks and shortcuts',
}: DashboardQuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => {
            const Icon = action.icon ? getIcon(action.icon) : null;

            return (
              <Button
                key={action.id}
                variant="outline"
                className="h-auto flex-col gap-1 py-4 text-foreground"
                asChild
              >
                <Link href={action.href}>
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs font-medium">{action.label}</span>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
