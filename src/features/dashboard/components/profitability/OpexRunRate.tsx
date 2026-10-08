import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { AlertCircle, Eye, TrendingDown, TrendingUp } from 'lucide-react';

// Mock data
const mockOpexRunRateData = {
  opexPerMonth: {
    currentMonth: 29500,
    tmAvg: 30667,
    py: 38333
  },
  annualizedOpex: {
    currentMonth: 354000,
    tmAvg: 368000,
    py: 460000
  }
};

export function OpexRunRate() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getTrendIcon = (current: number, previous: number) => {
    // For OPEX, lower is better
    return current < previous ? (
      <TrendingDown className="h-4 w-4 text-green-600 inline ml-1" />
    ) : (
      <TrendingUp className="h-4 w-4 text-red-600 inline ml-1" />
    );
  };

  const getPercentChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 2.3 - OPEX Run Rate</CardTitle>
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
                      <p className="font-semibold text-amber-900">OPEX / Month (Current)</p>
                      <p className="text-amber-700 mt-1">
                        = Actual MTD Spending + Forecast Remaining Days
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Source: expenses WHERE category = 'opex' AND month = current
                      </p>
                    </div>

                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">OPEX / Month (TM Avg)</p>
                      <p className="text-blue-700 mt-1">
                        = AVG(monthly_opex) over trailing 3 months
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        90-day rolling average for trend analysis
                      </p>
                    </div>

                    <div className="p-2 bg-purple-50 rounded">
                      <p className="font-semibold text-purple-900">Annualized OPEX</p>
                      <p className="text-purple-700 mt-1">
                        = Monthly OPEX × 12
                      </p>
                      <p className="text-purple-600 mt-1 text-[10px]">
                        Full-year projection at current run rate
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">Data Status</p>
                      <p className="text-red-700 mt-1">
                        Pending - Requires expense tracking system
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>Operating expense monthly and annualized projections</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">Current Month Est.</TableHead>
              <TableHead className="text-right">TM Avg</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-amber-50/50">
              <TableCell className="font-bold">
                OPEX / Month
                <span className="text-xs text-muted-foreground block font-normal">Monthly operating expense</span>
              </TableCell>
              <TableCell className="text-right font-bold text-lg">
                {formatCurrency(mockOpexRunRateData.opexPerMonth.currentMonth)}
                {getTrendIcon(mockOpexRunRateData.opexPerMonth.currentMonth, mockOpexRunRateData.opexPerMonth.py)}
                <span className="text-xs text-muted-foreground block mt-1">
                  {getPercentChange(mockOpexRunRateData.opexPerMonth.currentMonth, mockOpexRunRateData.opexPerMonth.py)} vs PY
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(mockOpexRunRateData.opexPerMonth.tmAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockOpexRunRateData.opexPerMonth.py)}
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2 bg-blue-50/50">
              <TableCell className="font-bold">
                Annualized OPEX
                <span className="text-xs text-muted-foreground block font-normal">Monthly × 12</span>
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-blue-700">
                {formatCurrency(mockOpexRunRateData.annualizedOpex.currentMonth)}
                <span className="text-xs text-muted-foreground block mt-1">
                  Based on current month
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold text-blue-700">
                {formatCurrency(mockOpexRunRateData.annualizedOpex.tmAvg)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockOpexRunRateData.annualizedOpex.py)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <strong>Current Month Estimate:</strong> Actual MTD spending + forecast for remaining days
          </p>
          <p className="text-xs text-blue-700 mt-1">
            <strong>TM Average:</strong> Average monthly OPEX over trailing 90 days (3 months)
          </p>
          <p className="text-xs text-blue-700 mt-1">
            <strong>Annualized:</strong> Monthly OPEX × 12 = {formatCurrency(mockOpexRunRateData.opexPerMonth.currentMonth)} × 12 = {formatCurrency(mockOpexRunRateData.annualizedOpex.currentMonth)}
          </p>
        </div>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real calculation requires: expenses table filtered to OPEX category, grouped by month. Current month needs forecast logic.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
