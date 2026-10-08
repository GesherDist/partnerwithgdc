'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { CheckCircle2, Loader2, AlertCircle, Eye } from 'lucide-react';
import { getExecutiveProfitabilityData } from '../../actions/executive-metrics.actions';
import type { DateRange } from '../../types';

interface ProfitabilityTableProps {
  dateRange: DateRange;
}

export function ProfitabilityTable({ dateRange }: ProfitabilityTableProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await getExecutiveProfitabilityData(dateRange);

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load data');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Error fetching profitability data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 2.1 - Profitability</CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                  <Eye className="h-4 w-4 text-gray-500 hover:text-blue-600" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-96" align="start">
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm border-b pb-2">Calculation Method</h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">Revenue (Definition 3.1)</p>
                      <p className="text-blue-700 mt-1">
                        = Gross Sales - Discounts - Returns
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Source: invoices.grand_total - invoices.discount_total - credit_notes.grand_total
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">COGS</p>
                      <p className="text-red-700 mt-1">
                        = SUM(Quantity × Unit Cost) for delivered orders
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Source: sales_order_items.quantity × products.unit_cost WHERE status = delivered
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Gross Profit (Definition 3.2)</p>
                      <p className="text-green-700 mt-1">
                        = Revenue - COGS
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        GP% = (Gross Profit / Revenue) × 100
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">OPEX & Operating Profit</p>
                      <p className="text-amber-700 mt-1">
                        Pending - Requires expense tracking system
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
            {isLoading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</>
            ) : (
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Partial Data</>
            )}
          </Badge>
        </div>
        <CardDescription>Revenue, COGS, Gross Profit, OPEX, and Operating Profit</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-3 text-muted-foreground">Loading profitability data...</span>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead className="text-right">Current Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-blue-50/50">
                  <TableCell className="font-bold">Revenue</TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {data.revenue.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium pl-6">COGS</TableCell>
                  <TableCell className="text-right text-red-600 font-semibold">
                    ({data.cogs.formatted})
                    <span className="text-xs text-muted-foreground ml-2">
                      {data.cogs.percentFormatted}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow className="bg-green-50/50 border-t">
                  <TableCell className="font-bold">Gross Profit</TableCell>
                  <TableCell className="text-right font-bold text-lg text-green-700">
                    {data.grossProfit.formatted}
                    <span className="text-xs text-muted-foreground ml-2">
                      {data.grossProfit.percentFormatted}
                    </span>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium pl-6 text-muted-foreground">
                    OPEX
                    <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 text-xs">
                      Pending Data
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    N/A
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2 bg-blue-100/50">
                  <TableCell className="font-bold text-muted-foreground">
                    Operating Profit
                    <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 text-xs">
                      Pending Data
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-muted-foreground">
                    N/A
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-900 mb-2">
                <strong>Formula Calculations (Definition 3.1 & 3.2):</strong>
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li><strong>Revenue</strong> = Gross Sales - Discounts - Returns = {data.breakdown.grossSales ? `$${Math.round(data.breakdown.grossSales).toLocaleString()}` : 'N/A'} - ${Math.round(data.breakdown.discounts || 0).toLocaleString()} - ${Math.round(data.breakdown.returns || 0).toLocaleString()} = {data.revenue.formatted}</li>
                <li><strong>Gross Profit</strong> = Revenue - COGS = {data.revenue.formatted} - {data.cogs.formatted} = {data.grossProfit.formatted}</li>
                <li><strong>Gross Profit %</strong> = GP / Revenue × 100 = {data.grossProfit.formatted} / {data.revenue.formatted} × 100 = {data.grossProfit.percentFormatted}</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-300 rounded-md">
              <p className="text-sm text-green-900 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <strong>Real Data:</strong> Revenue, COGS, and Gross Profit calculated from live database!
              </p>
              <p className="text-xs text-green-700 mt-2">
                Data sources: invoices (revenue, discounts), credit_notes (returns), products (COGS via unit_cost). OPEX tracking coming soon.
              </p>
            </div>

            <Alert className="mt-4" variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Partial Data:</strong> OPEX and Operating Profit not available yet (requires expense tracking system with category field). Will be added after expense table is set up.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
