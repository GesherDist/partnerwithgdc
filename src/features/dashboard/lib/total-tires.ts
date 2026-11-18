/**
 * Total Tires Sold (YTD) from the QuickBooks snapshot (Nov 18 2026)
 *
 * Ankur, Nov 10 ("Tires Sold"): show a total of tires sold INCLUDING the
 * commission tires, display only ("It shouldn't count towards any calculations
 * except just a total tires sold including commission tires"); the commission
 * tires are "in addition to the 687" direct units.
 *
 * A commission invoice is one Service line with qty 1, so the tire counts are
 * typed on the invoice in the QuickBooks custom fields Tires_38 / Tires_24.
 *
 *   Total = Units Sold (YTD) − tire lines of invoices whose fields are filled
 *           + Tires_38 + Tires_24 of those invoices
 *
 * The fields replace any tire lines on the same invoice (e.g. the $0 tire lines
 * Ankur added before), so nothing is counted twice. A commission invoice with
 * both fields blank is listed as "missing" and adds nothing.
 */

import type { QboPeriodFigures } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

export interface TotalTiresSold {
  /** Units Sold (YTD), QuickBooks Sales by Product/Service */
  unitsSold: number;
  /** Tire lines on invoices whose tire fields are filled (taken out, replaced by the fields) */
  replacedLines: number;
  /** Direct tires = unitsSold − replacedLines */
  direct: number;
  /** Tires_38 + Tires_24 */
  commission: number;
  total: number;
  /** Total by size, e.g. { '38': 1907, '24': 806 } */
  bySize: Record<string, number>;
  commissionBySize: { '38': number; '24': number };
  /** Invoices with a filled tire field */
  filledInvoices: number;
  /** Commission invoices with both tire fields blank */
  missing: Array<{ doc: string; customer: string; txnDate: string }>;
  /** Invoices with a tire field that is not a number (counted as blank) */
  badValues: number;
  /** A Tires_38 / Tires_24 field was seen in QuickBooks */
  fieldsFound: boolean;
  /** Why the commission tires are not included (direct tires only); null = read fine */
  readError: string | null;
  from: string;
  to: string;
}

// /** Null when the snapshot has no YTD units or no tire field read (sync QuickBooks) */
/**
 * Null only when the snapshot has no YTD units (sync QuickBooks). Without the tire
 * fields (not created / not filled in QuickBooks, an older snapshot, or the invoices
 * could not be read) the card still shows the direct tires, never an error.
 */
export function totalTiresSold(periods: QboPeriodFigures | null | undefined): TotalTiresSold | null {
  const units = periods?.units?.ytd;
  // const tires = periods?.commissionTires;
  // if (!units || !tires || tires.error) {
  //   return null;
  // }
  if (!units) {
    return null;
  }
  const read = periods?.commissionTires;
  const readError = !read ? 'not in this snapshot' : read.error ?? null;
  const tires = read && !read.error ? read : { invoices: [], fieldsFound: false, from: read?.from ?? '', to: read?.to ?? '' };
  const bySize: Record<string, number> = { ...units.bySize };
  const commissionBySize = { '38': 0, '24': 0 };
  let replacedLines = 0;
  let filledInvoices = 0;
  const missing: TotalTiresSold['missing'] = [];
  let badValues = 0;
  for (const inv of tires.invoices) {
    if (inv.notNumbers?.length) {
      badValues += 1;
    }
    const filled = inv.field38 !== null || inv.field24 !== null;
    if (!filled) {
      if (inv.isCommission) {
        missing.push({ doc: inv.doc, customer: inv.customer, txnDate: inv.txnDate });
      }
      continue;
    }
    filledInvoices += 1;
    for (const [size, qty] of Object.entries(inv.lineTires)) {
      replacedLines += qty;
      bySize[size] = (bySize[size] ?? 0) - qty;
    }
    commissionBySize['38'] += inv.field38 ?? 0;
    commissionBySize['24'] += inv.field24 ?? 0;
  }
  bySize['38'] = (bySize['38'] ?? 0) + commissionBySize['38'];
  bySize['24'] = (bySize['24'] ?? 0) + commissionBySize['24'];
  const commission = commissionBySize['38'] + commissionBySize['24'];
  const direct = units.total - replacedLines;
  return {
    unitsSold: units.total,
    replacedLines,
    direct,
    commission,
    total: direct + commission,
    bySize,
    commissionBySize,
    filledInvoices,
    missing,
    badValues,
    fieldsFound: tires.fieldsFound,
    readError,
    from: tires.from,
    to: tires.to,
  };
}
