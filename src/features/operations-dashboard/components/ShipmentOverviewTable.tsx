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

import { useMemo } from 'react';
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
import type { ImmediateAttentionItem, CustomerCommitment } from '../types';
import { StatusBadge } from '../lib/status-badge';

interface ShipmentOverviewTableProps {
  inTransitItems: ImmediateAttentionItem[];
  customerSummary: CustomerCommitment[];
}

export function ShipmentOverviewTable({
  inTransitItems,
  customerSummary,
}: ShipmentOverviewTableProps) {
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
    const inTransitNext7Days = filteredItems.filter(item => item.isThisWeek || item.status === 'IN_TRANSIT').length;
    const openLoads = filteredItems.filter(item => item.status === 'OPEN').length;
    const outstandingQty = filteredItems.reduce((sum, item) => sum + item.qty, 0);
    // Get invoice amount from customerSummary (direct filtered)
    const invoiceAmount = customerSummary
      .filter(c => c.productSource === 'direct')
      .reduce((sum, c) => sum + c.invoiceAmount, 0) ||
      filteredItems.reduce((sum, item) => sum + (item.qty * 1000), 0); // Fallback estimate

    return {
      inTransitNext7Days,
      openLoads,
      outstandingQty,
      invoiceAmount,
    };
  }, [filteredItems, customerSummary]);

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
              {immediateAttentionItems.length > 0 ? (
                immediateAttentionItems.map((item) => (
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
              {inTransitToPortItems.length > 0 ? (
                inTransitToPortItems.map((item) => (
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
              {filteredCustomerSummary.length > 0 ? (
                <>
                  {filteredCustomerSummary.map((customer) => (
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
                  {/* Totals Row */}
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
        </CardContent>
      </Card>
    </div>
  );
}
