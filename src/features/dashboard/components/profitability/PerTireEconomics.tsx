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
import { getExecutivePerTireEconomicsData } from '../../actions/executive-metrics.actions';
import type { DateRange } from '../../types';

interface PerTireEconomicsProps {
  dateRange: DateRange;
}

export function PerTireEconomics({ dateRange }: PerTireEconomicsProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await getExecutivePerTireEconomicsData(dateRange);

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load data');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Error fetching per tire economics data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 2.2 - Per Tire Economics</CardTitle>
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
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="font-semibold text-gray-900">Tires Sold</p>
                      <p className="text-gray-700 mt-1">
                        = SUM(Quantity) for delivered orders
                      </p>
                      <p className="text-gray-600 mt-1 text-[10px]">
                        Source: sales_order_items.quantity WHERE sales_orders.status = delivered
                      </p>
                    </div>

                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">Revenue / Tire</p>
                      <p className="text-blue-700 mt-1">
                        = Total Revenue / Tires Sold
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Revenue from invoices ÷ quantity from delivered orders
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">COGS / Tire</p>
                      <p className="text-red-700 mt-1">
                        = Total COGS / Tires Sold
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        products.unit_cost average for delivered items
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">GP / Tire</p>
                      <p className="text-green-700 mt-1">
                        = Revenue/Tire - COGS/Tire
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        Gross profit per unit sold
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">OPEX/Tire & OP/Tire</p>
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
              <><CheckCircle2 className="h-3 w-3 mr-1" /> Real Data</>
            )}
          </Badge>
        </div>
        <CardDescription>Unit economics - revenue and costs per tire sold</CardDescription>
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
            <span className="ml-3 text-muted-foreground">Loading per tire economics...</span>
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
                <TableRow className="bg-muted/50">
                  <TableCell className="font-bold">Tires Sold</TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {data.tiresSold.formatted}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-blue-50/50 border-t">
                  <TableCell className="font-bold">Revenue / Tire</TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {data.revenuePerTire.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium pl-6">COGS / Tire</TableCell>
                  <TableCell className="text-right text-red-600 font-semibold">
                    ({data.cogsPerTire.formatted})
                  </TableCell>
                </TableRow>
                <TableRow className="bg-green-50/50 border-t">
                  <TableCell className="font-bold">GP / Tire</TableCell>
                  <TableCell className="text-right font-bold text-lg text-green-700">
                    {data.gpPerTire.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium pl-6 text-muted-foreground">
                    OPEX / Tire
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
                    OP / Tire
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
              <p className="text-sm text-blue-900">
                <strong>Unit Economics:</strong> Each metric divides the dollar amount by tires sold
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Example: Revenue/Tire = Total Revenue / Tires Sold = {formatCurrency(data.revenuePerTire.value * data.tiresSold.value)} / {data.tiresSold.formatted} = {data.revenuePerTire.formatted}
              </p>
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-300 rounded-md">
              <p className="text-sm text-green-900 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <strong>Real Data:</strong> Revenue, COGS, and GP per tire calculated from live database!
              </p>
              <p className="text-xs text-green-700 mt-2">
                Data sources: invoices (revenue), sales_order_items (quantity), products (unit_cost). OPEX data pending.
              </p>
            </div>

            <Alert className="mt-4" variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Partial Data:</strong> OPEX per tire not available yet (requires expense tracking system). OP per tire will be calculated once OPEX data is available.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
