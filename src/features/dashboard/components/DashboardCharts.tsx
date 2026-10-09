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
import { useState } from 'react';
import { Eye, X } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';

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
  const [isOpen, setIsOpen] = useState(false);

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
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Revenue Trend</CardTitle>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-accent">
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-[420px] p-0" sideOffset={8}>
              <div className="relative">
                <div className="flex items-start justify-between border-b bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight">Revenue Trend Calculation</h4>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setIsOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation Formula</p>
                    <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line border">
                      {`Revenue = Sum of sales_orders.grand_total
(Ankur's Definition 3.1: Recognized Revenue Only)

Database Sources:
• Sales Orders: grand_total WHERE status IN (delivered)

Filtered by: order_date (Order Date)
Status: delivered (recognized revenue only)
Target: $220,000/month (hardcoded)
Last Year: Same period previous year`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Monthly recognized revenue (delivered/invoiced orders only) vs target. Data grouped by month based on order date.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
  const [isOpen, setIsOpen] = useState(false);

  // Default products for backward compatibility
  const defaultProducts: ProductLegendItem[] = [
    { key: 'units38', label: '38" Tire', color: COLORS.primary },
    { key: 'units24', label: '24" Tire', color: COLORS.secondary },
  ];

  const productList = products && products.length > 0 ? products : defaultProducts;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Units by SKU</CardTitle>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-accent">
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-[420px] p-0" sideOffset={8}>
              <div className="relative">
                <div className="flex items-start justify-between border-b bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight">Units by SKU Calculation</h4>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setIsOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation Formula</p>
                    <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line border">
                      {`Units = Sum of shipment_items.quantity_shipped

Database Sources:
• Items: shipment_items.quantity_shipped
• Shipments: shipments.eta_to_port
• Grouped by: products.name, month

Filtered by: eta_to_port (ETA to US Port)
Product Type: item_type = 'inventory' only`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Shows units arriving (inventory coming IN) by SKU per month based on shipment ETA to US port. Excludes service items.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <CardDescription>Shipment units by ETA to port</CardDescription>
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
  const [isOpen, setIsOpen] = useState(false);

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
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Channel Performance</CardTitle>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-accent">
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-[420px] p-0" sideOffset={8}>
              <div className="relative">
                <div className="flex items-start justify-between border-b bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight">Channel Performance Calculation</h4>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setIsOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation Formula</p>
                    <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line border">
                      {`Revenue by Channel = Sum of sales_orders.grand_total grouped by channel
(Ankur's Definition: Recognized Revenue Only)

Database Sources:
• Revenue: sales_orders.grand_total
• Units: sales_order_items.quantity
• Channel: customers.channel (OEM or Dealer)

Filtered by: order_date (Order Date)
Status: delivered (recognized revenue only)`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Recognized revenue (delivered/invoiced only) by channel. OEM = Original Equipment Manufacturers, Dealer = Independent dealers.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Margin Analysis</CardTitle>
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full hover:bg-accent">
                <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-[420px] p-0" sideOffset={8}>
              <div className="relative">
                <div className="flex items-start justify-between border-b bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md bg-primary/10 p-1.5">
                      <Eye className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-semibold text-sm leading-tight">Margin Analysis Calculation</h4>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md" onClick={() => setIsOpen(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-3 px-4 py-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calculation Formula</p>
                    <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line border">
                      {`Gross Margin % = (Revenue - COGS) / Revenue × 100
(Ankur's Definition 3.2: Gross Profit)

Where:
• Revenue = sales_order_items.unit_price × quantity
• COGS = products.base_cost × quantity

Database Sources:
• Sales: sales_order_items (unit_price, quantity)
• Cost: products.base_cost

Filtered by: order_date (Order Date)
Status: delivered (recognized revenue only)
Target: 30% (hardcoded benchmark)`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Gross profit margin on recognized revenue (delivered/invoiced orders). Target is 30% margin. Excludes service items and commissions.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
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
