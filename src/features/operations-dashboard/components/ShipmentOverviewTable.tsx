'use client';

/**
 * Shipment Overview Table
 *
 * Shows summary of shipments with two sections:
 * 1. IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS - items with IN_TRANSIT status
 * 2. IN TRANSIT TO PORT - items with OPEN status
 *
 * Based on Jenny's "Shipment Overview" tab from Excel.
 *
 * NOTE: Only shows DROPSHIP orders (not warehouse orders).
 * Warehouse orders are shown in GDC1 Inventory tab.
 */

import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
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
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImmediateAttentionItem, GDCInventoryData } from '../types';
import { StatusBadge } from '../lib/status-badge';

interface ShipmentOverviewTableProps {
  inTransitItems: ImmediateAttentionItem[];
  gdcInventories: GDCInventoryData[];  // 🆕 NEW: All GDC inventory data for Invoice Amount calculation
}

export function ShipmentOverviewTable({
  inTransitItems,
  gdcInventories,
}: ShipmentOverviewTableProps) {
  // Pagination state for each section
  const [immediateAttentionPage, setImmediateAttentionPage] = useState(1);
  const [immediateAttentionPageSize, setImmediateAttentionPageSize] = useState(10);

  const [inTransitPortPage, setInTransitPortPage] = useState(1);
  const [inTransitPortPageSize, setInTransitPortPageSize] = useState(10);

  const [customerSummaryPage, setCustomerSummaryPage] = useState(1);
  const [customerSummaryPageSize, setCustomerSummaryPageSize] = useState(10);

  // Filter to only show DROPSHIP orders (not warehouse)
  const filteredItems = useMemo(() => {
    return inTransitItems.filter(item => item.productSource === 'direct');
  }, [inTransitItems]);

  // Split items into two sections based on status
  const immediateAttentionItems = useMemo(() => {
    return filteredItems.filter(item => item.status === 'IN_TRANSIT' || item.isThisWeek);
  }, [filteredItems]);

  const inTransitToPortItems = useMemo(() => {
    return filteredItems.filter(item => item.status === 'OPEN' && !item.isThisWeek);
  }, [filteredItems]);

  // Derive customer summary from filtered items (direct only)
  const filteredCustomerSummary = useMemo(() => {
    const customerMap = new Map<string, {
      id: string;
      customer: string;
      loads: number;
      outstandingQty: number;
      invoiceAmount: number;
      inTransitNext7Days: number;
    }>();

    filteredItems.forEach(item => {
      const existing = customerMap.get(item.customer);
      if (existing) {
        existing.loads += 1;
        existing.outstandingQty += item.qty;
        existing.inTransitNext7Days += item.isThisWeek ? 1 : 0;
      } else {
        customerMap.set(item.customer, {
          id: item.id,
          customer: item.customer,
          loads: 1,
          outstandingQty: item.qty,
          invoiceAmount: 0,
          inTransitNext7Days: item.isThisWeek ? 1 : 0,
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.loads - a.loads);
  }, [filteredItems]);

  // Calculate KPI stats
  const stats = useMemo(() => {
    // "In transit / next 7 days" calculation:
    // 1. Include every load whose Status is exactly "IN TRANSIT"
    // 2. Also include loads NOT in (IN_TRANSIT, INVOICED, SOLD, AVAILABLE)
    //    AND Outstanding Qty > 0 AND Customer ETA/Due <= Today + 7 days
    // 3. Apply across GDC 0, GDC 1, GDC 2 (unique loads only)

    const excludedStatuses = ['IN_TRANSIT', 'IN TRANSIT', 'INVOICED', 'SOLD', 'AVAILABLE'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    const inTransitNext7DaysSet = new Set<string>();

    // Check all GDC inventories (GDC 0, 1, 2)
    gdcInventories.forEach(gdcData => {
      // Only include GDC 0, GDC 1, GDC 2
      if (!['GDC 0', 'GDC 1', 'GDC 2'].includes(gdcData.orderSeries)) return;

      gdcData.items.forEach(item => {
        if (!item.shipmentNumber) return;

        const status = String(item.status || '').trim().toUpperCase();

        // Condition 1: Status is exactly IN_TRANSIT
        if (status === 'IN_TRANSIT' || status === 'IN TRANSIT') {
          inTransitNext7DaysSet.add(item.shipmentNumber);
          return;
        }

        // Condition 2: NOT in excluded statuses AND Outstanding Qty > 0 AND ETA within 7 days
        if (!excludedStatuses.includes(status)) {
          const outstandingQty = Number(item.outstandingQty) || 0;
          const etaDate = item.expectedDelivery ? new Date(item.expectedDelivery) : null;

          if (outstandingQty > 0 && etaDate && etaDate >= today && etaDate <= next7Days) {
            inTransitNext7DaysSet.add(item.shipmentNumber);
          }
        }
      });
    });

    const inTransitNext7Days = inTransitNext7DaysSet.size;

    // Open loads = unique SO numbers with OPEN status (from dropship + GDC inventory)
    // Use Set to avoid double-counting same SO appearing in both places
    const openSoNumbers = new Set<string>();

    // Add dropship OPEN items
    filteredItems.forEach(item => {
      if (item.status === 'OPEN' && item.loadNumber) {
        openSoNumbers.add(item.loadNumber);
      }
    });

    // Add GDC inventory OPEN items
    // NOTE: In GDC inventory, SO number is stored in 'shipmentNumber' field, not 'soNumber'
    gdcInventories.forEach(gdcData => {
      gdcData.items.forEach(item => {
        const status = String(item.status || '').trim().toUpperCase();
        if (status === 'OPEN' && item.shipmentNumber) {
          openSoNumbers.add(item.shipmentNumber);
        }
      });
    });

    const openLoads = openSoNumbers.size;

    // Outstanding Qty = SUM of MAX(Total Qty - Qty Delivered, 0) from GDC 0+1+2
    // EXCLUDE: AVAILABLE, INVOICED, SOLD statuses
    const excludedStatusesForOutstanding = ['AVAILABLE', 'INVOICED', 'SOLD'];
    const outstandingQty = gdcInventories.reduce((total, gdcData) => {
      // Only include GDC 0, GDC 1, GDC 2
      if (!['GDC 0', 'GDC 1', 'GDC 2'].includes(gdcData.orderSeries)) return total;

      return total + gdcData.items.reduce((sum, item) => {
        const status = String(item.status || '').trim().toUpperCase();

        // Skip AVAILABLE, INVOICED, SOLD
        if (excludedStatusesForOutstanding.includes(status)) return sum;

        // Outstanding Qty = MAX(Total Qty - Qty Delivered, 0)
        const totalQty = Number(item.totalQty) || 0;
        const qtyDelivered = Number(item.qtyDelivered) || 0;
        const itemOutstanding = Math.max(totalQty - qtyDelivered, 0);

        return sum + itemOutstanding;
      }, 0);
    }, 0);

    // Invoice Amount = SUM(GDC 0 + GDC 1 + GDC 2 Invoice Amount)
    // INCLUDE ONLY: AVAILABLE, OPEN, IN TRANSIT, INVOICED, SOLD
    const allowedStatusesForInvoice = ['AVAILABLE', 'OPEN', 'IN_TRANSIT', 'IN TRANSIT', 'INVOICED', 'SOLD'];

    const invoiceAmount = gdcInventories.reduce((total, gdcData) => {
      // Only include GDC 0, GDC 1, GDC 2
      if (!['GDC 0', 'GDC 1', 'GDC 2'].includes(gdcData.orderSeries)) return total;

      return total + gdcData.items.reduce((sum, item) => {
        const status = String(item.status || '').trim().toUpperCase();

        // Only include if status is in allowed list
        if (!allowedStatusesForInvoice.includes(status)) return sum;

        // Add Invoice Amount
        const amount = Number(item.invoiceAmount) || 0;
        return sum + amount;
      }, 0);
    }, 0);

    return {
      inTransitNext7Days,
      openLoads,
      outstandingQty,
      invoiceAmount,
    };
  }, [filteredItems, gdcInventories]);

  // Pagination for Immediate Attention section
  const immediateAttentionTotal = immediateAttentionItems.length;
  const immediateAttentionTotalPages = Math.ceil(immediateAttentionTotal / immediateAttentionPageSize);
  const immediateAttentionStartIndex = (immediateAttentionPage - 1) * immediateAttentionPageSize;
  const immediateAttentionEndIndex = immediateAttentionStartIndex + immediateAttentionPageSize;
  const paginatedImmediateAttention = immediateAttentionItems.slice(immediateAttentionStartIndex, immediateAttentionEndIndex);

  // Pagination for In Transit to Port section
  const inTransitPortTotal = inTransitToPortItems.length;
  const inTransitPortTotalPages = Math.ceil(inTransitPortTotal / inTransitPortPageSize);
  const inTransitPortStartIndex = (inTransitPortPage - 1) * inTransitPortPageSize;
  const inTransitPortEndIndex = inTransitPortStartIndex + inTransitPortPageSize;
  const paginatedInTransitPort = inTransitToPortItems.slice(inTransitPortStartIndex, inTransitPortEndIndex);

  // Pagination for Customer Summary section
  const customerSummaryTotal = filteredCustomerSummary.length;
  const customerSummaryTotalPages = Math.ceil(customerSummaryTotal / customerSummaryPageSize);
  const customerSummaryStartIndex = (customerSummaryPage - 1) * customerSummaryPageSize;
  const customerSummaryEndIndex = customerSummaryStartIndex + customerSummaryPageSize;
  const paginatedCustomerSummary = filteredCustomerSummary.slice(customerSummaryStartIndex, customerSummaryEndIndex);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) { return '-'; }
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Stats Row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">In transit / next 7 days</p>
              <p className="text-2xl font-bold">{stats.inTransitNext7Days}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Open loads</p>
              <p className="text-2xl font-bold">{stats.openLoads}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Outstanding Qty</p>
              <p className="text-2xl font-bold">{stats.outstandingQty.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Invoice amount</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.invoiceAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS */}
      <Card>
        <CardHeader className="bg-red-600 text-white py-2 px-4 rounded-t-lg">
          <CardTitle className="text-base font-semibold">IMMEDIATE ATTENTION: IN TRANSIT / NEXT 7 DAYS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Load #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>Customer ETA/Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedImmediateAttention.length > 0 ? (
                paginatedImmediateAttention.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.isOverdue ? 'bg-red-50 dark:bg-red-950/20' : ''}
                  >
                    <TableCell className="font-medium">{item.loadNumber}</TableCell>
                    <TableCell>{item.customer}</TableCell>
                    <TableCell>{item.po}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell>{formatDate(item.etaPort)}</TableCell>
                    <TableCell>
                      <span className={item.isOverdue ? 'text-red-600 font-semibold' : ''}>
                        {formatDate(item.customerEtaDue)}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="max-w-[250px]" title={item.actionRequired}>
                      <span className="line-clamp-2">{item.actionRequired}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                    No items requiring immediate attention
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          {immediateAttentionTotal > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {immediateAttentionStartIndex + 1} to{' '}
                {Math.min(immediateAttentionEndIndex, immediateAttentionTotal)} of{' '}
                {immediateAttentionTotal} results
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${immediateAttentionPageSize}`}
                    onValueChange={(value) => {
                      setImmediateAttentionPageSize(Number(value));
                      setImmediateAttentionPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={immediateAttentionPageSize} />
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
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImmediateAttentionPage(immediateAttentionPage - 1)}
                    disabled={immediateAttentionPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium">
                    Page {immediateAttentionPage} of {immediateAttentionTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImmediateAttentionPage(immediateAttentionPage + 1)}
                    disabled={immediateAttentionPage >= immediateAttentionTotalPages}
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

      {/* IN TRANSIT TO PORT */}
      <Card>
        <CardHeader className="bg-orange-400 text-white py-2 px-4 rounded-t-lg">
          <CardTitle className="text-base font-semibold">IN TRANSIT TO PORT</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Load #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>ETA Port</TableHead>
                <TableHead>Customer ETA/Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action Required / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInTransitPort.length > 0 ? (
                paginatedInTransitPort.map((item) => (
                  <TableRow
                    key={item.id}
                    className={item.isOverdue ? 'bg-red-50 dark:bg-red-950/20' : ''}
                  >
                    <TableCell className="font-medium">{item.loadNumber}</TableCell>
                    <TableCell>{item.customer}</TableCell>
                    <TableCell>{item.po}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell>{formatDate(item.etaPort)}</TableCell>
                    <TableCell>
                      <span className={item.isOverdue ? 'text-red-600 font-semibold' : ''}>
                        {formatDate(item.customerEtaDue)}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="max-w-[250px]" title={item.actionRequired}>
                      <span className="line-clamp-2">{item.actionRequired}</span>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                    No items in transit to port
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          {inTransitPortTotal > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {inTransitPortStartIndex + 1} to{' '}
                {Math.min(inTransitPortEndIndex, inTransitPortTotal)} of{' '}
                {inTransitPortTotal} results
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${inTransitPortPageSize}`}
                    onValueChange={(value) => {
                      setInTransitPortPageSize(Number(value));
                      setInTransitPortPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={inTransitPortPageSize} />
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
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInTransitPortPage(inTransitPortPage - 1)}
                    disabled={inTransitPortPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium">
                    Page {inTransitPortPage} of {inTransitPortTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInTransitPortPage(inTransitPortPage + 1)}
                    disabled={inTransitPortPage >= inTransitPortTotalPages}
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

      {/* Customer Summary */}
      <Card>
        <CardHeader className="bg-blue-600 text-white py-2 px-4 rounded-t-lg">
          <CardTitle className="text-base font-semibold">CUSTOMER SUMMARY</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Loads</TableHead>
                <TableHead className="text-right">Outstanding Qty</TableHead>
                <TableHead className="text-right">Invoice Amount</TableHead>
                <TableHead className="text-right">In Transit / Next 7 Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedCustomerSummary.length > 0 ? (
                <>
                  {paginatedCustomerSummary.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.customer}</TableCell>
                      <TableCell className="text-right">{customer.loads}</TableCell>
                      <TableCell className="text-right">{customer.outstandingQty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(customer.invoiceAmount)}</TableCell>
                      <TableCell className="text-right">
                        {customer.inTransitNext7Days > 0 ? (
                          <Badge variant="destructive">{customer.inTransitNext7Days}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals Row - always show with full dataset totals */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {filteredCustomerSummary.reduce((sum, c) => sum + c.loads, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {filteredCustomerSummary.reduce((sum, c) => sum + c.outstandingQty, 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(filteredCustomerSummary.reduce((sum, c) => sum + c.invoiceAmount, 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">
                        {filteredCustomerSummary.reduce((sum, c) => sum + c.inTransitNext7Days, 0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No customer data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          {customerSummaryTotal > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {customerSummaryStartIndex + 1} to{' '}
                {Math.min(customerSummaryEndIndex, customerSummaryTotal)} of{' '}
                {customerSummaryTotal} results
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium">Rows per page</p>
                  <Select
                    value={`${customerSummaryPageSize}`}
                    onValueChange={(value) => {
                      setCustomerSummaryPageSize(Number(value));
                      setCustomerSummaryPage(1);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue placeholder={customerSummaryPageSize} />
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
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerSummaryPage(customerSummaryPage - 1)}
                    disabled={customerSummaryPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="text-sm font-medium">
                    Page {customerSummaryPage} of {customerSummaryTotalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerSummaryPage(customerSummaryPage + 1)}
                    disabled={customerSummaryPage >= customerSummaryTotalPages}
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
    </div>
  );
}
