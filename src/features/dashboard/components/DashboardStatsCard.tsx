'use client';

/**
 * DashboardStatsCard Component
 *
 * Displays a single stat card with icon, value, and trend.
 */

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { DashboardStat } from '../types';
import { getIcon } from '../lib/icons';

// ============================================
// TYPES
// ============================================

interface DashboardStatsCardProps {
  stat: DashboardStat;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardStatsCard({ stat }: DashboardStatsCardProps) {
  const Icon = getIcon(stat.icon);
  const isUp = stat.trend === 'up';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {stat.title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${stat.color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stat.value}</div>
        {stat.subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {stat.subtitle}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isUp ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={isUp ? 'text-emerald-500' : 'text-red-500'}>
            {stat.change}
          </span>
          <span className="text-muted-foreground">from last month</span>
          {stat.target && (
            <>
              <span className="text-muted-foreground mx-1">|</span>
              <span className="text-muted-foreground">Target: {stat.target}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// STATS GRID COMPONENT
// ============================================

interface DashboardStatsGridProps {
  stats: DashboardStat[];
}

export function DashboardStatsGrid({ stats }: DashboardStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <DashboardStatsCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}
