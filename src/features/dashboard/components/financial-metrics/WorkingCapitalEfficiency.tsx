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
const mockEfficiencyData = {
  dso: { fm: 28, tm: 32, ytd: 30, py: 35 },
  dpo: { fm: 42, tm: 45, ytd: 43, py: 40 },
  dio: { fm: 65, tm: 68, ytd: 67, py: 72 },
  ccc: { fm: 51, tm: 55, ytd: 54, py: 67 }
};

export function WorkingCapitalEfficiency() {
  const getTrendIcon = (current: number, previous: number, lowerIsBetter: boolean) => {
    const improved = lowerIsBetter ? current < previous : current > previous;
    return improved ? (
      <TrendingDown className="h-4 w-4 text-green-600 inline ml-1" />
    ) : (
      <TrendingUp className="h-4 w-4 text-red-600 inline ml-1" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 1.3 - Working Capital Efficiency</CardTitle>
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
                      <p className="font-semibold text-blue-900">DSO (Days Sales Outstanding)</p>
                      <p className="text-blue-700 mt-1">
                        = (AR / Revenue) × Days in Period
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Lower is better - faster customer payments
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">DPO (Days Payable Outstanding)</p>
                      <p className="text-red-700 mt-1">
                        = (AP / COGS) × Days in Period
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Higher is better - slower supplier payments
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">DIO (Days Inventory Outstanding)</p>
                      <p className="text-amber-700 mt-1">
                        = (Avg Inventory / COGS) × Days in Period
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Lower is better - faster inventory turnover
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">CCC (Cash Conversion Cycle)</p>
                      <p className="text-green-700 mt-1">
                        = DSO + DIO - DPO
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        Lower is better - cash tied up for fewer days
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>DSO, DPO, DIO, and Cash Conversion Cycle</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">FM</TableHead>
              <TableHead className="text-right">TM</TableHead>
              <TableHead className="text-right">YTD</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                DSO
                <span className="text-xs text-muted-foreground block">Days Sales Outstanding</span>
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dso.fm} days</TableCell>
              <TableCell className="text-right font-semibold">
                {mockEfficiencyData.dso.tm} days
                {getTrendIcon(mockEfficiencyData.dso.tm, mockEfficiencyData.dso.py, true)}
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dso.ytd} days</TableCell>
              <TableCell className="text-right text-muted-foreground">{mockEfficiencyData.dso.py} days</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                DPO
                <span className="text-xs text-muted-foreground block">Days Payable Outstanding</span>
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dpo.fm} days</TableCell>
              <TableCell className="text-right font-semibold">
                {mockEfficiencyData.dpo.tm} days
                {getTrendIcon(mockEfficiencyData.dpo.tm, mockEfficiencyData.dpo.py, false)}
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dpo.ytd} days</TableCell>
              <TableCell className="text-right text-muted-foreground">{mockEfficiencyData.dpo.py} days</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                DIO
                <span className="text-xs text-muted-foreground block">Days Inventory Outstanding</span>
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dio.fm} days</TableCell>
              <TableCell className="text-right font-semibold">
                {mockEfficiencyData.dio.tm} days
                {getTrendIcon(mockEfficiencyData.dio.tm, mockEfficiencyData.dio.py, true)}
              </TableCell>
              <TableCell className="text-right">{mockEfficiencyData.dio.ytd} days</TableCell>
              <TableCell className="text-right text-muted-foreground">{mockEfficiencyData.dio.py} days</TableCell>
            </TableRow>
            <TableRow className="border-t-2 bg-muted/30">
              <TableCell className="font-bold">
                CCC
                <span className="text-xs text-muted-foreground block font-normal">Cash Conversion Cycle</span>
              </TableCell>
              <TableCell className="text-right font-semibold">{mockEfficiencyData.ccc.fm} days</TableCell>
              <TableCell className="text-right font-bold text-lg">
                {mockEfficiencyData.ccc.tm} days
                {getTrendIcon(mockEfficiencyData.ccc.tm, mockEfficiencyData.ccc.py, true)}
              </TableCell>
              <TableCell className="text-right font-semibold">{mockEfficiencyData.ccc.ytd} days</TableCell>
              <TableCell className="text-right text-muted-foreground">{mockEfficiencyData.ccc.py} days</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <strong>Formula:</strong> CCC = DSO + DIO - DPO = {mockEfficiencyData.dso.tm} + {mockEfficiencyData.dio.tm} - {mockEfficiencyData.dpo.tm} = {mockEfficiencyData.ccc.tm} days
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Lower CCC is better - indicates cash is tied up for fewer days in working capital.
          </p>
        </div>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real calculations require historical AR, AP, and inventory data with aging analysis.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
