'use client';

/**
 * Customer Commitments Component
 *
 * Shows customer outstanding orders:
 * - Customer name
 * - Number of loads
 * - Outstanding quantity
 * - Invoice amount
 */

import { Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import type { CustomerCommitment } from '../types';

// ============================================
// TYPES
// ============================================

interface CustomerCommitmentsProps {
  data: CustomerCommitment[];
  onViewCustomer?: (customer: CustomerCommitment) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CustomerCommitments({ data, onViewCustomer: _onViewCustomer }: CustomerCommitmentsProps) {
  const totalLoads = data.reduce((sum, item) => sum + item.loads, 0);
  const totalQty = data.reduce((sum, item) => sum + item.outstandingQty, 0);
  const totalInvoice = data.reduce((sum, item) => sum + item.invoiceAmount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customer Commitments / Outstanding
            </CardTitle>
            <CardDescription>
              {formatNumber(totalQty)} units committed across {data.length} customers
            </CardDescription>
          </div>
          <div className="text-sm text-right">
            <div>
              <span className="text-muted-foreground">Total Value: </span>
              <span className="font-semibold text-emerald-600">{formatCurrency(totalInvoice)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Loads</TableHead>
              <TableHead className="text-right">Outstanding Qty</TableHead>
              {/* GDC Qty, Dealer Qty, Direct Qty columns - commented out for now
              <TableHead className="text-right">GDC Qty</TableHead>
              <TableHead className="text-right">Dealer Qty</TableHead>
              <TableHead className="text-right">Direct Qty</TableHead>
              */}
              <TableHead className="text-right">Invoice Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.customer}</TableCell>
                <TableCell className="text-right">{item.loads}</TableCell>
                <TableCell className="text-right">{formatNumber(item.outstandingQty)}</TableCell>
                {/* GDC Qty, Dealer Qty, Direct Qty cells - commented out for now
                <TableCell className="text-right">{formatNumber(item.gdcQty)}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(item.dealerInventoryQty + item.dealerFulfillmentQty)}
                </TableCell>
                <TableCell className="text-right">{formatNumber(item.manufacturerDirectQty)}</TableCell>
                */}
                <TableCell className="text-right font-medium text-emerald-600">
                  {formatCurrency(item.invoiceAmount)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{totalLoads}</TableCell>
              <TableCell className="text-right">{formatNumber(totalQty)}</TableCell>
              <TableCell className="text-right font-bold text-emerald-600">
                {formatCurrency(totalInvoice)}
              </TableCell>
            </TableRow>
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
