'use client';

/**
 * DashboardSystemStatus Component
 *
 * Displays system health status indicators.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { SystemStatus, SystemHealthStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface DashboardSystemStatusProps {
  status: SystemStatus;
  title?: string;
  description?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusIndicator(status: SystemHealthStatus): {
  color: string;
  label: string;
} {
  switch (status) {
    case 'operational':
      return { color: 'bg-emerald-500', label: 'Operational' };
    case 'degraded':
      return { color: 'bg-amber-500', label: 'Degraded' };
    case 'down':
      return { color: 'bg-red-500', label: 'Down' };
    default:
      return { color: 'bg-gray-500', label: 'Unknown' };
  }
}

// ============================================
// COMPONENT
// ============================================

export function DashboardSystemStatus({
  status,
  title = 'System Status',
  description = 'Current system health',
}: DashboardSystemStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {status.items.map((item) => {
            const indicator = getStatusIndicator(item.status);

            return (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.name}</span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className={`h-2 w-2 rounded-full ${indicator.color}`} />
                  {item.message || indicator.label}
                </span>
              </div>
            );
          })}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm">Last Sync</span>
            <span className="text-xs text-muted-foreground">{status.lastSync}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
