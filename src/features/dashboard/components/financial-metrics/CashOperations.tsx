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
const mockCashOpsData = {
  operatingCashFlow: { mtd: 45000, tm: 125000, ytd: 620000, py: 480000 },
  capex: { mtd: -12000, tm: -35000, ytd: -145000, py: -120000 },
  freeCashFlow: { mtd: 33000, tm: 90000, ytd: 475000, py: 360000 }
};

export function CashOperations() {
  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));

    return amount < 0 ? `(${formatted})` : formatted;
  };

  const getCellClass = (amount: number) => {
    if (amount > 0) return 'text-green-600 font-semibold';
    if (amount < 0) return 'text-red-600';
    return '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 1.4 - Cash Operations</CardTitle>
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
                      <p className="font-semibold text-green-900">Operating Cash Flow (OCF)</p>
                      <p className="text-green-700 mt-1">
                        = Operating Profit + D&A - ΔWC - Cash Taxes - Cash Interest
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        Cash generated from core business operations
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">CapEx (Capital Expenditures)</p>
                      <p className="text-red-700 mt-1">
                        = SUM(expenses) WHERE category = 'capital'
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Investment in long-term assets (shown as negative)
                      </p>
                    </div>

                    <div className="p-2 bg-blue-50 rounded">
                      <p className="font-semibold text-blue-900">Free Cash Flow (FCF)</p>
                      <p className="text-blue-700 mt-1">
                        = Operating Cash Flow - CapEx
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Positive = business generates surplus cash
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Data Status</p>
                      <p className="text-amber-700 mt-1">
                        Pending - Requires expense tracking with categories
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>Operating Cash Flow, CapEx, and Free Cash Flow</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">MTD</TableHead>
              <TableHead className="text-right">TM</TableHead>
              <TableHead className="text-right">YTD</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">
                Operating Cash Flow
                <span className="text-xs text-muted-foreground block">Cash from operations</span>
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.operatingCashFlow.mtd)}`}>
                {formatCurrency(mockCashOpsData.operatingCashFlow.mtd)}
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.operatingCashFlow.tm)}`}>
                {formatCurrency(mockCashOpsData.operatingCashFlow.tm)}
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.operatingCashFlow.ytd)}`}>
                {formatCurrency(mockCashOpsData.operatingCashFlow.ytd)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockCashOpsData.operatingCashFlow.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                CapEx
                <span className="text-xs text-muted-foreground block">Capital Expenditures</span>
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.capex.mtd)}`}>
                {formatCurrency(mockCashOpsData.capex.mtd)}
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.capex.tm)}`}>
                {formatCurrency(mockCashOpsData.capex.tm)}
              </TableCell>
              <TableCell className={`text-right ${getCellClass(mockCashOpsData.capex.ytd)}`}>
                {formatCurrency(mockCashOpsData.capex.ytd)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(mockCashOpsData.capex.py)}
              </TableCell>
            </TableRow>
            <TableRow className="border-t-2 bg-muted/30">
              <TableCell className="font-bold">
                Free Cash Flow
                <span className="text-xs text-muted-foreground block font-normal">OCF - CapEx</span>
              </TableCell>
              <TableCell className={`text-right font-bold ${getCellClass(mockCashOpsData.freeCashFlow.mtd)}`}>
                {formatCurrency(mockCashOpsData.freeCashFlow.mtd)}
              </TableCell>
              <TableCell className={`text-right font-bold text-lg ${getCellClass(mockCashOpsData.freeCashFlow.tm)}`}>
                {formatCurrency(mockCashOpsData.freeCashFlow.tm)}
              </TableCell>
              <TableCell className={`text-right font-bold ${getCellClass(mockCashOpsData.freeCashFlow.ytd)}`}>
                {formatCurrency(mockCashOpsData.freeCashFlow.ytd)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground font-semibold">
                {formatCurrency(mockCashOpsData.freeCashFlow.py)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-900">
            <strong>Formula:</strong> FCF = Operating Cash Flow - CapEx
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Positive FCF means business generates more cash than needed for operations. Negative FCF means funding from reserves or debt.
          </p>
        </div>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real OCF calculation requires: Operating Profit + D&A - ΔWC - Cash Taxes - Cash Interest. CapEx tracking needed.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
