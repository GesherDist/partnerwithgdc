'use client';

/**
 * InventoryOverview Component
 *
 * Shows inventory levels by location and SKU.
 * Nebraska, Kansas, and Drop-ship locations.
 */

import { Warehouse, AlertTriangle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { InventoryByLocation } from '../types';

// ============================================
// TYPES
// ============================================

interface InventoryOverviewProps {
  byLocation: InventoryByLocation[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDaysOfCoverBadge(days: number) {
  if (days === 0) {
    return <Badge variant="outline" className="text-muted-foreground">N/A</Badge>;
  }
  if (days < 30) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        {days}d
      </Badge>
    );
  }
  if (days < 45) {
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{days}d</Badge>;
  }
  return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{days}d</Badge>;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryOverview({ byLocation }: InventoryOverviewProps) {
  const totalOnHand = byLocation.reduce((sum, loc) => sum + loc.onHand, 0);
  const totalAllocated = byLocation.reduce((sum, loc) => sum + loc.allocated, 0);
  const totalAvailable = byLocation.reduce((sum, loc) => sum + loc.available, 0);
  const totalInTransit = byLocation.reduce((sum, loc) => sum + loc.inTransit, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              Inventory Overview
            </CardTitle>
            <CardDescription>Stock levels by location</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold">{totalOnHand}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Available: </span>
              <span className="font-semibold text-emerald-600">{totalAvailable}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">On Hand</TableHead>
              <TableHead className="text-right">Allocated</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">In Transit</TableHead>
              <TableHead className="text-right">Days Cover</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byLocation.map((location) => (
              <TableRow key={location.location}>
                <TableCell className="font-medium">{location.location}</TableCell>
                <TableCell className="text-right">{location.onHand}</TableCell>
                <TableCell className="text-right text-amber-600">{location.allocated}</TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">
                  {location.available}
                </TableCell>
                <TableCell className="text-right text-blue-600">{location.inTransit}</TableCell>
                <TableCell className="text-right">
                  {getDaysOfCoverBadge(location.daysOfCover)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{totalOnHand}</TableCell>
              <TableCell className="text-right text-amber-600">{totalAllocated}</TableCell>
              <TableCell className="text-right text-emerald-600">{totalAvailable}</TableCell>
              <TableCell className="text-right text-blue-600">{totalInTransit}</TableCell>
              <TableCell className="text-right">-</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
