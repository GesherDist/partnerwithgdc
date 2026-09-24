'use client';

/**
 * Rim Installation Required Component
 *
 * Shows inventory items that need rim installation.
 * Dynamic SKU columns based on products in the data.
 */

import { Wrench, AlertTriangle } from 'lucide-react';

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

import type { RimInstallationItem, SKUColumnInfo } from '../types';

// ============================================
// TYPES
// ============================================

interface RimInstallationRequiredProps {
  data: RimInstallationItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Get quantity for a specific SKU from items array
function getSkuQty(items: { sku: string; qty: number }[], sku: string): number {
  return items?.filter((i) => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function RimInstallationRequired({ data, uniqueSkus }: RimInstallationRequiredProps) {
  const totalUnits = data.reduce((sum, item) => sum + item.totalQty, 0);

  if (data.length === 0) {
    return null;
  }

  // Calculate totals per SKU
  const skuTotals: Record<string, number> = {};
  uniqueSkus.forEach((skuInfo) => {
    skuTotals[skuInfo.sku] = data.reduce((sum, item) => sum + getSkuQty(item.items, skuInfo.sku), 0);
  });

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <Wrench className="h-4 w-4" />
              Rim Installation Required - GDC No. {data[0]?.gdc1No}-{data[data.length - 1]?.gdc1No}
            </CardTitle>
            <CardDescription className="text-amber-700">
              {data.length} loads / {formatNumber(totalUnits)} units need rim installation - TWS manufacturer
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Action Required
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-amber-100/50">
                <TableHead>GDC 1 No.</TableHead>
                <TableHead>Load #</TableHead>
                {/* Dynamic SKU columns */}
                {uniqueSkus.map((skuInfo) => (
                  <TableHead key={skuInfo.sku} className="text-right whitespace-nowrap" title={skuInfo.sku}>
                    {skuInfo.productName}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required / Notes</TableHead>
                <TableHead>Executive Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className="hover:bg-amber-50">
                  <TableCell className="font-medium">{item.gdc1No}</TableCell>
                  <TableCell>{item.loadNumber}</TableCell>
                  {/* Dynamic SKU quantity columns */}
                  {uniqueSkus.map((skuInfo) => {
                    const qty = getSkuQty(item.items, skuInfo.sku);
                    return (
                      <TableCell key={skuInfo.sku} className="text-right">
                        {qty > 0 ? qty : '-'}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-amber-700 font-medium">
                    {item.actionRequired}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {item.executiveNote}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals Row */}
              <TableRow className="bg-amber-100/50 font-medium">
                <TableCell colSpan={2}>Total units requiring rim installation</TableCell>
                {/* Dynamic SKU totals */}
                {uniqueSkus.map((skuInfo) => (
                  <TableCell key={skuInfo.sku} className="text-right">
                    {formatNumber(skuTotals[skuInfo.sku] || 0)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-bold">
                  {formatNumber(totalUnits)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
