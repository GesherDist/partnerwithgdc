'use client';

/**
 * Shipment Status Mix Component
 *
 * Shows shipment/inventory status breakdown:
 * - AVAILABLE, SOLD, OPEN, HOLD, IN_TRANSIT, INVOICED
 * - Loads and Qty for each status
 * - Visual bar chart
 */

import { BarChart3 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { ShipmentStatusMix as ShipmentStatusMixType, ShipmentStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface ShipmentStatusMixProps {
  data: ShipmentStatusMixType[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

function getStatusColor(status: ShipmentStatus): string {
  const colors: Record<ShipmentStatus, string> = {
    // Common statuses
    AVAILABLE: 'bg-emerald-500',
    OPEN: 'bg-amber-500',
    HOLD: 'bg-red-500',
    IN_TRANSIT: 'bg-purple-500',
    SOLD: 'bg-blue-500',
    CLOSED: 'bg-gray-500',
    // Invoice/Payment statuses
    INVOICED: 'bg-cyan-500',
    NOT_INVOICED: 'bg-orange-500',
    PARTIALLY_PAID: 'bg-sky-500',
    PAID: 'bg-teal-500',
    DISPUTED: 'bg-rose-500',
    // Other statuses
    PO_NEEDED: 'bg-pink-500',
    DELIVERED: 'bg-green-600',
    CONFIRMED: 'bg-indigo-500',
    PROCESSING: 'bg-violet-500',
  };
  return colors[status] || 'bg-gray-500';
}

function getStatusLabel(status: ShipmentStatus): string {
  return status.replace('_', ' ');
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ShipmentStatusMix({ data }: ShipmentStatusMixProps) {
  // Only show statuses that have records (loads > 0 or qty > 0)
  const displayData: ShipmentStatusMixType[] = data.filter(item => item.loads > 0 || item.qty > 0);

  const totalQty = displayData.reduce((sum, item) => sum + item.qty, 0);
  const totalLoads = displayData.reduce((sum, item) => sum + item.loads, 0);
  const maxQty = Math.max(...displayData.map(item => item.qty), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Shipment / Inventory Status Mix
            </CardTitle>
            <CardDescription>
              {formatNumber(totalQty)} units across {totalLoads} loads
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayData.map((item) => {
            const percentage = totalQty > 0 ? (item.qty / totalQty) * 100 : 0;
            const barWidth = maxQty > 0 ? (item.qty / maxQty) * 100 : 0;

            return (
              <div key={item.status} className="flex items-center gap-3">
                <div className="w-[100px] text-sm font-medium">
                  {getStatusLabel(item.status)}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="w-[50px] text-sm text-right text-muted-foreground">
                    {item.loads}
                  </div>
                  <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 ${getStatusColor(item.status)} transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {formatNumber(item.qty)}
                    </span>
                  </div>
                  <div className="w-[50px] text-sm text-right text-muted-foreground">
                    {percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend - only show statuses with data */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4">
          {displayData.filter(item => item.qty > 0).map((item) => (
            <div key={item.status} className="flex items-center gap-1.5 text-xs">
              <div className={`w-3 h-3 rounded ${getStatusColor(item.status)}`} />
              <span className="text-muted-foreground">{getStatusLabel(item.status)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
