'use client';

/**
 * Operations Stats Grid Component
 *
 * KPI cards matching Jenny's Executive Summary:
 * - Available inventory qty
 * - Available loads
 * - Available inventory value
 * - Committed customer qty
 * - In Transit / Next 7 Days
 */

import {
  Package,
  Truck,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { OperationsStats } from '../types';

// ============================================
// TYPES
// ============================================

interface OperationsStatsGridProps {
  stats: OperationsStats;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  highlight?: boolean;
}

function StatCard({ title, value, subtitle, icon, iconBgColor, highlight }: StatCardProps) {
  return (
    <Card className={highlight ? 'ring-2 ring-amber-500 ring-offset-2' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${iconBgColor}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function OperationsStatsGrid({ stats }: OperationsStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Available Inventory"
        value={formatNumber(stats.availableInventoryQty)}
        subtitle="units"
        icon={<Package className="h-4 w-4 text-white" />}
        iconBgColor="bg-blue-600"
      />
      <StatCard
        title="Available Loads"
        value={formatNumber(stats.availableLoads)}
        subtitle="loads"
        icon={<Truck className="h-4 w-4 text-white" />}
        iconBgColor="bg-emerald-600"
      />
      <StatCard
        title="Inventory Value"
        value={formatCurrency(stats.availableInventoryValue)}
        icon={<DollarSign className="h-4 w-4 text-white" />}
        iconBgColor="bg-violet-600"
      />
      <StatCard
        title="Customer Committed"
        value={formatNumber(stats.committedCustomerQty)}
        subtitle="units"
        icon={<Users className="h-4 w-4 text-white" />}
        iconBgColor="bg-amber-600"
      />
      <StatCard
        title="In Transit / Next 7 Days"
        value={formatNumber(stats.inTransitNext7Days)}
        subtitle="loads"
        icon={<Clock className="h-4 w-4 text-white" />}
        iconBgColor="bg-red-600"
        highlight={stats.inTransitNext7Days > 0}
      />
    </div>
  );
}
