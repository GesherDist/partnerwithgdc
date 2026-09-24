'use client';

/**
 * GDC Inventory Table (Dynamic by Order Series)
 *
 * Shows Purchase Orders filtered by order_series (GDC 1, GDC 2, GDC 3).
 * Based on the redesign from Aug 24 call - GDC is "order series" not warehouse location.
 */

import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { GDCInventoryItem, SKUColumnInfo } from '../types';

interface GDCInventoryTableProps {
  orderSeries: string;          // e.g., "GDC 1"
  data: GDCInventoryItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns with product names
  onView?: (item: GDCInventoryItem) => void;
  onEdit?: (item: GDCInventoryItem) => void;
}

// PO Status colors
const PO_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export function GDCInventoryTable({ orderSeries, data, uniqueSkus, onView, onEdit }: GDCInventoryTableProps) {
  // State for expanded addresses and notes
  const [expandedAddressId, setExpandedAddressId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressId(expandedAddressId === id ? null : id);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotesId(expandedNotesId === id ? null : id);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Helper to get sticky cell background class based on status
  const getStickyBgClass = (status: string) => {
    if (status === 'confirmed') {
      return 'bg-green-50 dark:bg-green-950';
    } else if (status === 'sent') {
      return 'bg-blue-50 dark:bg-blue-950';
    } else if (status === 'draft') {
      return 'bg-gray-50 dark:bg-gray-950';
    }
    return 'bg-white dark:bg-gray-950';
  };

  // Get quantity for a specific SKU from items array
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number => {
    return items?.filter((i) => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
  };

  // Calculate totals including per-SKU totals
  const totals = data.reduce(
    (acc, item) => {
      // Calculate per-SKU totals
      uniqueSkus.forEach((skuInfo) => {
        acc.skuTotals[skuInfo.sku] = (acc.skuTotals[skuInfo.sku] || 0) + getSkuQty(item.items, skuInfo.sku);
      });
      return {
        ...acc,
        total: acc.total + item.totalQty,
      };
    },
    { total: 0, skuTotals: {} as Record<string, number> }
  );

  // Count by status
  const statusSummary = data.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{orderSeries} Inventory</CardTitle>
        <CardDescription>
          {data.length} POs | Total: {totals.total} units |
          Confirmed: {statusSummary['confirmed'] || 0} |
          Sent: {statusSummary['sent'] || 0} |
          Draft: {statusSummary['draft'] || 0}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {data.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            No Purchase Orders with {orderSeries} order series
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="relative sticky left-0 z-20 w-[60px] bg-white dark:bg-gray-950 after:absolute after:inset-0 after:w-[60px] after:bg-white after:dark:bg-gray-950 after:-z-10">No.</TableHead>
                  <TableHead className="relative sticky left-[60px] z-20 min-w-[120px] whitespace-nowrap bg-white dark:bg-gray-950 after:absolute after:inset-0 after:min-w-[120px] after:bg-white after:dark:bg-gray-950 after:-z-10">SO #</TableHead>
                  <TableHead className="relative sticky left-[180px] z-20 min-w-[140px] whitespace-nowrap bg-white dark:bg-gray-950 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-white after:dark:bg-gray-950 after:-z-10">Customer PO</TableHead>
                  {/* Dynamic SKU columns */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableHead key={skuInfo.sku} className="text-center text-xs whitespace-nowrap min-w-[180px]" title={skuInfo.sku}>
                      {skuInfo.productName} Qty
                    </TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">Total Qty</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Customer</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Supplier</TableHead>
                  <TableHead className="whitespace-nowrap">ETA to US Port</TableHead>
                  <TableHead className="whitespace-nowrap">Confirmed ETA</TableHead>
                  <TableHead className="whitespace-nowrap">Expected Delivery</TableHead>
                  <TableHead className="whitespace-nowrap">Actual Delivery</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Qty Delivered</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Outstanding Qty</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Invoice Amt</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">Delivery Address</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-[150px]">Notes</TableHead>
                  <TableHead className="relative sticky right-0 z-20 w-[100px] bg-white dark:bg-gray-950 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:w-[100px] after:bg-white after:dark:bg-gray-950 after:-z-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow
                    key={item.id}
                    className={
                      item.status === 'confirmed'
                        ? 'bg-green-50 dark:bg-green-950'
                        : item.status === 'sent'
                        ? 'bg-blue-50 dark:bg-blue-950'
                        : item.status === 'draft'
                        ? 'bg-gray-50 dark:bg-gray-950'
                        : ''
                    }
                  >
                    <TableCell className={`relative sticky left-0 z-20 w-[60px] font-medium ${getStickyBgClass(item.status)} after:absolute after:inset-0 after:w-[60px] after:bg-inherit after:-z-10`}>{item.no}</TableCell>
                    <TableCell className={`relative sticky left-[60px] z-20 min-w-[120px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} after:absolute after:inset-0 after:min-w-[120px] after:bg-inherit after:-z-10`}>{item.soNumber || '-'}</TableCell>
                    <TableCell className={`relative sticky left-[180px] z-20 min-w-[140px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-inherit after:-z-10`}>{item.customerPoNumber || '-'}</TableCell>
                    {/* Dynamic SKU quantity columns */}
                    {uniqueSkus.map((skuInfo) => {
                      const qty = getSkuQty(item.items, skuInfo.sku);
                      return (
                        <TableCell key={skuInfo.sku} className="text-center">
                          {qty > 0 ? qty : '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold">{item.totalQty}</TableCell>
                    <TableCell>{item.customer || 'Unallocated'}</TableCell>
                    <TableCell>{item.supplierName || '-'}</TableCell>
                    <TableCell>{formatDate(item.etaToUsPort)}</TableCell>
                    <TableCell>{formatDate(item.confirmedEta)}</TableCell>
                    <TableCell>{formatDate(item.expectedDelivery)}</TableCell>
                    <TableCell>{formatDate(item.actualDeliveryDate)}</TableCell>
                    <TableCell className="text-right">
                      {(item.qtyDelivered && item.qtyDelivered > 0) ? item.qtyDelivered : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {(item.outstandingQty && item.outstandingQty > 0) ? (
                        <span className="text-orange-600 font-semibold">{item.outstandingQty}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.invoiceAmount ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(item.invoiceAmount) : '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {item.deliveryAddress ? (
                        expandedAddressId === item.id ? (
                          <div className="text-xs text-muted-foreground">
                            <span>{item.deliveryAddress}</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="truncate">{item.deliveryAddress.substring(0, 20)}</span>
                            <button
                              className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                              onClick={() => toggleAddressExpand(item.id)}
                            >
                              ...
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={PO_STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      {item.actionRequired ? (
                        expandedNotesId === item.id ? (
                          <div className="text-xs text-muted-foreground">
                            <span>{item.actionRequired}</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <span className="truncate">{item.actionRequired.substring(0, 20)}</span>
                            {item.actionRequired.length > 20 && (
                              <button
                                className="text-primary hover:underline text-xs ml-1 flex-shrink-0"
                                onClick={() => toggleNotesExpand(item.id)}
                              >
                                ...
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className={`relative sticky right-0 z-20 w-[100px] ${getStickyBgClass(item.status)} border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:w-[100px] after:bg-inherit after:-z-10`}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onView?.(item)}
                          title="View Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit?.(item)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="relative sticky left-0 z-20 w-[60px] bg-muted after:absolute after:inset-0 after:w-[60px] after:bg-muted after:-z-10"></TableCell>
                  <TableCell className="relative sticky left-[60px] z-20 min-w-[120px] bg-muted after:absolute after:inset-0 after:min-w-[120px] after:bg-muted after:-z-10">TOTAL</TableCell>
                  <TableCell className="relative sticky left-[180px] z-20 min-w-[140px] bg-muted border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-muted after:-z-10"></TableCell>
                  {/* Dynamic SKU quantity totals */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableCell key={skuInfo.sku} className="text-center">
                      {totals.skuTotals[skuInfo.sku] || 0}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">{totals.total}</TableCell>
                  {/* Empty cells for remaining columns: Customer, Supplier, ETA to US Port, Confirmed ETA, Expected Delivery, Actual Delivery, Qty Delivered, Outstanding Qty, Invoice Amt, Delivery Address, Status, Notes, Edit */}
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className="relative sticky right-0 z-20 w-[100px] bg-muted border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:w-[100px] after:bg-muted after:-z-10"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
