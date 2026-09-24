'use client';

/**
 * Supplier Dashboard
 *
 * Main dashboard view for supplier portal.
 * Shows KPIs, pending actions, and recent activity.
 */

import { useState } from 'react';
import {
  ClipboardList,
  Clock,
  Factory,
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { cn, formatCurrency, formatDate } from '@/shared/lib/utils';
import type { SupplierDashboardStats, SupplierPurchaseOrder } from '../types';
import { SupplierPODrawer } from './SupplierPODrawer';

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'warning' | 'success' | 'info';
  href?: string;
}

function StatCard({ title, value, icon: Icon, variant = 'default', href }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    warning: 'bg-amber-50 dark:bg-amber-950/30',
    success: 'bg-emerald-50 dark:bg-emerald-950/30',
    info: 'bg-blue-50 dark:bg-blue-950/30',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    info: 'text-blue-600',
  };

  const content = (
    <Card className={cn('transition-shadow hover:shadow-md', variantStyles[variant])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full bg-background',
              iconStyles[variant]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

// ============================================
// PENDING ACTION ITEM
// ============================================

interface PendingActionItemProps {
  po: SupplierPurchaseOrder;
  onReview: (po: SupplierPurchaseOrder) => void;
}

function PendingActionItem({ po, onReview }: PendingActionItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{po.poNumber}</span>
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Awaiting Confirmation
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          <span>Received: {formatDate(po.poDate)}</span>
          <span className="mx-2">|</span>
          <span>Total: {formatCurrency(po.grandTotal / 100)}</span>
        </div>
      </div>
      <Button size="sm" onClick={() => onReview(po)}>
        Review
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================

interface SupplierDashboardProps {
  stats: SupplierDashboardStats;
  pendingPOs: SupplierPurchaseOrder[];
  supplierName: string;
  onRefresh?: () => void;
}

export function SupplierDashboard({
  stats,
  pendingPOs,
  supplierName,
  onRefresh,
}: SupplierDashboardProps) {
  const [selectedPO, setSelectedPO] = useState<SupplierPurchaseOrder | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleReviewPO = (po: SupplierPurchaseOrder) => {
    setSelectedPO(po);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedPO(null);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome, {supplierName}</h1>
        <p className="text-muted-foreground">
          Here&apos;s an overview of your orders and shipments.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ClipboardList}
          href="/supplier-portal/purchase-orders"
        />
        <StatCard
          title="Pending Confirmation"
          value={stats.pendingConfirmation}
          icon={Clock}
          variant={stats.pendingConfirmation > 0 ? 'warning' : 'default'}
          href="/supplier-portal/purchase-orders?status=pending"
        />
        <StatCard
          title="In Production"
          value={stats.inProduction}
          icon={Factory}
          variant="info"
          href="/supplier-portal/purchase-orders?production_status=in_production"
        />
        <StatCard
          title="Ready to Ship"
          value={stats.readyToShip}
          icon={Package}
          variant="success"
          href="/supplier-portal/purchase-orders?production_status=ready_to_ship"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="In Transit"
          value={stats.inTransit}
          icon={Truck}
          href="/supplier-portal/shipments?status=in_transit"
        />
        <StatCard
          title="Delivered"
          value={stats.delivered}
          icon={CheckCircle2}
          variant="success"
          href="/supplier-portal/shipments?status=delivered"
        />
        <StatCard
          title="Delayed"
          value={stats.delayed}
          icon={AlertTriangle}
          variant={stats.delayed > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Action Required Section */}
      {pendingPOs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Action Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPOs.slice(0, 5).map((po) => (
              <PendingActionItem key={po.id} po={po} onReview={handleReviewPO} />
            ))}
            {pendingPOs.length > 5 && (
              <Link
                href="/supplier-portal/purchase-orders?status=pending"
                className="block text-center text-sm text-primary hover:underline"
              >
                View all {pendingPOs.length} pending orders
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* PO Detail Drawer */}
      <SupplierPODrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        purchaseOrder={selectedPO}
        onRefresh={onRefresh}
      />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/supplier-portal/purchase-orders">
              <Button variant="outline">
                <ClipboardList className="mr-2 h-4 w-4" />
                View All Orders
              </Button>
            </Link>
            <Link href="/supplier-portal/shipments">
              <Button variant="outline">
                <Truck className="mr-2 h-4 w-4" />
                View Shipments
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
