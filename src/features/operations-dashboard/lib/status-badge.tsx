/**
 * Shared Status Badge Utility
 *
 * Provides consistent status badge styling across all Operations Dashboard tabs.
 * All components should use this utility for status display.
 */

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import type { ShipmentStatus } from '../types';

// ============================================
// STATUS CONFIGURATION
// ============================================

export interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}

/**
 * Centralized status configuration
 * All tabs use the same labels and colors
 */
export const STATUS_CONFIG: Record<ShipmentStatus, StatusConfig> = {
  // Common statuses
  AVAILABLE: {
    label: 'Available',
    variant: 'outline',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
  OPEN: {
    label: 'Open',
    variant: 'outline',
    className: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  HOLD: {
    label: 'Hold',
    variant: 'outline',
    className: 'bg-red-50 text-red-700 border-red-300',
  },
  IN_TRANSIT: {
    label: 'In Transit',
    variant: 'outline',
    className: 'bg-purple-50 text-purple-700 border-purple-300',
  },
  SOLD: {
    label: 'Sold',
    variant: 'outline',
    className: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  CONFIRMED: {
    label: 'Confirmed',
    variant: 'outline',
    className: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  },
  PROCESSING: {
    label: 'Processing',
    variant: 'outline',
    className: 'bg-violet-50 text-violet-700 border-violet-300',
  },
  CLOSED: {
    label: 'Closed',
    variant: 'outline',
    className: 'bg-gray-50 text-gray-700 border-gray-300',
  },
  // Invoice/Payment statuses
  INVOICED: {
    label: 'Invoiced',
    variant: 'outline',
    className: 'bg-teal-50 text-teal-700 border-teal-300',
  },
  NOT_INVOICED: {
    label: 'Not Invoiced',
    variant: 'outline',
    className: 'bg-orange-50 text-orange-700 border-orange-300',
  },
  PARTIALLY_PAID: {
    label: 'Partially Paid',
    variant: 'outline',
    className: 'bg-cyan-50 text-cyan-700 border-cyan-300',
  },
  PAID: {
    label: 'Paid',
    variant: 'outline',
    className: 'bg-green-50 text-green-700 border-green-300',
  },
  DISPUTED: {
    label: 'Disputed',
    variant: 'destructive',
    className: '',
  },
  // Other statuses
  PO_NEEDED: {
    label: 'PO Needed',
    variant: 'outline',
    className: 'bg-pink-50 text-pink-700 border-pink-300',
  },
  DELIVERED: {
    label: 'Delivered',
    variant: 'outline',
    className: 'bg-slate-50 text-slate-700 border-slate-300',
  },
};

// ============================================
// STATUS BADGE COMPONENT
// ============================================

interface StatusBadgeProps {
  status: ShipmentStatus | string;
  isOverdue?: boolean;
  isDelayed?: boolean;
}

/**
 * Shared status badge component
 * Use this in all Operations Dashboard tables for consistent styling
 */
export function StatusBadge({ status, isOverdue = false, isDelayed = false }: StatusBadgeProps) {
  // Show DELAYED badge if delayed or overdue
  if (isDelayed || isOverdue) {
    return (
      <Badge variant="outline" className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-400">
        <AlertTriangle className="h-3 w-3" />
        Delayed
      </Badge>
    );
  }

  // Get config for status (with fallback)
  const config = STATUS_CONFIG[status as ShipmentStatus] || {
    label: status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    variant: 'secondary' as const,
    className: '',
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

/**
 * Get status label (for non-React contexts)
 */
export function getStatusLabel(status: ShipmentStatus | string): string {
  const config = STATUS_CONFIG[status as ShipmentStatus];
  if (config) {
    return config.label;
  }
  // Fallback: Convert "IN_TRANSIT" to "In Transit"
  return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
