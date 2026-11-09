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
  loadUnbilledDeliveredCommissionOrders,
  type RecognizedSaleLine,
  type RecognizedSales,
} from './recognized-sales.service';
import { getRevenueTrend } from '../repositories';
import type { DateRange, RevenueDataPoint } from '../types';
import type { CsvExport, OverviewDrillDown } from '../lib/drilldown';
import { getConnectionByProvider } from '@/modules/integrations/core';
import { erpChannelIndex, resolveChannel } from '../lib/channel';
import { getLatestSnapshot, type QboFinancials } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

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

  // Chart months come from the QuickBooks P&L (Nov 6 2026); the ERP rows below are for reference
  const sourceLabel = (source?: string) => (source === 'quickbooks' ? 'QuickBooks P&L' : 'ERP');
  const summary: Cell[][] = chart.map((p) => {
    const mine = years.map((_, i) => Math.round((byMonth[i]!.get(p.monthKey ?? '')?.total ?? 0) * 100) / 100);
    return [p.month, mine[0], p.revenue, sourceLabel(p.source), mine[1], p.lastYear ?? 0, sourceLabel(p.lastYearSource)];
  });
  const sum = (i: number) => summary.reduce((s, r) => s + Number(r[i] ?? 0), 0);
  summary.push(['TOTAL', Math.round(sum(1) * 100) / 100, sum(2), '', Math.round(sum(4) * 100) / 100, sum(5), '']);

  const sections = [
    section(
      `Revenue Trend by month: This year ${years[0]!.from} to ${years[0]!.to} · Last year ${years[1]!.from} to ${years[1]!.to} (chart values are rounded to whole dollars)`,
      ['Month', 'This Year (rows below)', 'This Year (chart)', 'This Year source', 'Last Year (rows below)', 'Last Year (chart)', 'Last Year source'],
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
  // Nov 9 2026: the card's ERP fallback leaves commission-only orders out
  let countedTotal = 0;
  let countedOrders = 0;
  const rows: Cell[][] = (data ?? []).map((so) => {
    const customer = (Array.isArray(so.customers) ? so.customers[0] : so.customers) as { name: string | null } | null;
    total += Number(so.grand_total ?? 0);
    if (so.is_commission_only !== true) {
      countedTotal += Number(so.grand_total ?? 0);
      countedOrders += 1;
    }
    return [so.order_number, customer?.name, so.customer_po_number, so.status, so.order_date, so.order_series, so.is_commission_only ? 'Yes' : 'No', dollars(Number(so.grand_total ?? 0))];
  });
  rows.push([`TOTAL (${(data ?? []).length} orders)`, '', '', '', '', '', '', dollars(total)]);
  rows.push([`TOTAL without commission-only (${countedOrders} orders): Open Orders card when QuickBooks has no sales orders`, '', '', '', '', '', '', dollars(countedTotal)]);
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
      ? loadUnbilledDeliveredCommissionOrders('order_number, customer_po_number, order_series, commission_rate, commission_amount, customers (name)')
          .then((data) => ({ data, error: null }), (error: Error) => ({ data: null, error }))
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

/** Latest QuickBooks snapshot (same as the dashboard cards); null when not connected / not synced */
async function loadQboSnapshot(): Promise<QboFinancials | null> {
  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return null;
  }
  return (await getLatestSnapshot(connection.external_account_id)).financials ?? null;
}

/** Two CSV blocks in one file: the dashboard's QuickBooks rows, then the ERP rows for reference */
const withErpReference = (qboCsv: string, erpTitle: string, erpCsv: string) =>
  `${qboCsv}\r\n\r\n${toCsv([erpTitle], [])}\r\n${erpCsv}`;

/** Open Orders card (Nov 7 2026): QuickBooks open sales orders; ERP open orders below for reference */
async function openOrdersQboCsv(): Promise<string> {
  const qso = (await loadQboSnapshot())?.periods?.openSalesOrders;
  const qboCsv = qso
    ? toCsv(
        ['Sales Order', 'Customer', 'Order Date', 'Ship / Due Date', 'QuickBooks Status', 'Tires', 'Amount (lines, excl. tax)'],
        [
          ...qso.orders.map((o) => [o.doc, o.customer, o.txnDate, o.expectedDate, o.status, o.quantity, o.amount] as Cell[]),
          [`TOTAL (${qso.count} orders)`, '', '', '', '', qso.tires, qso.total],
        ]
      )
    : // Before Nov 9 2026: toCsv(['QuickBooks open sales orders are not in the latest snapshot: sync QuickBooks (the card shows "—")'], []);
      toCsv(['QuickBooks open sales orders are not in the latest snapshot: the card uses the ERP open orders below for now (commission-only orders not counted)'], []);
  // Before Nov 9 2026: return withErpReference(qboCsv, 'ERP sales orders (confirmed / processing), for reference only — not used by the card', await openOrdersCsv());
  return withErpReference(
    qboCsv,
    qso
      ? 'ERP sales orders (confirmed / processing), for reference only — not used by the card'
      : 'ERP sales orders (confirmed / processing): used by the card for now (Ankur, Nov 7), commission-only orders not counted',
    await openOrdersCsv()
  );
}

/** Units by SKU chart (Nov 7 2026): QuickBooks tires sold per month by product; ERP incoming shipments below for reference */
async function unitsBySkuQboCsv(from: string, to: string): Promise<string> {
  const months = ((await loadQboSnapshot())?.unitsByMonth ?? []).filter((m) => m.month >= from.slice(0, 7) && m.month <= to.slice(0, 7));
  let total = 0;
  const rows: Cell[][] = [];
  for (const m of months) {
    for (const item of m.items) {
      total += item.quantity;
      rows.push([m.month, `${m.month}-01 to ${m.to}`, item.name, item.size, item.quantity, item.amount]);
    }
  }
  rows.push(['TOTAL', '', '', '', total, '']);
  const qboCsv = months.length
    ? toCsv(['Month', 'Period Read', 'QuickBooks Product', 'Size', 'Units Sold', 'Sales Amount'], rows)
    : toCsv(['QuickBooks units by month are not in the latest snapshot: sync QuickBooks'], []);
  return withErpReference(qboCsv, 'ERP incoming shipments by ETA to US port (the old chart), for reference only', await unitsBySkuCsv(from, to));
}

/** Channel Performance chart (Nov 7 2026): QuickBooks tire sales by customer and channel; ERP rows below for reference */
async function channelQboCsv(from: string, to: string): Promise<string> {
  const months = ((await loadQboSnapshot())?.salesByCustomerMonth ?? []).filter((m) => m.month >= from.slice(0, 7) && m.month <= to.slice(0, 7));
  const { data: erpCustomers } = await db.from('customers').select('name, channel').is('deleted_at', null);
  const erpIndex = erpChannelIndex((erpCustomers ?? []) as Array<{ name: string | null; channel: string | null }>);
  const totals = new Map<string, { revenue: number; units: number }>();
  const rows: Cell[][] = [];
  for (const m of months) {
    for (const c of m.customers) {
      const { channel, source } = resolveChannel(c.customer, c.customerType, erpIndex);
      const t = totals.get(channel) ?? { revenue: 0, units: 0 };
      t.revenue += c.amount;
      t.units += c.units;
      totals.set(channel, t);
      rows.push([channel.toUpperCase(), source, m.month, c.customer, c.customerType ?? '', c.units, c.amount]);
    }
  }
  for (const [channel, t] of totals) {
    rows.push([`TOTAL ${channel.toUpperCase()}`, '', '', '', '', t.units, Math.round(t.revenue * 100) / 100]);
  }
  const qboCsv = months.length
    ? toCsv(['Channel', 'Channel From', 'Month', 'QuickBooks Customer', 'QuickBooks Customer Type', 'Units', 'Revenue (product lines, excl. tax)'], rows)
    : toCsv(['QuickBooks sales by customer are not in the latest snapshot: sync QuickBooks'], []);
  return withErpReference(qboCsv, 'ERP delivered tire lines by channel (the old chart), for reference only', channelCsv(await loadRecognizedSales(), from, to));
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

/** Cards / charts whose value comes from the QuickBooks P&L (Nov 6 2026); their ERP rows are for reference */
const QBO_NOTE: Partial<Record<OverviewDrillDown, string>> = {
  // Before Nov 9 2026 (commission excluded):
  // 'revenue-period': 'Dashboard value = QuickBooks P&L tire sales (Total Income − commission accounts), last sync. ERP delivered tire lines below are for reference.',
  // 'revenue-ytd': 'Dashboard value = QuickBooks P&L tire sales (Total Income − commission accounts), last sync. ERP delivered tire lines below are for reference.',
  'revenue-period': 'Dashboard value = QuickBooks P&L Total Income (tire sales + commission income), last sync. ERP delivered tire lines below (tires only) are for reference.',
  'revenue-ytd': 'Dashboard value = QuickBooks P&L Total Income (tire sales + commission income), last sync. ERP delivered tire lines below (tires only) are for reference.',
  'units-period': 'Dashboard value = QuickBooks Sales by Product/Service Summary, tire products quantity, last sync. ERP delivered tire lines below are for reference.',
  'units-ytd': 'Dashboard value = QuickBooks Sales by Product/Service Summary, tire products quantity, last sync. ERP delivered tire lines below are for reference.',
  'blended-margin': 'Dashboard value = (QuickBooks P&L tire sales − COGS) ÷ tire sales, last sync. ERP delivered tire lines below are for reference.',
  'commission-actual': 'Commission Actual = QuickBooks P&L commission income accounts, last sync. ERP commission invoices below are for reference.',
  'commission-expected': 'Commission Actual part = QuickBooks P&L commission income accounts, last sync. ERP commission invoices below are for reference.',
  'margin-analysis': 'Chart = QuickBooks P&L tire sales and COGS per month, last sync. ERP delivered tire lines below are for reference.',
  // Before Nov 9 2026: 'open-orders': 'Open Orders = QuickBooks open sales orders (not closed / cancelled, not linked to an invoice), last sync. ERP sales orders below are for reference only.',
  'open-orders': 'Open Orders = QuickBooks open sales orders (not closed / cancelled, not linked to an invoice), last sync. When QuickBooks has none, the card uses the ERP open orders below for now (commission-only not counted).',
  'units-by-sku': 'Chart = QuickBooks Sales by Product/Service Summary, tires sold per month by product, last sync. ERP incoming shipments below are for reference only.',
  channel: 'Chart = QuickBooks tire sales by customer (invoices + sales receipts − credit memos, product lines), channel from QuickBooks Customer Type, else ERP customer by name, else UNASSIGNED; last sync. ERP rows below are for reference only.',
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
      // Before Nov 7 2026: csv = await openOrdersCsv();
      csv = await openOrdersQboCsv();
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
      // Before Nov 7 2026: csv = await unitsBySkuCsv(span.from, span.to);
      csv = await unitsBySkuQboCsv(span.from, span.to);
      break;
    case 'channel':
      span = r.chart;
      // Before Nov 7 2026: csv = channelCsv(await loadRecognizedSales(), span.from, span.to);
      csv = await channelQboCsv(span.from, span.to);
      break;
    case 'margin-analysis':
      span = r.chart;
      csv = marginCsv(await loadRecognizedSales(), span.from, span.to);
      break;
  }

  const note = QBO_NOTE[kind];
  if (note) {
    csv = toCsv([note], []) + '\r\n\r\n' + csv;
  }

  const suffix = span ? `${span.from}-to-${span.to}` : formatDateString(new Date());
  return { filename: `${LABELS[kind]}-${suffix}.csv`, csv };
}
