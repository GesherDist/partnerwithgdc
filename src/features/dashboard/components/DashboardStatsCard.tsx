'use client';

/**
 * DashboardStatsCard Component
 *
 * Displays a single stat card with icon, value, and trend.
 */

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, Eye, X } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Button } from '@/shared/components/ui/button';

import type { DashboardStat } from '../types';
import { getIcon } from '../lib/icons';

// ============================================
// CALCULATION FORMULAS
// ============================================

const CALCULATION_FORMULAS: Record<string, { title: string; formula: string; notes?: string }> = {
  'revenue-mtd': {
    title: 'Revenue Calculation',
    formula: 'Revenue = Delivered Sales Orders - Returns/Credits\n\nDatabase Sources:\n• Gross Sales: sales_orders.grand_total WHERE status = "delivered" (all lines, incl. tax and shipping)\n• Returns: credit_notes.grand_total WHERE status IN ("issued", "applied"), by credit_note_date\n\nExcludes: commission-only orders (Galileo invoices the customer)\nFiltered by: order_date (Order Date) in the selected period',
    notes: 'Based on sales orders with status Delivered. Service lines on those orders (for example a Sales Commission line) are included. Amounts stored in cents.',
  },
  'revenue-ytd': {
    title: 'Revenue (YTD) Calculation',
    formula: 'Revenue = Delivered Sales Orders - Returns/Credits\n\nDatabase Sources:\n• Gross Sales: sales_orders.grand_total WHERE status = "delivered" (all lines, incl. tax and shipping)\n• Returns: credit_notes.grand_total WHERE status IN ("issued", "applied"), by credit_note_date\n\nExcludes: commission-only orders (Galileo invoices the customer)\nFiltered by: order_date (Jan 1 to today)',
    notes: 'Based on sales orders with status Delivered (YTD). Compared to same period last year.',
  },
  'units-sold': {
    title: 'Units Sold (MTD) Calculation',
    formula: 'Sum of quantity of all sales_order_items on the sales orders of INVOICED shipments in the period\n\nFiltered by: shipments.actual_arrival (Delivery Date)\nStatus: shipments.load_status = "invoiced"\nIncludes: every line of those orders (also service lines and commission-only orders)\n\nBreakdown by tire size:\n• 38" tires: Items where rim_size = "38" or name contains "38"\n• 24" tires: Items where rim_size = "24" or name contains "24"',
    notes: 'Only counts units on orders whose shipment is invoiced, not open orders.',
  },
  'units-sold-ytd': {
    title: 'Units Sold (YTD) Calculation',
    formula: 'Sum of quantity of all sales_order_items on the sales orders of INVOICED shipments from Jan 1 to today\n\nFiltered by: shipments.actual_arrival (Delivery Date)\nStatus: shipments.load_status = "invoiced"\nIncludes: every line of those orders (also service lines and commission-only orders)\n\nBreakdown by tire size:\n• 38" tires: Items where rim_size = "38" or name contains "38"\n• 24" tires: Items where rim_size = "24" or name contains "24"',
    notes: 'Compared to same period last year (YTD). Only counts units on orders whose shipment is invoiced.',
  },
  'blended-margin': {
    title: 'Blended Margin (YTD) Calculation - Definition 3.2',
    formula: 'Gross Profit % = (Gross Profit / Revenue) × 100\n\nWhere:\n• Revenue = sales_order_items.unit_price × quantity\n• COGS = line cost saved by the first fulfillment allocation, else the order cycle cost, else products.base_cost × quantity\n• Gross Profit = Revenue - COGS\n\nExcludes: Commission items (service items with "commission" in SKU/description) and commission-only orders\nFiltered by: sales orders of INVOICED shipments, shipments.actual_arrival Jan 1 to today',
    notes: 'As per Ankur\'s Definition 3.2. GP% on the orders of invoiced shipments. Compared to last year YTD margin.',
  },
  'open-orders': {
    title: 'Open Orders Calculation',
    formula: 'Count of sales orders with status IN ("confirmed", "processing")\n\nOrder Value = Sum of sales_orders.grand_total for those orders\nChange = vs the open orders already placed by the end of last month',
    notes: 'All open sales orders (confirmed or processing), deleted orders excluded; commission-only orders are counted too. Does not filter by date.',
  },
  'commission-expected-ytd': {
    title: 'Commission Expected (YTD) Calculation',
    formula: 'Sum of (unit_price × quantity) of commission lines on sales orders with status confirmed, processing, shipped or delivered\n\nFiltered by: sales_orders.order_date (Jan 1 to today)\n\nCommission Item Criteria:\n• item_type = "service"\n• SKU or description contains "commission"',
    notes: 'Commission lines only. The commission on commission-only orders (sales_orders.commission_amount) is not part of this card; see the Executive dashboard (Profitability › Commission).',
  },
  'commission-actual-ytd': {
    title: 'Commission Actual (YTD) Calculation',
    formula: 'Sum of (unit_price × quantity) of commission lines on sales orders with status Delivered\n\nFiltered by: sales_orders.order_date (Jan 1 to today)\n\nCommission Item Criteria:\n• item_type = "service"\n• SKU or description contains "commission"',
    notes: 'Commission lines on delivered sales orders only. Compared to the same period last year.',
  },
};

// ============================================
// TYPES
// ============================================

interface DashboardStatsCardProps {
  stat: DashboardStat;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardStatsCard({ stat }: DashboardStatsCardProps) {
  const Icon = getIcon(stat.icon);
  const isUp = stat.trend === 'up';
  const calculationInfo = CALCULATION_FORMULAS[stat.id];
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {stat.title}
          </CardTitle>
          {calculationInfo && (
            <Popover open={isOpen} onOpenChange={setIsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full hover:bg-accent"
                  aria-label="Show calculation details"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="start"
                className="w-[420px] p-0"
                sideOffset={8}
              >
                <div className="relative">
                  {/* Header */}
                  <div className="flex items-start justify-between border-b bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-md bg-primary/10 p-1.5">
                        <Eye className="h-4 w-4 text-primary" />
                      </div>
                      <h4 className="font-semibold text-sm leading-tight">
                        {calculationInfo.title}
                      </h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Body */}
                  <div className="space-y-3 px-4 py-3">
                    {/* Formula Section */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Calculation Formula
                      </p>
                      <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs leading-relaxed whitespace-pre-line border">
                        {calculationInfo.formula}
                      </div>
                    </div>

                    {/* Notes Section */}
                    {calculationInfo.notes && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Notes
                        </p>
                        <div className="flex gap-2">
                          <div className="mt-0.5 h-4 w-0.5 rounded-full bg-primary/40 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {calculationInfo.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className={`rounded-lg p-2 ${stat.color}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{stat.value}</div>
        {stat.subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {stat.subtitle}
          </div>
        )}
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isUp ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span className={isUp ? 'text-emerald-500' : 'text-red-500'}>
            {stat.change}
          </span>
          <span className="text-muted-foreground">from last month</span>
          {stat.target && (
            <>
              <span className="text-muted-foreground mx-1">|</span>
              <span className="text-muted-foreground">Target: {stat.target}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// STATS GRID COMPONENT
// ============================================

interface DashboardStatsGridProps {
  stats: DashboardStat[];
}

export function DashboardStatsGrid({ stats }: DashboardStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <DashboardStatsCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}
