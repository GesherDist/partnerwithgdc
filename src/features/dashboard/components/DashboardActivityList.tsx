'use client';

/**
 * DashboardActivityList Component
 *
 * Displays recent activity items in a list format.
 */

import { CheckCircle2, AlertCircle, Clock, AlertTriangle, MoreHorizontal } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

import type { DashboardActivity, ActivityStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface DashboardActivityListProps {
  activities: DashboardActivity[];
  title?: string;
  description?: string;
}

interface ActivityItemProps {
  activity: DashboardActivity;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getStatusIcon(status: ActivityStatus) {
  switch (status) {
    case 'success':
      return CheckCircle2;
    case 'warning':
      return AlertCircle;
    case 'error':
      return AlertTriangle;
    case 'info':
    default:
      return Clock;
  }
}

function getStatusStyles(status: ActivityStatus): string {
  switch (status) {
    case 'success':
      return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'warning':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    case 'error':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'info':
    default:
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
  }
}

// ============================================
// ACTIVITY ITEM COMPONENT
// ============================================

function ActivityItem({ activity }: ActivityItemProps) {
  const Icon = getStatusIcon(activity.status);
  const statusStyles = getStatusStyles(activity.status);

  return (
    <div className="flex items-start gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className={`mt-0.5 rounded-full p-1.5 ${statusStyles}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium">{activity.title}</p>
        <p className="text-xs text-muted-foreground">{activity.description}</p>
      </div>
      <span className="text-xs text-muted-foreground">{activity.time}</span>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DashboardActivityList({
  activities,
  title = 'Recent Activity',
  description = 'Latest updates from your operations',
}: DashboardActivityListProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length > 0 ? (
            activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
