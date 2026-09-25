'use client';

/**
 * Fulfillment Source Breakdown Component
 *
 * Displays pie chart showing distribution across fulfillment sources:
 * - GDC Inventory
 * - Platinum Dealer Inventory
 * - Platinum Dealer Fulfillment
 * - Manufacturer Direct
 *
 * 🆕 NEW - Sept 25, 2026
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { FulfillmentSourceBreakdown as BreakdownType } from '../types';

interface FulfillmentSourceBreakdownProps {
  data: BreakdownType[];
}

const COLORS = {
  gdc_inventory: '#3b82f6',              // Blue
  platinum_dealer_inventory: '#a855f7',  // Purple
  platinum_dealer_fulfillment: '#6366f1', // Indigo
  direct: '#22c55e'                      // Green
};

const LABELS = {
  gdc_inventory: 'GDC Inventory',
  platinum_dealer_inventory: 'Dealer Inventory',
  platinum_dealer_fulfillment: 'Dealer Fulfillment',
  direct: 'Manufacturer Direct'
};

export function FulfillmentSourceBreakdown({ data }: FulfillmentSourceBreakdownProps) {
  if (!data || data.length === 0) {
    return null;
  }

  const chartData = data.map(item => ({
    name: LABELS[item.source],
    value: item.quantity,
    percentage: item.percentage
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fulfillment Source Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pie Chart */}
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ percentage }) => `${percentage.toFixed(1)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={data[index] ? COLORS[data[index].source] : '#8884d8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>

          {/* Stats List */}
          <div className="space-y-4">
            {data.map(item => (
              <div key={item.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: COLORS[item.source] }}
                  />
                  <span className="text-sm font-medium">{LABELS[item.source]}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{item.quantity} units</div>
                  <div className="text-xs text-muted-foreground">
                    {item.percentage.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
