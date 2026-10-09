'use client';

/**
 * GDC Inventory Table (Dynamic by Order Series)
 *
 * Shows Purchase Orders filtered by order_series (GDC 1, GDC 2, GDC 3).
 * Based on the redesign from Aug 24 call - GDC is "order series" not warehouse location.
 */

import { useState } from 'react';
import { Eye, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
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

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Sorting state
  type SortColumn = 'no' | 'soNumber' | 'customerPoNumber' | 'totalQty' | 'customer' | 'supplierName' | 'etaToUsPort' | 'confirmedEta' | 'expectedDelivery' | 'status';
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressId(expandedAddressId === id ? null : id);
  };

  const toggleNotesExpand = (id: string) => {
    setExpandedNotesId(expandedNotesId === id ? null : id);
  };

  // Handle column sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
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

  // Sort data if column selected
  const sortedData = sortColumn ? [...data].sort((a, b) => {
    let aVal: any;
    let bVal: any;

    switch (sortColumn) {
      case 'no':
        aVal = a.no;
        bVal = b.no;
        break;
      case 'soNumber':
        aVal = a.shipmentNumber || '';
        bVal = b.shipmentNumber || '';
        break;
      case 'customerPoNumber':
        aVal = a.customerPoNumber || '';
        bVal = b.customerPoNumber || '';
        break;
      case 'totalQty':
        aVal = a.totalQty;
        bVal = b.totalQty;
        break;
      case 'customer':
        aVal = a.customer || '';
        bVal = b.customer || '';
        break;
      case 'supplierName':
        aVal = a.supplierName || '';
        bVal = b.supplierName || '';
        break;
      case 'etaToUsPort':
        aVal = a.etaToUsPort ? new Date(a.etaToUsPort).getTime() : 0;
        bVal = b.etaToUsPort ? new Date(b.etaToUsPort).getTime() : 0;
        break;
      case 'confirmedEta':
        aVal = a.confirmedEta ? new Date(a.confirmedEta).getTime() : 0;
        bVal = b.confirmedEta ? new Date(b.confirmedEta).getTime() : 0;
        break;
      case 'expectedDelivery':
        aVal = a.expectedDelivery ? new Date(a.expectedDelivery).getTime() : 0;
        bVal = b.expectedDelivery ? new Date(b.expectedDelivery).getTime() : 0;
        break;
      case 'status':
        aVal = a.status;
        bVal = b.status;
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  }) : data;

  // Pagination calculations
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);

  // Get quantity for a specific SKU from items array
  const getSkuQty = (items: { sku: string; qty: number }[], sku: string): number => {
    return items?.filter((i) => i.sku === sku).reduce((sum, i) => sum + i.qty, 0) || 0;
  };

  // Calculate totals including per-SKU totals (from FULL data, not paginated)
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
                  <TableHead className="relative sticky left-0 z-20 w-[60px] bg-white dark:bg-gray-950 after:absolute after:inset-0 after:w-[60px] after:bg-white after:dark:bg-gray-950 after:-z-10">
                    <button onClick={() => handleSort('no')} className="flex items-center gap-1 hover:text-primary">
                      No.
                      {sortColumn === 'no' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="relative sticky left-[60px] z-20 min-w-[120px] whitespace-nowrap bg-white dark:bg-gray-950 after:absolute after:inset-0 after:min-w-[120px] after:bg-white after:dark:bg-gray-950 after:-z-10">
                    <button onClick={() => handleSort('soNumber')} className="flex items-center gap-1 hover:text-primary">
                      SO #
                      {sortColumn === 'soNumber' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="relative sticky left-[180px] z-20 min-w-[140px] whitespace-nowrap bg-white dark:bg-gray-950 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-white after:dark:bg-gray-950 after:-z-10">
                    <button onClick={() => handleSort('customerPoNumber')} className="flex items-center gap-1 hover:text-primary">
                      PO #
                      {sortColumn === 'customerPoNumber' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  {/* Dynamic SKU columns */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableHead key={skuInfo.sku} className="text-center text-xs whitespace-nowrap min-w-[220px]" title={skuInfo.sku}>
                      {skuInfo.productName}
                    </TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">
                    <button onClick={() => handleSort('totalQty')} className="flex items-center gap-1 hover:text-primary ml-auto">
                      Total
                      {sortColumn === 'totalQty' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap min-w-[200px]">
                    <button onClick={() => handleSort('customer')} className="flex items-center gap-1 hover:text-primary">
                      Customer/Warehouse
                      {sortColumn === 'customer' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap min-w-[180px]">
                    <button onClick={() => handleSort('supplierName')} className="flex items-center gap-1 hover:text-primary">
                      Supplier
                      {sortColumn === 'supplierName' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button onClick={() => handleSort('etaToUsPort')} className="flex items-center gap-1 hover:text-primary">
                      ETA to US Port
                      {sortColumn === 'etaToUsPort' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button onClick={() => handleSort('confirmedEta')} className="flex items-center gap-1 hover:text-primary">
                      Confirmed ETA
                      {sortColumn === 'confirmedEta' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button onClick={() => handleSort('expectedDelivery')} className="flex items-center gap-1 hover:text-primary">
                      Expected Delivery
                      {sortColumn === 'expectedDelivery' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Actual Delivery</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Qty Delivered</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Outstanding Qty</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Invoice Amt</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[150px]">Delivery Address</TableHead>
                  <TableHead className="whitespace-nowrap">
                    <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-primary">
                      Status
                      {sortColumn === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Fulfillment Source</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">Allocated To</TableHead>
                  <TableHead className="min-w-[150px]">Notes</TableHead>
                  <TableHead className="relative sticky right-0 z-20 w-[100px] bg-white dark:bg-gray-950 border-l shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:w-[100px] after:bg-white after:dark:bg-gray-950 after:-z-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((item) => (
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
                    <TableCell className={`relative sticky left-[60px] z-20 min-w-[120px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} after:absolute after:inset-0 after:min-w-[120px] after:bg-inherit after:-z-10`}>{item.shipmentNumber || '-'}</TableCell>
                    <TableCell className={`relative sticky left-[180px] z-20 min-w-[140px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-inherit after:-z-10`}>{item.poNumber || '-'}</TableCell>
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
                    <TableCell>{item.customer || '-'}</TableCell>
                    <TableCell className="min-w-[180px]">
                      <TooltipProvider>
                        {item.allocations && item.allocations.length > 0 ? (
                          <div className="space-y-1">
                            {/* Show first allocation supplier name */}
                            {item.allocations[0]?.supplierName && (
                              <div className="text-sm font-medium">
                                {item.allocations[0]?.supplierName}
                              </div>
                            )}

                            {/* Show "Show All Fulfillment" button with popover for multiple allocations */}
                            {item.allocations.length > 1 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-1 text-primary hover:underline text-xs font-medium">
                                    <Eye className="h-3 w-3" />
                                    Show All Fulfillment
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto min-w-[400px]" align="start">
                                  <div className="space-y-2">
                                    <div className="font-semibold text-sm border-b pb-2">
                                      Fulfillment Details
                                    </div>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-1 px-2 font-medium text-muted-foreground">Source</th>
                                          <th className="text-left py-1 px-2 font-medium text-muted-foreground">Location</th>
                                          <th className="text-right py-1 px-2 font-medium text-muted-foreground">Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {item.allocations.map((allocation, idx) => (
                                          <tr key={idx} className="border-b last:border-0">
                                            <td className="py-2 px-2">
                                              <Badge
                                                variant="outline"
                                                className={
                                                  allocation.source === 'gdc_inventory'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
                                                    : allocation.source === 'platinum_dealer_inventory'
                                                    ? 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                                                    : allocation.source === 'platinum_dealer_fulfillment'
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 text-xs'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 text-xs'
                                                }
                                              >
                                                {allocation.source === 'gdc_inventory'
                                                  ? 'GDC Inv.'
                                                  : allocation.source === 'platinum_dealer_inventory'
                                                  ? 'Dealer Inv.'
                                                  : allocation.source === 'platinum_dealer_fulfillment'
                                                  ? 'Dealer Fulfill.'
                                                  : 'Direct'}
                                              </Badge>
                                            </td>
                                            <td className="py-2 px-2">
                                              {allocation.locationOrDealer ? (
                                                <span className="text-sm">{allocation.locationOrDealer}</span>
                                              ) : allocation.supplierName ? (
                                                <span className="text-sm">{allocation.supplierName}</span>
                                              ) : (
                                                <span className="text-sm text-muted-foreground">-</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-2 text-right font-medium">{allocation.quantity}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : item.allocations[0]?.source !== 'direct' ? (
                              /* Single non-direct allocation - show badge with tooltip */
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={
                                      item.allocations[0]?.source === 'gdc_inventory'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200 cursor-help'
                                        : item.allocations[0]?.source === 'platinum_dealer_inventory'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200 cursor-help'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200 cursor-help'
                                    }
                                  >
                                    {item.allocations[0]?.source === 'gdc_inventory'
                                      ? 'GDC Inventory'
                                      : item.allocations[0]?.source === 'platinum_dealer_inventory'
                                      ? 'Dealer Inventory'
                                      : 'Dealer Fulfillment'} | {item.allocations[0]?.quantity} units
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">
                                    {item.allocations[0]?.source === 'gdc_inventory'
                                      ? 'Fulfilled from GDC warehouse inventory'
                                      : item.allocations[0]?.source === 'platinum_dealer_inventory'
                                      ? 'Fulfilled from Platinum Dealer existing inventory'
                                      : 'Dealer arranges fulfillment (no stock transfer)'}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : null}
                          </div>
                        ) : (
                          // No allocations array - fallback to old supplierName field
                          <span className="text-sm">{item.supplierName || '-'}</span>
                        )}
                      </TooltipProvider>
                    </TableCell>
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
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          item.fulfillmentSource === 'platinum_dealer_inventory' || item.fulfillmentSource === 'platinum_dealer_fulfillment'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : ''
                        }`}
                      >
                        {item.fulfillmentSource === 'gdc_inventory' && 'GDC Inv.'}
                        {item.fulfillmentSource === 'platinum_dealer_inventory' && 'Dealer Inv.'}
                        {item.fulfillmentSource === 'platinum_dealer_fulfillment' && 'Dealer Fulfill.'}
                        {item.fulfillmentSource === 'direct' && 'Direct'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.allocatedToDealerName ? (
                        <div>
                          <div className="text-sm font-medium">{item.allocatedToDealerName}</div>
                          {item.allocatedToDealerLocation && (
                            <div className="text-xs text-muted-foreground">{item.allocatedToDealerLocation}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
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
        {/* Pagination Controls */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex-1 text-sm text-muted-foreground">
              Showing {startIndex + 1} to{' '}
              {Math.min(endIndex, totalItems)} of{' '}
              {totalItems} results
            </div>
            <div className="flex items-center space-x-6">
              {/* Page Size Selector */}
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${pageSize}`}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1); // Reset to first page
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm font-medium">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
