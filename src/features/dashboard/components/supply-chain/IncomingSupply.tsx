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

// Mock data for order cycles (GDC0, GDC1, GDC2)
const mockIncomingSupplyData = [
  {
    orderCycle: 'GDC2',
    tiresOrdered: 1500,
    containers: 3,
    annualWindow: '2027-01 to 2027-03',
    weeksLeft: 16.2,
    sold: 850,
    unsold: 650,
    forwardCommitPercent: 56.7,
    actualWeeklyVelocity: 42,
    requiredWeeklyVelocity: 40,
    velocityGap: 2,
    projectedUncommitted: 169
  },
  {
    orderCycle: 'GDC1',
    tiresOrdered: 1800,
    containers: 4,
    annualWindow: '2026-10 to 2026-12',
    weeksLeft: 4.5,
    sold: 1620,
    unsold: 180,
    forwardCommitPercent: 90.0,
    actualWeeklyVelocity: 38,
    requiredWeeklyVelocity: 40,
    velocityGap: -2,
    projectedUncommitted: 9
  },
  {
    orderCycle: 'GDC0',
    tiresOrdered: 1200,
    containers: 3,
    annualWindow: '2026-07 to 2026-09',
    weeksLeft: 0,
    sold: 1200,
    unsold: 0,
    forwardCommitPercent: 100.0,
    actualWeeklyVelocity: 0,
    requiredWeeklyVelocity: 0,
    velocityGap: 0,
    projectedUncommitted: 0
  }
];

export function IncomingSupply() {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  const getVelocityColor = (gap: number) => {
    if (gap > 0) return 'text-green-600';
    if (gap < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getCommitmentColor = (percent: number) => {
    if (percent >= 80) return 'bg-green-100 text-green-800';
    if (percent >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Table 4.1 - Incoming Supply</CardTitle>
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
                      <p className="font-semibold text-blue-900">Tires Ordered / Containers</p>
                      <p className="text-blue-700 mt-1">
                        = SUM from purchase_orders by order_cycle
                      </p>
                      <p className="text-blue-600 mt-1 text-[10px]">
                        Source: purchase_order_items grouped by PO.order_cycle
                      </p>
                    </div>

                    <div className="p-2 bg-green-50 rounded">
                      <p className="font-semibold text-green-900">Forward Commit %</p>
                      <p className="text-green-700 mt-1">
                        = (Sold / Tires Ordered) × 100
                      </p>
                      <p className="text-green-600 mt-1 text-[10px]">
                        Pre-sold share of incoming supply
                      </p>
                    </div>

                    <div className="p-2 bg-amber-50 rounded">
                      <p className="font-semibold text-amber-900">Required Weekly Velocity</p>
                      <p className="text-amber-700 mt-1">
                        = Unsold / Weeks Left
                      </p>
                      <p className="text-amber-600 mt-1 text-[10px]">
                        Sales pace needed to clear inventory before arrival
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded">
                      <p className="font-semibold text-red-900">Velocity Gap</p>
                      <p className="text-red-700 mt-1">
                        = Actual Weekly Velocity - Required Weekly Velocity
                      </p>
                      <p className="text-red-600 mt-1 text-[10px]">
                        Positive = ahead of pace, Negative = behind pace
                      </p>
                    </div>

                    <div className="p-2 bg-purple-50 rounded">
                      <p className="font-semibold text-purple-900">Projected Uncommitted</p>
                      <p className="text-purple-700 mt-1">
                        = max(0, Unsold - Velocity × Weeks Left)
                      </p>
                      <p className="text-purple-600 mt-1 text-[10px]">
                        Expected unsold inventory at cycle arrival
                      </p>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Badge variant="secondary">Sample Data</Badge>
        </div>
        <CardDescription>Order cycle tracking, velocity, and forward commitment</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Horizontal scroll container for wide table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Order Cycle</TableHead>
                <TableHead className="text-right">Tires Ordered</TableHead>
                <TableHead className="text-right">Containers</TableHead>
                <TableHead>Annual Window</TableHead>
                <TableHead className="text-right">Weeks Left</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Unsold</TableHead>
                <TableHead className="text-right">Forward Commit %</TableHead>
                <TableHead className="text-right">Actual Weekly Velocity</TableHead>
                <TableHead className="text-right">Required Weekly Velocity</TableHead>
                <TableHead className="text-right">Velocity Gap</TableHead>
                <TableHead className="text-right">Projected Uncommitted at Arrival</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockIncomingSupplyData.map((cycle) => (
                <TableRow key={cycle.orderCycle} className={cycle.orderCycle === 'GDC0' ? 'bg-muted/30' : ''}>
                  <TableCell className="sticky left-0 bg-background z-10 font-bold">
                    {cycle.orderCycle}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatNumber(cycle.tiresOrdered)}
                  </TableCell>
                  <TableCell className="text-right">
                    {cycle.containers}
                  </TableCell>
                  <TableCell className="text-sm">
                    {cycle.annualWindow}
                  </TableCell>
                  <TableCell className="text-right">
                    {cycle.weeksLeft > 0 ? cycle.weeksLeft.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-700">
                    {formatNumber(cycle.sold)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-amber-700">
                    {formatNumber(cycle.unsold)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={getCommitmentColor(cycle.forwardCommitPercent)}>
                      {formatPercent(cycle.forwardCommitPercent)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {cycle.actualWeeklyVelocity > 0 ? formatNumber(cycle.actualWeeklyVelocity) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {cycle.requiredWeeklyVelocity > 0 ? formatNumber(cycle.requiredWeeklyVelocity) : '—'}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getVelocityColor(cycle.velocityGap)}`}>
                    {cycle.velocityGap !== 0 ? (
                      <>
                        {cycle.velocityGap > 0 ? '+' : ''}{cycle.velocityGap}
                        {cycle.velocityGap > 0 ? (
                          <TrendingUp className="h-3 w-3 inline ml-1" />
                        ) : cycle.velocityGap < 0 ? (
                          <TrendingDown className="h-3 w-3 inline ml-1" />
                        ) : null}
                      </>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {cycle.projectedUncommitted > 0 ? (
                      <span className="text-red-600">{formatNumber(cycle.projectedUncommitted)}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
          <p className="text-blue-900 mb-2">
            <strong>Key Metrics Explained:</strong>
          </p>
          <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
            <li><strong>Forward Commit %:</strong> Share of cycle already sold = (Sold / Tires Ordered) × 100</li>
            <li><strong>Required Velocity:</strong> Selling pace needed to sell all unsold tires before arrival = Unsold / Weeks Left</li>
            <li><strong>Velocity Gap:</strong> Actual - Required. Positive = ahead of pace ✓, Negative = behind pace ✗</li>
            <li><strong>Projected Uncommitted:</strong> Tires expected to remain unsold when cycle arrives = max(0, Unsold - Actual Velocity × Weeks Left)</li>
          </ul>
        </div>

        <Alert className="mt-4" variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Sample data shown. Real data from purchase_orders (order_cycle field), matched with sales_orders allocation. Weekly velocity calculated from recent sales data.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
