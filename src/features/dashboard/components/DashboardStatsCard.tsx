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

import type { DashboardStat, DateRange } from '../types';
import { getIcon } from '../lib/icons';
import { STAT_DRILLDOWN } from '../lib/drilldown';
import { DrillDownButton } from './DrillDownButton';

// ============================================
// CALCULATION FORMULAS
// ============================================

/** Ankur's recognition rule (recognized-sales.service), shared by the revenue, units and margin cards */
// ERP texts of the old formulas (replaced by QuickBooks, Nov 6 2026):
// const RECOGNITION_RULE =
//   '\n\nRecognized when the order is delivered: delivery date = sales_orders.actual_delivery_date, else the delivered shipment arrival, else the order date for status Delivered.\nExcludes: commission-only orders (Galileo invoices the customer) and service lines (commission, handling).';
// ERP texts of the old formulas (replaced by QuickBooks, Nov 6 2026):
// const TIRE_SIZES =
//   '\n\nBreakdown by tire size:\n• 38" tires: rim_size = "38" or name contains "38"\n• 24" tires: rim_size = "24" or name contains "24"';

const CALCULATION_FORMULAS: Record<string, { title: string; formula: string; notes?: string }> = {
  'revenue-mtd': {
    title: 'Revenue (MTD) Calculation',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: `Revenue = Σ tire line totals of firm sales orders delivered from the 1st of this month to today − credit notes\n\nDatabase Sources:\n• Sales: sales_order_items.line_total (after line discount, excl. tax), tire products only\n• Returns: credit_notes.subtotal WHERE status IN ("issued", "applied"), by credit_note_date${RECOGNITION_RULE}`,
    // Before Nov 9 2026 (commission excluded):
    // formula: `Revenue = QuickBooks Profit and Loss (Cash basis), 1st of this month to the last sync: Total Income − income accounts named "commission" (tire sales)\n\nSource: QuickBooks snapshot (last QuickBooks sync)`,
    formula: `Revenue = QuickBooks Profit and Loss (Cash basis), 1st of this month to the last sync: Total Income (tire sales + commission income). Commission included per Ankur (Nov 7)\n\nSource: QuickBooks snapshot (last QuickBooks sync)`,
    notes: 'Month to date at the last QuickBooks sync. Always MTD: the date filter changes the charts, not this card. Compared to last month (QuickBooks P&L).',
  },
  'revenue-ytd': {
    title: 'Revenue (YTD) Calculation',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: `Revenue = Σ tire line totals of firm sales orders delivered Jan 1 to today − credit notes\n\nDatabase Sources:\n• Sales: sales_order_items.line_total (after line discount, excl. tax), tire products only\n• Returns: credit_notes.subtotal WHERE status IN ("issued", "applied"), by credit_note_date${RECOGNITION_RULE}`,
    // Before Nov 9 2026 (commission excluded):
    // formula: `Revenue = QuickBooks Profit and Loss (Cash basis), Jan 1 to the last sync: Total Income − income accounts named "commission" (tire sales)`,
    formula: `Revenue = QuickBooks Profit and Loss (Cash basis), Jan 1 to the last sync: Total Income (tire sales + commission income). Commission included per Ankur (Nov 7)`,
    notes: 'YTD at the last QuickBooks sync. Compared to the same period last year (QuickBooks P&L).',
  },
  'units-sold': {
    title: 'Units Sold (MTD) Calculation',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: `Units = Σ quantity of the same delivered tire lines used for Revenue (MTD: 1st of this month to today)${RECOGNITION_RULE}${TIRE_SIZES}`,
    formula: `Units = Σ Quantity of tire products in QuickBooks Sales by Product/Service Summary (Accrual), 1st of this month to the last sync\n\nProducts: QuickBooks item type Inventory or Non-inventory (any product, new ones included); Service items such as commission and fees are not units\n\nSize from the product name: (38") or R38 → 38", (24") or R24 → 24", any other size the same way`,
    notes: 'Tires Sold, Ankur\'s Definition 3.4, from QuickBooks invoices. Always MTD: the date filter changes the charts, not this card. Compared to last month.',
  },
  'units-sold-ytd': {
    title: 'Units Sold (YTD) Calculation',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: `Units = Σ quantity of the same delivered tire lines used for Revenue (Jan 1 to today)${RECOGNITION_RULE}${TIRE_SIZES}`,
    formula: `Units = Σ Quantity of tire products in QuickBooks Sales by Product/Service Summary (Accrual), Jan 1 to the last sync\n\nProducts: QuickBooks item type Inventory or Non-inventory; Service items are not units`,
    notes: 'Compared to the same period last year (YTD).',
  },
  'blended-margin': {
    title: 'Blended Margin (YTD) Calculation - Definition 3.2',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: `Gross Profit % = (Revenue − COGS) ÷ Revenue × 100\n\nWhere:\n• Revenue = the Revenue (YTD) figure\n• COGS = cost of the same delivered tires: line cost saved by the first fulfillment allocation, else the order cycle cost, else products.base_cost × quantity${RECOGNITION_RULE}`,
    // Before Nov 9 2026:
    // formula: `Gross Profit % = (Revenue − COGS) ÷ Revenue × 100\n\nWhere:\n• Revenue = the Revenue (YTD) figure (QuickBooks, commission excluded)\n• COGS = QuickBooks Profit and Loss Cost of Goods Sold, Jan 1 to the last sync`,
    formula: `Gross Profit % = (Revenue − COGS) ÷ Revenue × 100\n\nWhere:\n• Revenue = QuickBooks P&L tire sales, Jan 1 to the last sync (Total Income − commission accounts; the Revenue cards include commission since Nov 9, margin does not)\n• COGS = QuickBooks Profit and Loss Cost of Goods Sold, Jan 1 to the last sync`,
    notes: 'Ankur\'s Definition 3.2, from QuickBooks. Compared to last year YTD margin.',
  },
  'open-orders': {
    title: 'Open Orders Calculation',
    // Before Nov 6 2026:
    // formula: 'Count of sales orders with status IN ("confirmed", "processing")\n\nOrder Value = Sum of sales_orders.grand_total for those orders\nChange = vs the open orders already placed by the end of last month',
    // notes: 'All open sales orders (confirmed or processing), deleted orders excluded; commission-only orders are counted too. Does not filter by date.',
    // Before Nov 7 2026 (ERP only):
    // formula: 'Open Order = a confirmed sales order that is not invoiced yet (closed once it is invoiced), including pre-sold orders on containers not received yet\n\nOpen Orders = Count of sales orders with status IN ("confirmed", "processing")\nOrder Value = Sum of sales_orders.grand_total for those orders\nChange = vs the open orders already placed by the end of last month',
    // notes: 'Definition from Ankur (Nov 4 call: "confirmed, but not paid"; Nov 5 call: open sales orders "that have not been invoiced yet", closed "when they\'re invoiced"). Source today: ERP sales orders (deleted excluded; commission-only counted; no date filter). Ankur keeps open sales orders in QuickBooks too: this moves to QuickBooks once the QuickBooks transaction type is confirmed.',
    // Before Nov 9 2026 (QuickBooks only):
    // formula: 'Open Order = a confirmed sales order that is not invoiced yet (closed once it is invoiced)\n\nOpen Orders = Count of QuickBooks sales orders that are not closed / cancelled and not linked to an invoice\nOrder Value = Sum of their product / service lines (excl. tax)\nChange = vs the open orders already dated by the end of last month\n\nSource: QuickBooks only. If the sync could not read sales orders the card shows "—" and "Sync QuickBooks".',
    // notes: 'Definition from Ankur (Nov 4 call: "confirmed, but not paid"; Nov 5 call: "on QuickBooks under invoices, the open sales orders", "that have not been invoiced yet", closed "when they\'re invoiced"). Read from QuickBooks on each sync.',
    formula: 'Open Order = a confirmed sales order that is not invoiced yet (closed once it is invoiced)\n\nQuickBooks (preferred): Count of QuickBooks sales orders that are not closed / cancelled and not linked to an invoice; Order Value = Sum of their product / service lines (excl. tax)\n\nERP (for now, while QuickBooks sales orders cannot be read): Count of ERP sales orders with status IN ("confirmed", "processing"), commission-only orders excluded; Order Value = Sum of sales_orders.grand_total\n\nChange = vs the open orders already dated by the end of last month. The card says "ERP (for now)" when the ERP is used.',
    notes: 'Definition from Ankur (Nov 4 call: "confirmed, but not paid"; Nov 5 call: "on QuickBooks under invoices, the open sales orders", "that have not been invoiced yet", closed "when they\'re invoiced"). Nov 7 email: "If we cannot find it from there we can temporarily use from ERP although I prefer QuickBooks for this data." An ERP order leaves the count once it is marked Invoiced in the ERP.',
  },
  'commission-expected-ytd': {
    title: 'Commission Expected (YTD) Calculation',
    formula: 'Commission Expected = Commission Actual (YTD) + commission not billed yet\n\nNot billed yet: Σ sales_orders.commission_amount of commission-only orders (tires allocated Manufacturer Direct × rate per tire) that are delivered and not on a commission invoice (not draft/cancelled)\n\nCommission counts only after delivery',
    notes: 'Same figures as the Executive dashboard (Profitability › Commission). Compared to the same period last year (billed commission).',
  },
  'commission-actual-ytd': {
    title: 'Commission Actual (YTD) Calculation',
    // ERP formula (replaced by QuickBooks, Nov 6 2026):
    // formula: 'Commission Actual = Σ line totals of commission invoices to Galileo (not draft/cancelled)\n\nFiltered by: invoices.invoice_date (Jan 1 to today)\nInvoice type: Commission',
    formula: 'Commission Actual = QuickBooks Profit and Loss income accounts named "commission", Jan 1 to the last sync',
    notes: 'Commission billed to Galileo (kept out of tire revenue and margin). Same as Executive › Profitability › Commission Billed. Compared to the same period last year.',
  },
};

// ============================================
// TYPES
// ============================================

interface DashboardStatsCardProps {
  stat: DashboardStat;
  /** Overview date filter, for the download (drill-down) button */
  dateRange?: DateRange;
}

// ============================================
// COMPONENT
// ============================================

export function DashboardStatsCard({ stat, dateRange }: DashboardStatsCardProps) {
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
          {STAT_DRILLDOWN[stat.id] && (
            <DrillDownButton kind={STAT_DRILLDOWN[stat.id]!} dateRange={dateRange} label={stat.title} />
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
  dateRange?: DateRange;
}

export function DashboardStatsGrid({ stats, dateRange }: DashboardStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <DashboardStatsCard key={stat.id} stat={stat} dateRange={dateRange} />
      ))}
    </div>
  );
}
