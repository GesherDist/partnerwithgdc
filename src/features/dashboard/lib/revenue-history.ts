/**
 * Revenue history before the ERP (Oct 27 call: "map history to COA").
 *
 * The ERP has sales data from September 2026. For months before that the
 * Revenue Trend shows the QuickBooks P&L revenue of the month (accounts mapped
 * to Revenue in Settings > Chart of Accounts, commission accounts excluded),
 * from the daily QuickBooks snapshot. From this month on it shows ERP recognized tire revenue.
 *
 * Client-safe (no server imports).
 */

/** First month (YYYY-MM) whose revenue comes from the ERP */
export const ERP_REVENUE_START_MONTH = '2026-09';

export const ERP_REVENUE_START_LABEL = 'Sep 2026';

export type RevenueSource = 'erp' | 'quickbooks';

/** Where a month's revenue comes from (YYYY-MM) */
export function revenueSourceOf(monthKey: string): RevenueSource {
  return monthKey < ERP_REVENUE_START_MONTH ? 'quickbooks' : 'erp';
}
