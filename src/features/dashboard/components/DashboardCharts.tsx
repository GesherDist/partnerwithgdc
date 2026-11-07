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
  DateRange,
} from '../types';
import { DrillDownButton } from './DrillDownButton';
// ERP / QuickBooks split label (replaced: Revenue Trend is all QuickBooks, Nov 6 2026)
// import { ERP_REVENUE_START_LABEL } from '../lib/revenue-history';
import type { OverviewSection } from '../lib/dashboard-tabs';

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
  dateRange?: DateRange;
}

export function RevenueChart({ data, dateRange }: RevenueChartProps) {
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
                      {`Revenue = QuickBooks Profit & Loss (Cash basis) of the month
• Accounts mapped to Revenue in Settings > Chart of Accounts
• Commission accounts excluded (tire sales only)
• Current month: month to date at the last QuickBooks sync

Target: Monthly Revenue Target from Settings > Dashboard Targets (was $220,000 hardcoded)
Last Year: Same period previous year`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Monthly tire sales from QuickBooks (last sync) vs target.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <DrillDownButton kind="revenue-trend" dateRange={dateRange} label="Revenue Trend" />
        </div>
        <CardDescription>
          Monthly revenue vs target · QuickBooks P&L sales (commission excluded)
          {/* ERP / QuickBooks split (replaced by QuickBooks for every month, Nov 6 2026):
          {data.some((p) => p.source === 'quickbooks' || p.lastYearSource === 'quickbooks') &&
            ` · Before ${ERP_REVENUE_START_LABEL}: QuickBooks P&L sales (commission excluded)`} */}
        </CardDescription>
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
  dateRange?: DateRange;
}

export function UnitsBySKUChart({ data, products, dateRange }: UnitsBySKUChartProps) {
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
                      {/* Before Nov 7 2026 (ERP): Units = Sum of shipment_items.quantity_shipped, grouped by products.name and month of shipments.eta_to_port (ETA to US Port), item_type = 'inventory' only */}
                      {`Units = Tires sold per month, per product (QuickBooks)

Source:
• QuickBooks Sales by Product/Service Summary (Accrual), one report per month
• Quantity of each product item (QuickBooks type Inventory / Non-inventory)
• Grouped by: QuickBooks product name, month

Current month = 1st of the month to the last sync
Same products and rule as the Units Sold cards`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      {/* Before Nov 7 2026: Shows units arriving (inventory coming IN) by SKU per month based on shipment ETA to US port. Excludes service items. */}
                      <p className="text-xs text-muted-foreground leading-relaxed">Shows tires sold by SKU per month (Ankur&apos;s management KPI &quot;units by SKU&quot;). Service items (commission, fees) are excluded. Updated on each QuickBooks sync.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <DrillDownButton kind="units-by-sku" dateRange={dateRange} label="Units by SKU" />
        </div>
        {/* Before Nov 7 2026: <CardDescription>Shipment units by ETA to port</CardDescription> */}
        <CardDescription>Tires sold per month (QuickBooks)</CardDescription>
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
  dateRange?: DateRange;
}

export function ChannelPerformanceChart({ data, dateRange }: ChannelPerformanceChartProps) {
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
                      {/* Before Nov 7 2026 (ERP): Σ tire line totals of firm sales orders delivered in the period (sales_order_items.line_total, tire products only), grouped by customers.channel; recognized when delivered; commission-only orders and service lines excluded */}
                      {`Revenue by Channel = Σ QuickBooks tire sales by customer, grouped by channel

Source (QuickBooks, by transaction month):
• Revenue: product lines of invoices + sales receipts − credit memos (excl. tax)
• Units: quantity of the same lines
• Product lines = QuickBooks item type Inventory / Non-inventory (same as Units Sold); commission and other service items excluded

Channel:
1. QuickBooks Customer Type (OEM / Dealer)
2. else the ERP customer's channel, matched by name
3. else UNASSIGNED

Whole months of the date range (current month = to the last sync)`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      {/* Before Nov 7 2026: Recognized tire revenue by channel. OEM = Original Equipment Manufacturers, Dealer = Independent dealers. */}
                      <p className="text-xs text-muted-foreground leading-relaxed">QuickBooks tire sales by channel. OEM = Original Equipment Manufacturers, Dealer = Independent dealers. UNASSIGNED = customer with no OEM / Dealer type in QuickBooks and no matching ERP customer (or two ERP records with different channels).</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <DrillDownButton kind="channel" dateRange={dateRange} label="Channel Performance" />
        </div>
        {/* Before Nov 7 2026: <CardDescription>OEM vs Dealer breakdown</CardDescription> */}
        <CardDescription>OEM vs Dealer breakdown (QuickBooks)</CardDescription>
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
  dateRange?: DateRange;
}

export function MarginChart({ data, dateRange }: MarginChartProps) {
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

Where (QuickBooks Profit & Loss, Cash basis, per month):
• Revenue = accounts mapped to Revenue, commission accounts excluded
• COGS = accounts mapped to COGS
• Current month: month to date at the last QuickBooks sync

Target: Margin Target from Settings > Dashboard Targets (was 30% hardcoded)`}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">Gross profit margin per month from QuickBooks (last sync). Target line = Margin Target set in Settings.</p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <DrillDownButton kind="margin-analysis" dateRange={dateRange} label="Margin Analysis" />
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
              domain={[(min: number) => Math.min(20, Math.floor(min)), (max: number) => Math.max(40, Math.ceil(max))]}
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
  dateRange?: DateRange;
  /** Charts the user may see (one permission per chart); all when omitted */
  charts?: OverviewSection[];
}

export function DashboardChartsGrid({
  revenueData,
  unitsData,
  unitsProducts,
  channelData,
  marginData,
  dateRange,
  charts,
}: DashboardChartsGridProps) {
  const show = (chart: OverviewSection) => !charts || charts.includes(chart);
  if (!show('revenueTrend') && !show('unitsBySku') && !show('channel') && !show('margin')) {
    return null;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {show('revenueTrend') && <RevenueChart data={revenueData} dateRange={dateRange} />}
      {show('unitsBySku') && <UnitsBySKUChart data={unitsData} products={unitsProducts} dateRange={dateRange} />}
      {show('channel') && <ChannelPerformanceChart data={channelData} dateRange={dateRange} />}
      {show('margin') && <MarginChart data={marginData} dateRange={dateRange} />}
    </div>
  );
}
