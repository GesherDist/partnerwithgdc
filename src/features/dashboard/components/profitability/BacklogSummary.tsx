import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { CheckCircle2, Eye } from 'lucide-react';

// Mock data
const mockBacklogData = {
  backlogTires: { current: 850, tmAvg: 920, ytdAvg: 875, py: 780 },
  backlogRevenue: { current: 1020000, tmAvg: 1104000, ytdAvg: 1050000, py: 936000 },
  revenuePerTire: { current: 1200, tmAvg: 1200, ytdAvg: 1200, py: 1200 },
  backlogGrossProfit: { current: 306000, tmAvg: 331200, ytdAvg: 315000, py: 280800 },
  gpPerTire: { current: 360, tmAvg: 360, ytdAvg: 360, py: 360 },
  gpPercent: { current: 30.0, tmAvg: 30.0, ytdAvg: 30.0, py: 30.0 }
};

export function BacklogSummary() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 2.4 - Backlog Summary</CardTitle>
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
                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Backlog Tires</p>
                      <p className="text-amber-700 mt-1">
                        = SUM(quantity) for unfulfilled orders
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Source: sales_order_items WHERE status IN ('confirmed', 'processing')
                      </p>
                    </div>

                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">Backlog Revenue</p>
                      <p className="text-blue-700 mt-1">
                        = SUM(quantity × unit_price)
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Revenue / Tire = Backlog Revenue / Backlog Tires
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Backlog Gross Profit</p>
                      <p className="text-green-700 mt-1">
                        = SUM(quantity × (unit_price - unit_cost))
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        GP% = (Backlog GP / Backlog Revenue) × 100
                      </p>
                    </div>

                    <div className="p-2 bg-purple-50 rounded">
                      <p className="font-semibold text-purple-900">Data Status</p>
                      <p className="text-purple-700 mt-1">
                        ✓ Ready - Data available from sales_orders table
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Data Available
          </Badge>
        </div>
        <CardDescription>Unfulfilled firm customer orders - revenue and margin tracking</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">TM Avg</TableHead>
              <TableHead className="text-right">YTD Avg</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-amber-50/50">
              <TableCell className="font-bold">
                Backlog Tires
                <span className="text-xs text-muted-foreground block font-normal">Unfulfilled units</span>
              </TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatNumber(mockBacklogData.backlogTires.current)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatNumber(mockBacklogData.backlogTires.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatNumber(mockBacklogData.backlogTires.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatNumber(mockBacklogData.backlogTires.py)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-blue-50/50">
              <TableCell className="font-bold">Backlog Revenue</TableCell>
              <TableCell className="text-right font-bold text-lg text-blue-700">
                {formatCurrency(mockBacklogData.backlogRevenue.current)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(mockBacklogData.backlogRevenue.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.backlogRevenue.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockBacklogData.backlogRevenue.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-6">Revenue / Tire</TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.revenuePerTire.current)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.revenuePerTire.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.revenuePerTire.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockBacklogData.revenuePerTire.py)}
              </TableCell>
            </TableRow>
            <TableRow className="border-t bg-green-50/50">
              <TableCell className="font-bold">Backlog Gross Profit</TableCell>
              <TableCell className="text-right font-bold text-lg text-green-700">
                {formatCurrency(mockBacklogData.backlogGrossProfit.current)}
              </TableCell>
              <TableCell className="text-right font-semibold text-green-700">
                {formatCurrency(mockBacklogData.backlogGrossProfit.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.backlogGrossProfit.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockBacklogData.backlogGrossProfit.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium pl-6">GP / Tire</TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.gpPerTire.current)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.gpPerTire.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockBacklogData.gpPerTire.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockBacklogData.gpPerTire.py)}
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-bold">GP %</TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatPercent(mockBacklogData.gpPercent.current)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatPercent(mockBacklogData.gpPercent.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatPercent(mockBacklogData.gpPercent.ytdAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatPercent(mockBacklogData.gpPercent.py)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-900 flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            <strong>Good News:</strong> This data is 100% ready! Can be fetched directly from sales_orders table.
          </p>
          <p className="text-xs text-green-700 mt-2">
            <strong>Query:</strong> SELECT from sales_orders WHERE status IN ('confirmed', 'processing') - these are firm orders not yet fulfilled
          </p>
        </div>

        <Alert className="mt-4" variant="default">
          <AlertDescription className="text-sm">
            Sample data shown. Real backlog = unfulfilled tires on confirmed sales orders. Query sales_orders + sales_order_items where status = 'confirmed' or 'processing'.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
