/**
 * Executive dashboard — ERP figures (Ankur's spec, Oct 12 call decisions)
 *
 * Recognition rule: revenue, COGS and tire units come from the same
 * population — recognized customer invoices (not draft/cancelled) by invoice
 * date, tire lines only (product item_type 'inventory'). Credit notes
 * (issued/applied) reduce revenue on their credit-note date.
 *
 * COGS: FIFO from the tires' purchase cost. Each product's cost layers are
 * its PO lines (not draft/cancelled) in PO date order; invoiced tires consume
 * them oldest first, then the open backlog.
 * NOT ACTIVE YET (Oct 15, 2026): PO unit prices in the ERP are the customer
 * sales prices copied onto the PO, not Galileo's purchase cost, and
 * products.base_cost is mostly empty. Until the real purchase cost is
 * recorded, COGS is reported as unavailable (null) instead of a wrong margin.
 * Turn PURCHASE_COST_AVAILABLE on once PO lines carry the real cost.
 *
 * Money in the database is in cents; this service returns dollars.
 */

import { db } from '@/shared/lib/supabase/database';
import {
  addDays,
  businessToday,
  daysBetween,
  getPeriods,
  inRange,
  monthEnd,
  monthStart,
  type DateRange,
  type PeriodKey,
} from '../lib/periods';

// ============================================
// TYPES
// ============================================

export interface SalesFigures {
  revenue: number;
  units: number;
  /** null when no purchase cost exists at all for the tires sold */
  cogs: number | null;
  /** false when some tires had no PO cost layer left (last known price used) */
  cogsComplete: boolean;
}

export interface SupplyCycle {
  cycle: string;
  tiresOrdered: number;
  arrivalStart: string | null;
  arrivalEnd: string | null;
  weeksLeft: number | null;
  sold: number;
  unsold: number;
  forwardCommitPct: number | null;
  actualWeeklyVelocity: number;
  requiredWeeklyVelocity: number | null;
  velocityGap: number | null;
  projectedUncommitted: number | null;
}

export interface ErpExecutiveFigures {
  asOf: string;
  periods: Record<PeriodKey, DateRange>;
  sales: Record<PeriodKey, SalesFigures>;
  /** All recognized invoice sales (incl. non-tire lines) less credits — DSO denominator */
  creditSales: Record<PeriodKey, number>;
  /** Purchase order totals by PO date — DPO denominator */
  purchases: Record<PeriodKey, number>;
  backlog: { tires: number; revenue: number; cogs: number | null; cogsComplete: boolean };
  supply: SupplyCycle[];
  inventory: {
    tiresOnHand: number;
    allocated: number;
    uncommitted: number;
    /** Average monthly tires sold over the 3 most recent completed months */
    t3mMonthlyTires: number;
    monthsOfSupply: number | null;
  };
}

interface InvoiceLine {
  date: string;
  order: string;
  productId: string | null;
  salesOrderItemId: string | null;
  quantity: number;
  lineTotal: number;
  isTire: boolean;
}

// ============================================
// FIFO
// ============================================

class FifoCost {
  private layers = new Map<string, Array<{ qty: number; cost: number }>>();
  private lastCost = new Map<string, number>();

  addLayer(productId: string, qty: number, unitCost: number) {
    if (qty <= 0) {
      return;
    }
    const list = this.layers.get(productId) ?? [];
    list.push({ qty, cost: unitCost });
    this.layers.set(productId, list);
    this.lastCost.set(productId, unitCost);
  }

  /** Cost (cents) of taking `qty` units, oldest layers first */
  take(productId: string, qty: number): { cost: number | null; complete: boolean } {
    const list = this.layers.get(productId) ?? [];
    let remaining = qty;
    let cost = 0;
    while (remaining > 0 && list.length > 0) {
      const layer = list[0]!;
      const used = Math.min(layer.qty, remaining);
      cost += used * layer.cost;
      layer.qty -= used;
      remaining -= used;
      if (layer.qty === 0) {
        list.shift();
      }
    }
    if (remaining === 0) {
      return { cost, complete: true };
    }
    // Sold more than was purchased: value the rest at the last known price
    const last = this.lastCost.get(productId);
    return last === undefined ? { cost: cost > 0 ? cost : null, complete: false } : { cost: cost + remaining * last, complete: false };
  }
}

// ============================================
// BUILD
// ============================================

const NOT_RECOGNIZED = ['draft', 'cancelled'];
const OPEN_PO_EXCLUDED = ['draft', 'cancelled'];
const BACKLOG_SO_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];
const cents = (n: number) => Math.round(n) / 100;
/** See the header: PO unit prices are sales prices today, so COGS stays unavailable */
const PURCHASE_COST_AVAILABLE = false;

export async function buildErpExecutiveFigures(asOf: string = businessToday()): Promise<ErpExecutiveFigures> {
  const periods = getPeriods(asOf);
  const keys = Object.keys(periods) as PeriodKey[];

  const [productsRes, invoicesRes, creditsRes, poRes, soRes, shipmentsRes, inventoryRes] = await Promise.all([
    db.from('products').select('id, item_type'),
    db
      .from('invoices')
      .select('invoice_number, invoice_date, status, invoice_type, invoice_items(product_id, sales_order_item_id, quantity, line_total)')
      .is('deleted_at', null)
      .not('status', 'in', `(${NOT_RECOGNIZED.join(',')})`)
      .lte('invoice_date', asOf),
    db.from('credit_notes').select('credit_note_date, status, subtotal').in('status', ['issued', 'applied']),
    db
      .from('purchase_orders')
      .select('id, po_number, po_date, status, order_series, expected_delivery_date, confirmed_eta, purchase_order_items(product_id, quantity_ordered, unit_price, line_total)')
      .is('deleted_at', null)
      .not('status', 'in', `(${OPEN_PO_EXCLUDED.join(',')})`),
    db
      .from('sales_orders')
      .select('order_number, order_date, status, order_series, sales_order_items(id, product_id, quantity, customer_qty, line_total)')
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)'),
    db.from('shipments').select('purchase_order_id, eta_port_tracking, confirmed_eta, eta_to_port, estimated_arrival').is('deleted_at', null),
    db.from('inventory').select('product_id, on_hand, allocated'),
  ]);
  for (const r of [productsRes, invoicesRes, creditsRes, poRes, soRes, shipmentsRes, inventoryRes]) {
    if (r.error) {
      throw new Error(`Executive dashboard query failed: ${r.error.message}`);
    }
  }

  const tireIds = new Set((productsRes.data ?? []).filter((p) => p.item_type === 'inventory').map((p) => String(p.id)));

  // ---------- invoice lines (recognized) ----------
  const lines: InvoiceLine[] = [];
  for (const inv of invoicesRes.data ?? []) {
    for (const item of (inv.invoice_items ?? []) as Array<Record<string, unknown>>) {
      const productId = item.product_id ? String(item.product_id) : null;
      lines.push({
        date: String(inv.invoice_date),
        order: String(inv.invoice_number),
        productId,
        salesOrderItemId: item.sales_order_item_id ? String(item.sales_order_item_id) : null,
        quantity: Number(item.quantity ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        // Tire revenue: tire lines on customer invoices (commission invoices are not tire sales)
        isTire: Boolean(productId && tireIds.has(productId)) && inv.invoice_type !== 'commission',
      });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));

  // ---------- FIFO layers from POs ----------
  const pos = [...(poRes.data ?? [])].sort(
    (a, b) => String(a.po_date).localeCompare(String(b.po_date)) || String(a.po_number).localeCompare(String(b.po_number))
  );
  const fifo = new FifoCost();
  for (const po of pos) {
    for (const item of (po.purchase_order_items ?? []) as Array<Record<string, unknown>>) {
      const productId = item.product_id ? String(item.product_id) : null;
      if (productId && tireIds.has(productId)) {
        fifo.addLayer(productId, Number(item.quantity_ordered ?? 0), Number(item.unit_price ?? 0));
      }
    }
  }

  // ---------- sales per period ----------
  const lineCost = new Map<InvoiceLine, { cost: number | null; complete: boolean }>();
  for (const line of lines) {
    if (line.isTire && line.productId) {
      lineCost.set(line, fifo.take(line.productId, line.quantity));
    }
  }
  const credits = (creditsRes.data ?? []).map((c) => ({ date: String(c.credit_note_date), amount: Number(c.subtotal ?? 0) }));

  const sales = {} as Record<PeriodKey, SalesFigures>;
  const creditSales = {} as Record<PeriodKey, number>;
  for (const key of keys) {
    const r = periods[key];
    let revenue = 0;
    let units = 0;
    let cogs = 0;
    let anyCost = false;
    let complete = true;
    let allSales = 0;
    for (const line of lines) {
      if (!inRange(line.date, r)) {
        continue;
      }
      allSales += line.lineTotal;
      if (line.isTire) {
        revenue += line.lineTotal;
        units += line.quantity;
        const c = lineCost.get(line);
        if (c?.cost !== null && c?.cost !== undefined) {
          cogs += c.cost;
          anyCost = true;
        }
        complete = complete && Boolean(c?.complete);
      }
    }
    const credit = credits.filter((c) => inRange(c.date, r)).reduce((s, c) => s + c.amount, 0);
    sales[key] = {
      revenue: cents(revenue - credit),
      units,
      cogs: !PURCHASE_COST_AVAILABLE ? null : units === 0 ? 0 : anyCost ? cents(cogs) : null,
      cogsComplete: PURCHASE_COST_AVAILABLE && complete,
    };
    creditSales[key] = cents(allSales - credit);
  }

  // ---------- purchases per period (DPO) ----------
  const purchases = {} as Record<PeriodKey, number>;
  for (const key of keys) {
    let total = 0;
    for (const po of pos) {
      if (inRange(String(po.po_date), periods[key])) {
        total += ((po.purchase_order_items ?? []) as Array<Record<string, unknown>>).reduce((s, i) => s + Number(i.line_total ?? 0), 0);
      }
    }
    purchases[key] = cents(total);
  }

  // ---------- backlog: firm orders not yet invoiced ----------
  const invoicedBySoItem = new Map<string, number>();
  for (const line of lines) {
    if (line.salesOrderItemId) {
      invoicedBySoItem.set(line.salesOrderItemId, (invoicedBySoItem.get(line.salesOrderItemId) ?? 0) + line.quantity);
    }
  }
  const sos = [...(soRes.data ?? [])].sort((a, b) => String(a.order_date).localeCompare(String(b.order_date)));
  let backlogTires = 0;
  let backlogRevenue = 0;
  let backlogCogs = 0;
  let backlogAnyCost = false;
  let backlogComplete = true;
  for (const so of sos) {
    if (!BACKLOG_SO_STATUSES.includes(String(so.status))) {
      continue;
    }
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      const productId = item.product_id ? String(item.product_id) : null;
      if (!productId || !tireIds.has(productId)) {
        continue;
      }
      const ordered = Number(item.customer_qty ?? item.quantity ?? 0);
      const remaining = Math.max(0, ordered - (invoicedBySoItem.get(String(item.id)) ?? 0));
      if (remaining === 0) {
        continue;
      }
      const qty = Number(item.quantity ?? 0);
      const unitNet = qty > 0 ? Number(item.line_total ?? 0) / qty : 0;
      backlogTires += remaining;
      backlogRevenue += remaining * unitNet;
      const c = fifo.take(productId, remaining);
      if (c.cost !== null) {
        backlogCogs += c.cost;
        backlogAnyCost = true;
      }
      backlogComplete = backlogComplete && c.complete;
    }
  }

  // ---------- incoming supply per order cycle ----------
  const etaOf = (s: Record<string, unknown>) =>
    (s.eta_port_tracking ?? s.confirmed_eta ?? s.eta_to_port ?? s.estimated_arrival ?? null) as string | null;
  const shipmentEtas = new Map<string, string[]>();
  for (const s of shipmentsRes.data ?? []) {
    const eta = etaOf(s as Record<string, unknown>);
    if (s.purchase_order_id && eta) {
      const list = shipmentEtas.get(String(s.purchase_order_id)) ?? [];
      list.push(String(eta).slice(0, 10));
      shipmentEtas.set(String(s.purchase_order_id), list);
    }
  }
  const velocityFrom = addDays(asOf, -27); // last 4 weeks
  const cycles = new Map<string, { ordered: number; etas: string[]; sold: number; recent: number }>();
  const cycleOf = (series: unknown) => (series ? String(series) : 'Unassigned');
  for (const po of pos) {
    const c = cycles.get(cycleOf(po.order_series)) ?? { ordered: 0, etas: [], sold: 0, recent: 0 };
    for (const item of (po.purchase_order_items ?? []) as Array<Record<string, unknown>>) {
      if (item.product_id && tireIds.has(String(item.product_id))) {
        c.ordered += Number(item.quantity_ordered ?? 0);
      }
    }
    const etas = shipmentEtas.get(String(po.id));
    const poEta = (po.confirmed_eta ?? po.expected_delivery_date) as string | null;
    c.etas.push(...(etas && etas.length ? etas : poEta ? [String(poEta).slice(0, 10)] : []));
    cycles.set(cycleOf(po.order_series), c);
  }
  for (const so of sos) {
    const key = cycleOf(so.order_series);
    const c = cycles.get(key);
    if (!c) {
      continue;
    }
    const tires = ((so.sales_order_items ?? []) as Array<Record<string, unknown>>)
      .filter((i) => i.product_id && tireIds.has(String(i.product_id)))
      .reduce((s, i) => s + Number(i.customer_qty ?? i.quantity ?? 0), 0);
    c.sold += tires;
    if (so.order_date && String(so.order_date) >= velocityFrom && String(so.order_date) <= asOf) {
      c.recent += tires;
    }
  }
  const supply: SupplyCycle[] = [...cycles.entries()]
    .filter(([, c]) => c.ordered > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([cycle, c]) => {
      const etas = [...c.etas].sort();
      const start = etas[0] ?? null;
      const end = etas[etas.length - 1] ?? null;
      const weeksLeft = start ? Math.max(0, Math.round((daysBetween(asOf, start) / 7) * 10) / 10) : null;
      const unsold = Math.max(0, c.ordered - c.sold);
      const actual = Math.round((c.recent / 4) * 10) / 10;
      const required = weeksLeft && weeksLeft > 0 ? Math.round((unsold / weeksLeft) * 10) / 10 : null;
      return {
        cycle,
        tiresOrdered: c.ordered,
        arrivalStart: start,
        arrivalEnd: end,
        weeksLeft,
        sold: c.sold,
        unsold,
        forwardCommitPct: c.ordered > 0 ? Math.round((c.sold / c.ordered) * 1000) / 10 : null,
        actualWeeklyVelocity: actual,
        requiredWeeklyVelocity: required,
        velocityGap: required === null ? null : Math.round((actual - required) * 10) / 10,
        projectedUncommitted:
          weeksLeft === null ? null : weeksLeft > 0 ? Math.max(0, Math.round(unsold - actual * weeksLeft)) : unsold,
      };
    });

  // ---------- current inventory (ERP units) ----------
  let tiresOnHand = 0;
  let allocated = 0;
  for (const row of inventoryRes.data ?? []) {
    if (row.product_id && tireIds.has(String(row.product_id))) {
      tiresOnHand += Number(row.on_hand ?? 0);
      allocated += Number(row.allocated ?? 0);
    }
  }
  const uncommitted = Math.max(0, tiresOnHand - allocated);
  // 3 most recent completed months
  const t3m = { from: monthStart(asOf, 3), to: monthEnd(monthStart(asOf, 1)), days: 0 };
  const t3mUnits = lines.filter((l) => l.isTire && inRange(l.date, t3m)).reduce((s, l) => s + l.quantity, 0);
  const t3mMonthlyTires = Math.round((t3mUnits / 3) * 10) / 10;

  return {
    asOf,
    periods,
    sales,
    creditSales,
    purchases,
    backlog: {
      tires: backlogTires,
      revenue: cents(backlogRevenue),
      cogs: !PURCHASE_COST_AVAILABLE ? null : backlogTires === 0 ? 0 : backlogAnyCost ? cents(backlogCogs) : null,
      cogsComplete: PURCHASE_COST_AVAILABLE && backlogComplete,
    },
    supply,
    inventory: {
      tiresOnHand,
      allocated,
      uncommitted,
      t3mMonthlyTires,
      monthsOfSupply: t3mMonthlyTires > 0 ? Math.round((uncommitted / t3mMonthlyTires) * 10) / 10 : null,
    },
  };
}
