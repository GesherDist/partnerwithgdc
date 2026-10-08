import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { AlertCircle, Eye } from 'lucide-react';

// Mock data
const mockLiquidityData = {
  cashToday: { amount: 245000, date: '2026-10-08', py: 180000 },
  lowCash: { amount: 125000, date: '2026-09-15' },
  highCash: { amount: 420000, date: '2026-08-22' },
  projectedCash: { amount: 280000, throughDate: '2026-10-31' }
};

export function LiquidityTable() {
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
            <CardTitle className="text-lg">Table 1.1 - Liquidity</CardTitle>
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
                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Cash Today</p>
                      <p className="text-green-700 mt-1">
                        = Current bank balance
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        Source: Banking/accounting integration required
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">Low Cash (Last 12 Months)</p>
                      <p className="text-red-700 mt-1">
                        = MIN(daily_cash_balance) over last 12 months
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Lowest point to identify cash flow risks
                      </p>
                    </div>

                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">High Cash (Last 12 Months)</p>
                      <p className="text-blue-700 mt-1">
                        = MAX(daily_cash_balance) over last 12 months
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Peak cash position for planning
                      </p>
                    </div>

                    <div className="p-2 bg-purple-50 rounded">
                      <p className="font-semibold text-purple-900">Projected Cash (30 Days)</p>
                      <p className="text-purple-700 mt-1">
                        = Cash Today + Expected AR - Expected AP
                      </p>
                      <p className="text-purple-600 mt-1 text-[10px]">
                        Based on invoice due dates and payment terms
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Data Status</p>
                      <p className="text-amber-700 mt-1">
                        Pending - Requires banking integration
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>Cash position and projections</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Date</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Cash Today</TableCell>
              <TableCell className="text-right font-semibold text-green-600">
                {formatCurrency(mockLiquidityData.cashToday.amount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockLiquidityData.cashToday.date}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockLiquidityData.cashToday.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Low Cash</TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockLiquidityData.lowCash.amount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockLiquidityData.lowCash.date}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">High Cash</TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockLiquidityData.highCash.amount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockLiquidityData.highCash.date}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Projected Cash</TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockLiquidityData.projectedCash.amount)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                Through {mockLiquidityData.projectedCash.throughDate}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real cash data requires integration with banking/accounting system.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
