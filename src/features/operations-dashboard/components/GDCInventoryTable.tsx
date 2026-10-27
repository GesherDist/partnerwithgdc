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
import type { GDCInventoryItem, SKUColumnInfo } from '../types';

interface GDCInventoryTableProps {
  orderSeries: string;          // e.g., "GDC 1"
  data: GDCInventoryItem[];
  uniqueSkus: SKUColumnInfo[];  // Dynamic SKU columns with product names
  loadError?: string;           // Set when this series failed to load
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

export function GDCInventoryTable({ orderSeries, data, uniqueSkus, loadError, onView, onEdit }: GDCInventoryTableProps) {
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
        aVal = a.soNumber || a.shipmentNumber || '';
        bVal = b.soNumber || b.shipmentNumber || '';
        break;
      case 'customerPoNumber':
        aVal = a.customerPoNumber || a.poNumber || '';
        bVal = b.customerPoNumber || b.poNumber || '';
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
        commissionTotal: acc.commissionTotal + (item.isCommissionOnly ? item.commissionAmount || 0 : 0),
        invoiceTotal: acc.invoiceTotal + (item.invoiceAmount || 0),
        costTotal: acc.costTotal + (item.cost || 0),
      };
    },
    { total: 0, commissionTotal: 0, invoiceTotal: 0, costTotal: 0, skuTotals: {} as Record<string, number> }
  );

  // Price per tire shown for a SKU (customer price once linked, else PO price)
  const getSkuPrice = (items: { sku: string; price?: number | null }[], sku: string): number | null =>
    items?.find((i) => i.sku === sku && i.price && i.price > 0)?.price ?? null;

  const formatWholeDollars = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

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
        {loadError ? (
          <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
            <p className="font-medium text-red-600">Could not load {orderSeries} data</p>
            <p className="text-sm text-muted-foreground">Please refresh the page. If this keeps happening, contact support.</p>
          </div>
        ) : data.length === 0 ? (
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
                  {/* Price per tire (master sheet "38" Price" / "24" Price") */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableHead
                      key={`price-${skuInfo.sku}`}
                      className="text-right text-xs whitespace-nowrap"
                      title="Customer price once the PO is linked to a sales order, else the PO price"
                    >
                      {skuInfo.productName} Price
                    </TableHead>
                  ))}
                  <TableHead className="text-right whitespace-nowrap">Invoice Amt</TableHead>
                  <TableHead
                    className="text-right whitespace-nowrap"
                    title="Our cost: tires × cost per tire (saved line cost, else the order cycle cost, else the base cost)"
                  >
                    Cost
                  </TableHead>
                  <TableHead className="text-center whitespace-nowrap">Commission Only</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Commission Amt</TableHead>
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
                    <TableCell className={`relative sticky left-[60px] z-20 min-w-[120px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} after:absolute after:inset-0 after:min-w-[120px] after:bg-inherit after:-z-10`}>{item.soNumber || item.shipmentNumber || '-'}</TableCell>
                    <TableCell className={`relative sticky left-[180px] z-20 min-w-[140px] font-mono text-sm whitespace-nowrap ${getStickyBgClass(item.status)} border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] after:absolute after:inset-0 after:min-w-[140px] after:bg-inherit after:-z-10`}>{item.customerPoNumber || item.poNumber || '-'}</TableCell>
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
                      {/* Supplier column - shows actual supplier name from PO, not allocation info */}
                      <span className="text-sm">{item.supplierName || '-'}</span>
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
                    {uniqueSkus.map((skuInfo) => {
                      const price = getSkuPrice(item.items, skuInfo.sku);
                      return (
                        <TableCell key={`price-${skuInfo.sku}`} className="text-right">
                          {price ? formatWholeDollars(price) : '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right">
                      {item.invoiceAmount ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(item.invoiceAmount) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.cost ? formatWholeDollars(item.cost) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.isCommissionOnly ? (
                        <span className="font-semibold text-violet-700">YES</span>
                      ) : (
                        <span className="text-muted-foreground">NO</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.isCommissionOnly ? formatWholeDollars(item.commissionAmount || 0) : '-'}
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
                      {/* Only show Fulfillment Source when C-SO is mapped (allocation exists) */}
                      {item.fulfillmentSource ? (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            item.fulfillmentSource === 'platinum_dealer_inventory' || item.fulfillmentSource === 'platinum_dealer_fulfillment'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : item.fulfillmentSource === 'gdc_inventory'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : ''
                          }`}
                        >
                          {item.fulfillmentSource === 'gdc_inventory' && 'GDC Inv.'}
                          {item.fulfillmentSource === 'platinum_dealer_inventory' && 'Dealer Inv.'}
                          {item.fulfillmentSource === 'platinum_dealer_fulfillment' && 'Dealer Fulfill.'}
                          {item.fulfillmentSource === 'direct' && 'Direct'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
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
                      {item.isCommissionOnly && (
                        <Badge variant="outline" className="mb-1 text-xs bg-violet-50 text-violet-700 border-violet-200">
                          Commission Only
                        </Badge>
                      )}
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
                        !item.isCommissionOnly && <span className="text-xs text-muted-foreground">-</span>
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
                  {/* Customer, Supplier, ETA to US Port, Confirmed ETA, Expected Delivery, Actual Delivery, Qty Delivered, Outstanding Qty */}
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  {/* Price per tire columns */}
                  {uniqueSkus.map((skuInfo) => (
                    <TableCell key={`price-${skuInfo.sku}`}></TableCell>
                  ))}
                  {/* Invoice Amt, Cost */}
                  <TableCell className="text-right">
                    {totals.invoiceTotal > 0 ? formatWholeDollars(totals.invoiceTotal) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {totals.costTotal > 0 ? formatWholeDollars(totals.costTotal) : '-'}
                  </TableCell>
                  {/* Commission Only */}
                  <TableCell></TableCell>
                  {/* Commission Amt */}
                  <TableCell className="text-right">
                    {totals.commissionTotal > 0 ? formatWholeDollars(totals.commissionTotal) : '-'}
                  </TableCell>
                  {/* Delivery Address, Status, Fulfillment Source, Allocated To, Notes */}
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
