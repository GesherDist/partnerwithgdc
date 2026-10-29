/**
 * Overview drill-downs (Ankur, Oct 27 call): the download button next to each
 * KPI card / chart exports the rows behind its number as CSV, so the figure can
 * be checked order by order.
 *
 * Each export uses the same data and date range as its calculation
 * (recognized-sales.service, getDashboardStats, the chart queries); the last
 * row is the TOTAL shown on the card. Money is exported in dollars.
 */

import { db } from '@/shared/lib/supabase/database';
import {
  loadRecognizedSales,
  type RecognizedSaleLine,
  type RecognizedSales,
} from './recognized-sales.service';
import { getRevenueTrend } from '../repositories';
import type { DateRange, RevenueDataPoint } from '../types';
import type { CsvExport, OverviewDrillDown } from '../lib/drilldown';

export type Cell = string | number | null | undefined;

// Same local-date helper as the dashboard repository
function formatDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const dollars = (cents: number) => Math.round(cents) / 100;

export function toCsv(columns: string[], rows: Cell[][]): string {
  const escape = (value: Cell) => {
    if (value === null || value === undefined) {
      return '';
    }
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}

/** Periods used by getDashboardStats (cards: MTD + YTD) and the charts (date filter) */
function ranges(dateRange?: DateRange) {
  const now = new Date();
  const today = formatDateString(now);
  const period = { from: formatDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
  const ytd = { from: `${now.getFullYear()}-01-01`, to: today };
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() - 5);
  sixMonths.setDate(1);
  const chart = dateRange ? { from: dateRange.startDate, to: dateRange.endDate } : { from: formatDateString(sixMonths), to: today };
  return { period, ytd, chart };
}

const tireLinesIn = (sales: RecognizedSales, from: string, to: string) =>
  sales.lines
    .filter((l) => l.isTire && l.date >= from && l.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.orderNumber.localeCompare(b.orderNumber));
const creditsIn = (sales: RecognizedSales, from: string, to: string) =>
  sales.credits.filter((c) => c.date >= from && c.date <= to).sort((a, b) => a.date.localeCompare(b.date));

// ---------- recognized revenue / units / margin ----------

function revenueCsv(sales: RecognizedSales, from: string, to: string, label?: string): { columns: string[]; rows: Cell[][]; total: number } {
  const columns = [
    ...(label ? ['Period'] : []),
    'Type', 'Delivery Date', 'SO #', 'Customer', 'Customer PO', 'Order Series', 'SKU', 'Product', 'Qty', 'Unit Price', 'Line Total',
  ];
  let total = 0;
  const rows: Cell[][] = [];
  for (const l of tireLinesIn(sales, from, to)) {
    total += l.lineTotal;
    rows.push([
      ...(label ? [label] : []),
      'Sale', l.date, l.orderNumber, l.customerName, l.customerPoNumber, l.orderSeries, l.sku, l.productName, l.quantity, dollars(l.unitPrice), dollars(l.lineTotal),
    ]);
  }
  for (const c of creditsIn(sales, from, to)) {
    total -= c.amount;
    rows.push([...(label ? [label] : []), 'Credit note', c.date, c.number, c.customerName, '', '', '', '', '', '', -dollars(c.amount)]);
  }
  return { columns, rows, total };
}

/**
 * Revenue Trend: one row per chart month (this year / last year), then each
 * month's lines with TOTAL and the chart value. Sections are separated by a
 * blank line, a title row and a header row (same layout as the executive exports).
 */
async function revenueTrendCsv(span: { from: string; to: string }, dateRange?: DateRange): Promise<string> {
  const [sales, chart] = await Promise.all([loadRecognizedSales(), getRevenueTrend(dateRange)]);
  const shiftYear = (iso: string, years: number) => `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;
  // shift: years added to a line's date to find its chart month (last year's June sits under this year's June)
  const years = [
    { label: 'This year', from: span.from, to: span.to, shift: 0, pick: (p: RevenueDataPoint) => p.revenue },
    { label: 'Last year', from: shiftYear(span.from, -1), to: shiftYear(span.to, -1), shift: 1, pick: (p: RevenueDataPoint) => p.lastYear ?? 0 },
  ];
  const section = (title: string, columns: string[], rows: Cell[][]) => toCsv([title], []) + '\r\n' + toCsv(columns, rows);

  // Lines of each year grouped by chart month (YYYY-MM, same buckets as getRevenueTrend)
  const byMonth = years.map((y) => {
    const out = revenueCsv(sales, y.from, y.to);
    const months = new Map<string, { rows: Cell[][]; total: number }>();
    out.rows.forEach((row) => {
      const month = shiftYear(String(row[1]), y.shift).slice(0, 7);
      const m = months.get(month) ?? { rows: [], total: 0 };
      m.rows.push(row);
      m.total += Number(row[row.length - 1] ?? 0);
      months.set(month, m);
    });
    return months;
  });

  const summary: Cell[][] = chart.map((p) => {
    const mine = years.map((_, i) => Math.round((byMonth[i]!.get(p.monthKey ?? '')?.total ?? 0) * 100) / 100);
    return [p.month, mine[0], p.revenue, mine[1], p.lastYear ?? 0];
  });
  const sum = (i: number) => summary.reduce((s, r) => s + Number(r[i] ?? 0), 0);
  summary.push(['TOTAL', Math.round(sum(1) * 100) / 100, sum(2), Math.round(sum(3) * 100) / 100, sum(4)]);

  const sections = [
    section(
      `Revenue Trend by month: This year ${years[0]!.from} to ${years[0]!.to} · Last year ${years[1]!.from} to ${years[1]!.to} (chart values are rounded to whole dollars)`,
      ['Month', 'This Year (rows below)', 'This Year (chart)', 'Last Year (rows below)', 'Last Year (chart)'],
      summary
    ),
  ];
  const lineColumns = revenueCsv(sales, span.from, span.from).columns;
  for (const p of chart) {
    years.forEach((y, i) => {
      const m = byMonth[i]!.get(p.monthKey ?? '');
      if (!m && y.pick(p) === 0) {
        return;
      }
      const blank = lineColumns.slice(2).map(() => '');
      sections.push(
        section(`${p.month} – ${y.label} (${shiftYear(`${p.monthKey}-01`, -y.shift).slice(0, 7)}): delivered tire lines − credit notes`, lineColumns, [
          ...(m?.rows ?? []),
          ['TOTAL', ...blank, Math.round((m?.total ?? 0) * 100) / 100],
          ['Dashboard (chart)', ...blank, y.pick(p)],
        ])
      );
    });
  }
  return sections.join('\r\n\r\n');
}

function unitsCsv(sales: RecognizedSales, from: string, to: string): CsvExport['csv'] {
  const lines = tireLinesIn(sales, from, to);
  const sum = (filter: (l: RecognizedSaleLine) => boolean) => lines.filter(filter).reduce((s, l) => s + l.quantity, 0);
  const rows: Cell[][] = lines.map((l) => [l.date, l.orderNumber, l.customerName, l.customerPoNumber, l.orderSeries, l.sku, l.productName, l.tireSize === 'other' ? '' : `${l.tireSize}"`, l.quantity]);
  rows.push(['TOTAL 38"', '', '', '', '', '', '', '', sum((l) => l.tireSize === '38')]);
  rows.push(['TOTAL 24"', '', '', '', '', '', '', '', sum((l) => l.tireSize === '24')]);
  rows.push(['TOTAL', '', '', '', '', '', '', '', sum(() => true)]);
  return toCsv(['Delivery Date', 'SO #', 'Customer', 'Customer PO', 'Order Series', 'SKU', 'Product', 'Size', 'Qty'], rows);
}

const COST_SOURCE: Record<RecognizedSaleLine['costSource'], string> = {
  saved: 'Saved on line (first allocation)',
  cycle: 'Order cycle cost',
  base: 'Base cost',
  none: 'No cost entered',
};

function marginCsv(sales: RecognizedSales, from: string, to: string): string {
  let revenue = 0;
  let cogs = 0;
  const rows: Cell[][] = [];
  for (const l of tireLinesIn(sales, from, to)) {
    const cost = l.cost ?? 0;
    revenue += l.lineTotal;
    cogs += cost;
    const gp = l.lineTotal - cost;
    rows.push([
      'Sale', l.date, l.orderNumber, l.customerName, l.orderSeries, l.sku, l.quantity, dollars(l.unitPrice), dollars(l.lineTotal),
      dollars(l.unitCost), COST_SOURCE[l.costSource], dollars(cost), dollars(gp), l.lineTotal ? Math.round((gp / l.lineTotal) * 1000) / 10 : '',
    ]);
  }
  for (const c of creditsIn(sales, from, to)) {
    revenue -= c.amount;
    rows.push(['Credit note', c.date, c.number, c.customerName, '', '', '', '', -dollars(c.amount), '', '', '', -dollars(c.amount), '']);
  }
  const gp = revenue - cogs;
  rows.push(['TOTAL', '', '', '', '', '', '', '', dollars(revenue), '', '', dollars(cogs), dollars(gp), revenue ? Math.round((gp / revenue) * 1000) / 10 : '']);
  return toCsv(
    ['Type', 'Delivery Date', 'SO #', 'Customer', 'Order Series', 'SKU', 'Qty', 'Unit Price', 'Revenue', 'Cost per Tire', 'Cost Source', 'COGS', 'Gross Profit', 'GP %'],
    rows
  );
}

// ---------- open orders / commission / incoming units ----------

async function openOrdersCsv(): Promise<string> {
  const { data, error } = await db
    .from('sales_orders')
    .select('order_number, order_date, status, order_series, customer_po_number, is_commission_only, grand_total, customers (name)')
    .in('status', ['confirmed', 'processing'])
    .is('deleted_at', null)
    .order('order_date', { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  let total = 0;
  const rows: Cell[][] = (data ?? []).map((so) => {
    const customer = (Array.isArray(so.customers) ? so.customers[0] : so.customers) as { name: string | null } | null;
    total += Number(so.grand_total ?? 0);
    return [so.order_number, customer?.name, so.customer_po_number, so.status, so.order_date, so.order_series, so.is_commission_only ? 'Yes' : 'No', dollars(Number(so.grand_total ?? 0))];
  });
  rows.push([`TOTAL (${(data ?? []).length} orders)`, '', '', '', '', '', '', dollars(total)]);
  return toCsv(['SO #', 'Customer', 'Customer PO', 'Status', 'Order Date', 'Order Series', 'Commission Only', 'Grand Total'], rows);
}

async function commissionCsv(withUnbilled: boolean, ytd: { from: string; to: string }): Promise<string> {
  const [invoicesRes, unbilledRes] = await Promise.all([
    db
      .from('invoices')
      .select('invoice_number, invoice_date, status, invoice_items (description, line_total)')
      .eq('invoice_type', 'commission')
      .not('status', 'in', '(draft,cancelled)')
      .is('deleted_at', null)
      .gte('invoice_date', ytd.from)
      .lte('invoice_date', ytd.to)
      .order('invoice_date', { ascending: true }),
    withUnbilled
      ? db
          .from('sales_orders')
          .select('order_number, customer_po_number, order_series, status, commission_rate, commission_amount, customers (name)')
          .eq('is_commission_only', true)
          .is('commission_invoice_id', null)
          .is('deleted_at', null)
          .not('status', 'in', '(draft,cancelled)')
          .gt('commission_amount', 0)
          .order('order_number', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (invoicesRes.error) {
    throw new Error(invoicesRes.error.message);
  }
  if (unbilledRes.error) {
    throw new Error(unbilledRes.error.message);
  }

  let total = 0;
  const rows: Cell[][] = [];
  for (const inv of invoicesRes.data ?? []) {
    for (const item of (inv.invoice_items ?? []) as Array<{ description: string | null; line_total: number | null }>) {
      const amount = Number(item.line_total ?? 0);
      total += amount;
      rows.push(['Billed', inv.invoice_number, inv.invoice_date, inv.status, '', item.description, '', '', '', dollars(amount)]);
    }
  }
  type UnbilledOrder = { order_number: string; customer_po_number: string | null; order_series: string | null; status: string; commission_rate: number | null; commission_amount: number | null; customers: { name: string | null } | { name: string | null }[] | null };
  for (const so of (unbilledRes.data ?? []) as unknown as UnbilledOrder[]) {
    const customer = (Array.isArray(so.customers) ? so.customers[0] : so.customers) as { name: string | null } | null;
    const amount = Number(so.commission_amount ?? 0);
    const rate = Number(so.commission_rate ?? 0);
    total += amount;
    rows.push(['Not billed yet', so.order_number, '', so.status, so.customer_po_number, customer?.name, so.order_series, rate > 0 ? Math.round(amount / rate) : '', dollars(rate), dollars(amount)]);
  }
  rows.push(['TOTAL', '', '', '', '', '', '', '', '', dollars(total)]);
  return toCsv(['Type', 'Invoice / SO #', 'Invoice Date', 'Status', 'Customer PO', 'Description / Customer', 'Order Series', 'Tires', 'Rate', 'Commission'], rows);
}

async function unitsBySkuCsv(from: string, to: string): Promise<string> {
  const { data, error } = await db
    .from('shipment_items')
    .select('quantity_shipped, sku, shipments!inner (shipment_number, container_number, eta_to_port, status, deleted_at), products!inner (sku, name, item_type)')
    .gte('shipments.eta_to_port', from)
    .lte('shipments.eta_to_port', to)
    .is('shipments.deleted_at', null)
    .eq('products.item_type', 'inventory');
  if (error) {
    throw new Error(error.message);
  }
  let total = 0;
  const rows: Cell[][] = (data ?? [])
    .map((item) => {
      const shipment = (Array.isArray(item.shipments) ? item.shipments[0] : item.shipments) as { shipment_number?: string | null; container_number?: string | null; eta_to_port?: string | null; status?: string | null } | null;
      const product = (Array.isArray(item.products) ? item.products[0] : item.products) as { sku: string; name: string } | null;
      total += Number(item.quantity_shipped ?? 0);
      return [shipment?.eta_to_port, shipment?.shipment_number, shipment?.container_number, shipment?.status, product?.sku ?? item.sku, product?.name, Number(item.quantity_shipped ?? 0)] as Cell[];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  rows.push(['TOTAL', '', '', '', '', '', total]);
  return toCsv(['ETA to US Port', 'Shipment #', 'Container', 'Status', 'SKU', 'Product', 'Units'], rows);
}

function channelCsv(sales: RecognizedSales, from: string, to: string): string {
  const lines = tireLinesIn(sales, from, to);
  const totals = new Map<string, { revenue: number; units: number }>();
  const rows: Cell[][] = lines.map((l) => {
    const channel = (l.customerChannel || 'dealer').toUpperCase();
    const t = totals.get(channel) ?? { revenue: 0, units: 0 };
    t.revenue += l.lineTotal;
    t.units += l.quantity;
    totals.set(channel, t);
    return [channel, l.date, l.orderNumber, l.customerName, l.sku, l.quantity, dollars(l.lineTotal)];
  });
  for (const [channel, t] of totals) {
    rows.push([`TOTAL ${channel}`, '', '', '', '', t.units, dollars(t.revenue)]);
  }
  return toCsv(['Channel', 'Delivery Date', 'SO #', 'Customer', 'SKU', 'Qty', 'Revenue'], rows);
}

// ---------- entry point ----------

const LABELS: Record<OverviewDrillDown, string> = {
  'revenue-period': 'revenue',
  'revenue-ytd': 'revenue-ytd',
  'units-period': 'units-sold',
  'units-ytd': 'units-sold-ytd',
  'blended-margin': 'blended-margin-ytd',
  'open-orders': 'open-orders',
  'commission-expected': 'commission-expected-ytd',
  'commission-actual': 'commission-actual-ytd',
  'revenue-trend': 'revenue-trend',
  'units-by-sku': 'units-by-sku',
  channel: 'channel-performance',
  'margin-analysis': 'margin-analysis',
};

export async function buildOverviewDrillDown(kind: OverviewDrillDown, dateRange?: DateRange): Promise<CsvExport> {
  const r = ranges(dateRange);
  let csv: string;
  let span: { from: string; to: string } | null;

  switch (kind) {
    case 'revenue-period':
    case 'revenue-ytd': {
      span = kind === 'revenue-ytd' ? r.ytd : r.period;
      const out = revenueCsv(await loadRecognizedSales(), span.from, span.to);
      csv = toCsv(out.columns, [...out.rows, ['TOTAL', '', '', '', '', '', '', '', '', '', dollars(out.total)]]);
      break;
    }
    case 'units-period':
    case 'units-ytd':
      span = kind === 'units-ytd' ? r.ytd : r.period;
      csv = unitsCsv(await loadRecognizedSales(), span.from, span.to);
      break;
    case 'blended-margin':
      span = r.ytd;
      csv = marginCsv(await loadRecognizedSales(), span.from, span.to);
      break;
    case 'open-orders':
      span = null;
      csv = await openOrdersCsv();
      break;
    case 'commission-expected':
    case 'commission-actual':
      span = r.ytd;
      csv = await commissionCsv(kind === 'commission-expected', r.ytd);
      break;
    case 'revenue-trend':
      span = r.chart;
      csv = await revenueTrendCsv(span, dateRange);
      break;
    case 'units-by-sku':
      span = r.chart;
      csv = await unitsBySkuCsv(span.from, span.to);
      break;
    case 'channel':
      span = r.chart;
      csv = channelCsv(await loadRecognizedSales(), span.from, span.to);
      break;
    case 'margin-analysis':
      span = r.chart;
      csv = marginCsv(await loadRecognizedSales(), span.from, span.to);
      break;
  }

  const suffix = span ? `${span.from}-to-${span.to}` : formatDateString(new Date());
  return { filename: `${LABELS[kind]}-${suffix}.csv`, csv };
}
