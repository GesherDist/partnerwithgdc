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
import { CheckCircle2, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { getExecutiveCurrentInventoryData } from '../../actions/executive-metrics.actions';

export function CurrentInventory() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const result = await getExecutiveCurrentInventoryData();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to load data');
        }
      } catch (err) {
        setError('An unexpected error occurred');
        console.error('Error fetching inventory data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const getInventoryHealthColor = (months: number) => {
    if (months < 1.0) return 'text-red-600 font-bold'; // Too low
    if (months > 3.0) return 'text-amber-600 font-bold'; // Too high
    return 'text-green-600 font-semibold'; // Healthy
  };

  const getInventoryHealthBadge = (months: number) => {
    if (months < 1.0) return { text: 'Low Stock', color: 'bg-red-100 text-red-800' };
    if (months > 3.0) return { text: 'Excess', color: 'bg-amber-100 text-amber-800' };
    return { text: 'Healthy', color: 'bg-green-100 text-green-800' };
  };

  const healthBadge = data
    ? getInventoryHealthBadge(data.uncommittedMonthsOfSupply.value)
    : { text: 'Loading', color: 'bg-gray-100 text-gray-800' };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 4.2 - Current Inventory</CardTitle>
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
                      <p className="font-semibold text-blue-900">Inventory at Cost</p>
                      <p className="text-blue-700 mt-1">
                        = SUM(on_hand × unit_cost)
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Source: inventory.on_hand × products.unit_cost
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Tires On Hand</p>
                      <p className="text-amber-700 mt-1">
                        = SUM(inventory.on_hand) WHERE on_hand &gt; 0
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Cost/Tire = Inventory at Cost / Tires On Hand
                      </p>
                    </div>

                    <div className="p-2 bg-purple-50 rounded">
                      <p className="font-semibold text-purple-900">Uncommitted Inventory</p>
                      <p className="text-purple-700 mt-1">
                        = SUM(on_hand - allocated) WHERE result &gt; 0
                      </p>
                      <p className="text-purple-600 mt-1 text-[10px]">
                        Tires not reserved for existing orders
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Uncommitted Months of Supply</p>
                      <p className="text-green-700 mt-1">
                        = Uncommitted / Avg Monthly Sales (last 3 months)
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        1-3 months = Healthy, &lt;1 = Low, &gt;3 = Excess
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            {data && (
              <Badge variant="outline" className={healthBadge.color}>
                {healthBadge.text}
              </Badge>
            )}
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              {isLoading ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</>
              ) : (
                <><CheckCircle2 className="h-3 w-3 mr-1" /> Real Data</>
              )}
            </Badge>
          </div>
        </div>
        <CardDescription>On-hand inventory value, units, and uncommitted months of supply</CardDescription>
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
            <span className="ml-3 text-muted-foreground">Loading inventory data...</span>
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
                  <TableCell className="font-bold">
                    Inventory at Cost
                    <span className="text-xs text-muted-foreground block font-normal">Carrying value</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-blue-700">
                    {data.inventoryAtCost.formatted}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-amber-50/50">
                  <TableCell className="font-bold">
                    Tires On Hand
                    <span className="text-xs text-muted-foreground block font-normal">Physical units</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {data.tiresOnHand.formatted}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium pl-6">Cost / Tire</TableCell>
                  <TableCell className="text-right">
                    {data.costPerTire.formatted}
                  </TableCell>
                </TableRow>
                <TableRow className="border-t bg-purple-50/50">
                  <TableCell className="font-bold">
                    Uncommitted Inventory
                    <span className="text-xs text-muted-foreground block font-normal">Not allocated to orders</span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg text-purple-700">
                    {data.uncommittedInventory.formatted} tires
                  </TableCell>
                </TableRow>
                <TableRow className="border-t-2 bg-gradient-to-r from-green-50 to-green-100">
                  <TableCell className="font-bold">
                    Uncommitted Months of Supply
                    <span className="text-xs text-muted-foreground block font-normal">At current selling rate (last 3 months)</span>
                  </TableCell>
                  <TableCell className={`text-right font-bold text-xl ${getInventoryHealthColor(data.uncommittedMonthsOfSupply.value)}`}>
                    {data.uncommittedMonthsOfSupply.formatted}
                    {data.uncommittedMonthsOfSupply.value < 1.0 ? (
                      <AlertTriangle className="h-4 w-4 inline ml-2 text-red-600" />
                    ) : data.uncommittedMonthsOfSupply.value > 3.0 ? (
                      <AlertTriangle className="h-4 w-4 inline ml-2 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 inline ml-2 text-green-600" />
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
        </Table>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <p className="text-blue-900 mb-2">
                <strong>Formula Calculations:</strong>
              </p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li><strong>Cost / Tire</strong> = Inventory at Cost / Tires On Hand = {data.inventoryAtCost.formatted} / {data.tiresOnHand.formatted} = {data.costPerTire.formatted}</li>
                <li><strong>Uncommitted Inventory</strong> = Tires On Hand - Tires Allocated to Backlog Orders = {data.tiresOnHand.value} - {data.tiresOnHand.value - data.uncommittedInventory.value} = {data.uncommittedInventory.formatted}</li>
                <li><strong>Uncommitted Months of Supply</strong> = Uncommitted Inventory / Average Monthly Tires Sold (trailing 3 months)</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-green-100 border border-green-300 rounded-md">
              <p className="text-sm text-green-900 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                <strong>Real Data:</strong> All metrics calculated from live database!
              </p>
              <p className="text-xs text-green-700 mt-2">
                Data sources: inventory table (on_hand, allocated, unit_cost), sales_orders (backlog), sales_order_items (historical sales velocity).
              </p>
            </div>

            <Alert className="mt-4" variant="default">
              <AlertDescription className="text-sm">
                <strong>Data Quality:</strong> All values are calculated in real-time from your current inventory and sales data. Historical comparisons (TM Avg, YTD Avg, PY) coming soon.
              </AlertDescription>
            </Alert>
          </>
        )}
      </CardContent>
    </Card>
  );
}
