'use client';

/**
 * SKU Breakdown Component
 *
 * Shows SKU quantity breakdown:
 * - Supplier Outstanding Qty
 * - All GDC Series (dynamic from ORDER_SERIES)
 * - Combined Qty
 * - Share of Combined (percentage)
 */

import { Package } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { ORDER_SERIES } from '@/shared/lib/global-data';

import type { SKUBreakdown as SKUBreakdownType } from '../types';

// ============================================
// TYPES
// ============================================

interface SKUBreakdownProps {
  data: SKUBreakdownType[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SKUBreakdown({ data }: SKUBreakdownProps) {
  // Get all unique GDC series from data (dynamically)
  const allGdcSeries = new Set<string>();
  data.forEach((item) => {
    Object.keys(item.gdcInventory).forEach((series) => allGdcSeries.add(series));
  });

  // Sort GDC series by ORDER_SERIES order
  const sortedGdcSeries = ORDER_SERIES
    .map((os) => os.name)
    .filter((name) => allGdcSeries.has(name));

  // Add any series not in ORDER_SERIES (fallback)
  allGdcSeries.forEach((series) => {
    if (!sortedGdcSeries.includes(series)) {
      sortedGdcSeries.push(series);
    }
  });

  // Calculate totals
  const totalSupplier = data.reduce((sum, item) => sum + item.supplierOutstandingQty, 0);
  const totalCombined = data.reduce((sum, item) => sum + item.combinedQty, 0);

  // Calculate total for each GDC series
  const gdcTotals: Record<string, number> = {};
  sortedGdcSeries.forEach((series) => {
    gdcTotals[series] = data.reduce((sum, item) => sum + (item.gdcInventory[series] || 0), 0);
  });

  // Generate title text
  const titleText = sortedGdcSeries.length > 0
    ? `SKU Quantity Breakdown - Supplier + ${sortedGdcSeries.join(' + ')}`
    : 'SKU Quantity Breakdown - Supplier + GDC Inventory';

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              {titleText}
            </CardTitle>
            <CardDescription>Combined inventory across locations</CardDescription>
          </div>
          <div className="text-sm text-right">
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-semibold text-lg">{formatNumber(totalCombined)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto px-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[200px]">Product/SKU</TableHead>
              <TableHead className="text-right min-w-[120px]">Supplier Outstanding</TableHead>
              {sortedGdcSeries.map((series) => (
                <TableHead key={series} className="text-right min-w-[100px]">
                  {series} Available
                </TableHead>
              ))}
              <TableHead className="text-right min-w-[120px]">Combined Qty</TableHead>
              <TableHead className="text-right w-[180px]">Share of Combined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.sku}>
                <TableCell className="font-medium py-3">{item.skuName}</TableCell>
                <TableCell className="text-right text-blue-600 py-3">
                  {formatNumber(item.supplierOutstandingQty)}
                </TableCell>
                {sortedGdcSeries.map((series) => (
                  <TableCell key={series} className="text-right text-emerald-600 py-3">
                    {formatNumber(item.gdcInventory[series] || 0)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-semibold py-3">
                  {formatNumber(item.combinedQty)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Progress
                      value={item.shareOfCombined}
                      className="w-[60px] h-2"
                    />
                    <span className="text-sm w-[45px] text-right">
                      {item.shareOfCombined.toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell className="py-3">Total</TableCell>
              <TableCell className="text-right text-blue-600 py-3">
                {formatNumber(totalSupplier)}
              </TableCell>
              {sortedGdcSeries.map((series) => (
                <TableCell key={series} className="text-right text-emerald-600 py-3">
                  {formatNumber(gdcTotals[series] || 0)}
                </TableCell>
              ))}
              <TableCell className="text-right font-bold py-3">
                {formatNumber(totalCombined)}
              </TableCell>
              <TableCell className="text-right py-3">100%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
