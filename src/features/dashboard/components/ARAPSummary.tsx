'use client';

/**
 * ARAPSummary Component
 *
 * Accounts Receivable aging and Accounts Payable summary.
 * Shows AR aging buckets and AP outstanding to Galileo.
 */

import { CreditCard, TrendingDown, AlertTriangle, Building2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';

import type { ARAgingData, APSummaryData } from '../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// AR AGING COMPONENT
// ============================================

interface ARAgingProps {
  data: ARAgingData;
}

export function ARAgingChart({ data }: ARAgingProps) {
  const chartData = [
    { name: 'Current', value: data.current, fill: '#10b981' },
    { name: '1-30 days', value: data.days30, fill: '#3b82f6' },
    { name: '31-60 days', value: data.days60, fill: '#f59e0b' },
    { name: '60+ days', value: data.days90Plus, fill: '#ef4444' },
  ];

  const totalAR = data.current + data.days30 + data.days60 + data.days90Plus;
  const pastDueAmount = data.days60 + data.days90Plus;
  const pastDuePercent = ((pastDueAmount / totalAR) * 100).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              AR Aging
            </CardTitle>
            <CardDescription>Accounts receivable by age</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold">{formatCurrency(totalAR)}</div>
            {pastDueAmount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {formatCurrency(pastDueAmount)} past due ({pastDuePercent}%)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis
              type="number"
              tickFormatter={(value) => `$${value / 1000}k`}
              className="text-xs"
            />
            <YAxis type="category" dataKey="name" width={80} className="text-xs" />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* AR Breakdown */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t">
          {chartData.map((item) => (
            <div key={item.name} className="text-center">
              <div
                className="h-2 rounded-full mb-1"
                style={{ backgroundColor: item.fill }}
              />
              <div className="text-xs text-muted-foreground">{item.name}</div>
              <div className="text-sm font-semibold">{formatCurrency(item.value)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// AP SUMMARY COMPONENT
// ============================================

interface APSummaryProps {
  data: APSummaryData;
}

export function APSummaryCard({ data }: APSummaryProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              AP Summary
            </CardTitle>
            <CardDescription>Payables to {data.supplierName}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Outstanding */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-violet-100 text-violet-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Outstanding</div>
                <div className="text-xs text-muted-foreground">{data.supplierName}</div>
              </div>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(data.totalOutstanding)}</div>
          </div>

          {/* Due This Week / Next Week */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Due This Week</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                  Upcoming
                </Badge>
              </div>
              <div className="text-lg font-bold">{formatCurrency(data.dueThisWeek)}</div>
            </div>
            <div className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Due Next Week</span>
              </div>
              <div className="text-lg font-bold">{formatCurrency(data.dueNextWeek)}</div>
            </div>
          </div>

          {/* Payment Progress */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Payment Schedule</span>
              <span>
                {(((data.dueThisWeek + data.dueNextWeek) / data.totalOutstanding) * 100).toFixed(0)}% due in 2 weeks
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-amber-500"
                style={{ width: `${(data.dueThisWeek / data.totalOutstanding) * 100}%` }}
              />
              <div
                className="h-full bg-blue-500"
                style={{ width: `${(data.dueNextWeek / data.totalOutstanding) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                This week
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Next week
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted" />
                Later
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// COMBINED COMPONENT
// ============================================

interface ARAPSummaryProps {
  arData: ARAgingData;
  apData: APSummaryData;
}

export function ARAPSummary({ arData, apData }: ARAPSummaryProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ARAgingChart data={arData} />
      <APSummaryCard data={apData} />
    </div>
  );
}
