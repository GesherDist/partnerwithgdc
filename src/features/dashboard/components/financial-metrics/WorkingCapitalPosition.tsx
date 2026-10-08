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
const mockWorkingCapitalData = {
  accountsReceivable: {
    current: 385000,
    weightedTiming: '32 days',
    tmAvg: 420000,
    ytdAvg: 398000,
    py: 350000
  },
  accountsPayable: {
    current: 520000,
    weightedTiming: '45 days',
    tmAvg: 480000,
    ytdAvg: 505000,
    py: 460000
  },
  inventory: {
    current: 1250000,
    weightedTiming: '—',
    tmAvg: 1180000,
    ytdAvg: 1220000,
    py: 980000
  }
};

export function WorkingCapitalPosition() {
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
            <CardTitle className="text-lg">Table 1.2 - Working Capital Position</CardTitle>
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
                      <p className="font-semibold text-blue-900">Accounts Receivable (AR)</p>
                      <p className="text-blue-700 mt-1">
                        = SUM(invoices.grand_total) WHERE status IN ('sent', 'partial')
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Weighted Timing = Σ(amount × days_until_due) / Σ(amount)
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">Accounts Payable (AP)</p>
                      <p className="text-red-700 mt-1">
                        = SUM(qty × unit_cost) for unpaid POs
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Source: purchase_order_items WHERE status IN ('confirmed', 'in_production', 'ready_to_ship')
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Inventory</p>
                      <p className="text-amber-700 mt-1">
                        = SUM(on_hand × unit_cost)
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Source: inventory.on_hand × products.unit_cost
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Data Status</p>
                      <p className="text-green-700 mt-1">
                        AR, AP, Inventory data available from database
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>AR, AP, and Inventory with weighted timing</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Weighted Timing</TableHead>
              <TableHead className="text-right">TM Avg</TableHead>
              <TableHead className="text-right">YTD Avg</TableHead>
              <TableHead className="text-right">PY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Accounts Receivable</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(mockWorkingCapitalData.accountsReceivable.current)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockWorkingCapitalData.accountsReceivable.weightedTiming}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsReceivable.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsReceivable.ytdAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsReceivable.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Accounts Payable</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(mockWorkingCapitalData.accountsPayable.current)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockWorkingCapitalData.accountsPayable.weightedTiming}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsPayable.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsPayable.ytdAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.accountsPayable.py)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">Inventory</TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(mockWorkingCapitalData.inventory.current)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {mockWorkingCapitalData.inventory.weightedTiming}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.inventory.tmAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.inventory.ytdAvg)}
              </TableCell>
              <TableCell className="text-right">
                {formatCurrency(mockWorkingCapitalData.inventory.py)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real data available from invoices (AR), purchase orders (AP), and inventory tables.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
