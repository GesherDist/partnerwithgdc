'use client';

/**
 * Dashboard Chart Components
 *
 * Recharts-based charts for dashboard analytics.
 * Revenue Trend, Units by SKU, Channel Performance, Margin Analysis.
 */

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type {
  RevenueDataPoint,
  UnitsBySKUDataPoint,
  ProductLegendItem,
  ChannelPerformanceDataPoint,
  MarginDataPoint,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  tertiary: '#8b5cf6',
  warning: '#f59e0b',
  muted: '#94a3b8',
  target: '#ef4444',
};

// ============================================
// REVENUE TREND CHART
// ============================================

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue Trend</CardTitle>
        <CardDescription>Monthly revenue vs target</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis
              tickFormatter={(value) => `$${value / 1000}k`}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.primary}
              strokeWidth={2}
              dot={{ fill: COLORS.primary, strokeWidth: 2 }}
              name="Revenue"
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke={COLORS.target}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
            />
            <Line
              type="monotone"
              dataKey="lastYear"
              stroke={COLORS.muted}
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              name="Last Year"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ============================================
// UNITS BY SKU CHART
// ============================================

interface UnitsBySKUChartProps {
  data: UnitsBySKUDataPoint[];
  products?: ProductLegendItem[];
}

export function UnitsBySKUChart({ data, products }: UnitsBySKUChartProps) {
  // Default products for backward compatibility
  const defaultProducts: ProductLegendItem[] = [
    { key: 'units38', label: '38" Tire', color: COLORS.primary },
    { key: 'units24', label: '24" Tire', color: COLORS.secondary },
  ];

  const productList = products && products.length > 0 ? products : defaultProducts;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Units by SKU</CardTitle>
        <CardDescription>Product sales by month</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            {productList.map((product) => (
              <Bar
                key={product.key}
                dataKey={product.key}
                fill={product.color}
                name={product.label}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ============================================
// CHANNEL PERFORMANCE CHART
// ============================================

interface ChannelPerformanceChartProps {
  data: ChannelPerformanceDataPoint[];
}

export function ChannelPerformanceChart({ data }: ChannelPerformanceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalUnits = data.reduce((sum, item) => sum + item.units, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel Performance</CardTitle>
        <CardDescription>OEM vs Dealer breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-8">
          <ResponsiveContainer width="50%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="revenue"
                nameKey="channel"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-4">
            {data.map((item) => (
              <div key={item.channel} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm font-medium">{item.channel}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.units} units</span>
                  <span>{((item.revenue / totalRevenue) * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm font-medium">
                <span>Total</span>
                <span>{formatCurrency(totalRevenue)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {totalUnits} units
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MARGIN ANALYSIS CHART
// ============================================

interface MarginChartProps {
  data: MarginDataPoint[];
}

export function MarginChart({ data }: MarginChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Margin Analysis</CardTitle>
        <CardDescription>Blended margin % trend</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="month" className="text-xs" />
            <YAxis
              tickFormatter={(value) => `${value}%`}
              domain={[20, 40]}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => `${value.toFixed(1)}%`}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="margin"
              stroke={COLORS.tertiary}
              fill={COLORS.tertiary}
              fillOpacity={0.3}
              strokeWidth={2}
              name="Blended Margin"
            />
            <Line
              type="monotone"
              dataKey="target"
              stroke={COLORS.target}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Target"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ============================================
// CHARTS GRID WRAPPER
// ============================================

interface DashboardChartsGridProps {
  revenueData: RevenueDataPoint[];
  unitsData: UnitsBySKUDataPoint[];
  unitsProducts?: ProductLegendItem[];
  channelData: ChannelPerformanceDataPoint[];
  marginData: MarginDataPoint[];
}

export function DashboardChartsGrid({
  revenueData,
  unitsData,
  unitsProducts,
  channelData,
  marginData,
}: DashboardChartsGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RevenueChart data={revenueData} />
      <UnitsBySKUChart data={unitsData} products={unitsProducts} />
      <ChannelPerformanceChart data={channelData} />
      <MarginChart data={marginData} />
    </div>
  );
}
