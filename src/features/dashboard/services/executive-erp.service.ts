/**
 * Executive dashboard — ERP figures (Ankur's spec, Oct 12 call decisions)
 *
 * Recognition rule (Ankur, Definitions 3.1-3.4 and 4.1-4.2; shared with the
 * Overview tab in recognized-sales.service): revenue, COGS and tire units come
 * from the same population. A firm sales order's tires are recognized when the
 * order is delivered; until then they are backlog. Revenue = tire line totals
 * (net of line discounts, excl. tax) of the orders delivered in the period −
 * credit notes (issued/applied) on their credit-note date.
 *
 * COGS (client confirmation, Oct 21, 2026: "COGS from the ERP"), per tire:
 * 1. the cost saved on the sales order line (sales_order_items.unit_cost,
 *    set by the line's first fulfillment allocation: the order cycle cost of
 *    the linked PO for manufacturer, else of the sales order), so historical
 *    margins do not change when product costs change;
 * 2. else the product's ERP cost for the sales order's order cycle
 *    (product_cycle_costs; Ankur, Oct 23: costs vary by cycle);
 * 3. else products.base_cost.
 * Tires with no cost make the figure incomplete (cogsComplete false).
 * FIFO by container needs the real purchase cost per PO line, which the ERP
 * does not record yet.
 *
 * Backlog (client confirmation): firm orders with status confirmed or
 * processing that are not delivered yet. Commission-only orders are not
 * Gesher revenue (Galileo invoices the customer) and are left out.
 *
 * Projected Cash (Ankur, Oct 27 call): orders on the books still to be
 * invoiced, going forward, quarter by quarter. Each backlog order is placed by
 * its expected delivery date (invoice on delivery): requested delivery date,
 * else confirmed ETA, else ETA to US port.
 *
 * Commission (Ankur, Sep 8 email / Sep 25 call): reported separately from tire
 * revenue and gross margin — commission invoices to Galileo by invoice date,
 * plus commission on commission-only orders not billed yet.
 *
 * Money in the database is in cents; this service returns dollars.
 */

import { db } from '@/shared/lib/supabase/database';
import { productCycleCostRepository } from '@/features/products/repositories/product-cycle-cost.repository';
import {
  recognitionDate,
  shipmentDeliveryDates,
  type RecognitionOrder,
  type RecognitionShipment,
} from './recognized-sales.service';
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
  /** null when none of the tires sold has an ERP cost */
  cogs: number | null;
  /** false when some tires sold have no ERP cost (base_cost 0) */
  cogsComplete: boolean;
}

export interface SupplyCycle {
  cycle: string;
  tiresOrdered: number;
  /** Distinct container numbers on the cycle's shipments (entered by Jenny / supplier) */
  containerCount: number;
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
  /** All recognized sales (delivered orders, incl. non-tire lines) less credits — DSO denominator */
  creditSales: Record<PeriodKey, number>;
  /** Purchase order totals by PO date — DPO denominator */
  purchases: Record<PeriodKey, number>;
  backlog: { tires: number; revenue: number; cogs: number | null; cogsComplete: boolean };
  /** Backlog per sales order with its expected delivery date (Projected Cash) */
  backlogOrders: BacklogOrder[];
  /**
   * Commission revenue (Ankur: break commission-only sales out, keep it out of tire
   * revenue and gross margin): commission invoices to Galileo by invoice date.
   */
  commission: Record<PeriodKey, number>;
  /** Commission-only orders whose commission is not billed to Galileo yet */
  commissionUnbilled: { amount: number; orders: number };
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

export interface BacklogOrder {
  order: string;
  orderDate: string;
  status: string;
  /** Expected delivery date, null when the order has none */
  expectedDate: string | null;
  dateSource: 'Requested delivery' | 'Confirmed ETA' | 'ETA to US port' | null;
  tires: number;
  /** Dollars, same basis as backlog revenue (tire lines, net of discounts, excl. tax) */
  revenue: number;
}

/** A recognized sale: a line of a firm sales order, dated by the order's delivery */
interface SaleLine {
  date: string;
  order: string;
  productId: string | null;
  salesOrderItemId: string;
  orderSeries: string | null;
  quantity: number;
  lineTotal: number;
  isTire: boolean;
}

// ============================================
// BUILD
// ============================================

const NOT_RECOGNIZED = ['draft', 'cancelled'];
const OPEN_PO_EXCLUDED = ['draft', 'cancelled'];
/** Client confirmation: backlog = firm orders still confirmed or processing */
const BACKLOG_SO_STATUSES = ['confirmed', 'processing'];
const cents = (n: number) => Math.round(n) / 100;

export async function buildErpExecutiveFigures(asOf: string = businessToday()): Promise<ErpExecutiveFigures> {
  const periods = getPeriods(asOf);
  const keys = Object.keys(periods) as PeriodKey[];

  const cycleCostPromise = productCycleCostRepository.loadLookup();
  const [productsRes, invoicesRes, creditsRes, poRes, soRes, shipmentsRes, inventoryRes] = await Promise.all([
    db.from('products').select('id, item_type, base_cost'),
    // Commission invoices to Galileo only; tire revenue comes from delivered sales orders
    db
      .from('invoices')
      .select('invoice_number, invoice_date, status, invoice_type, invoice_items(line_total)')
      .is('deleted_at', null)
      .eq('invoice_type', 'commission')
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
      .select('id, order_number, order_date, status, order_series, actual_delivery_date, requested_delivery_date, confirmed_eta, eta_to_us_port, is_commission_only, commission_amount, commission_invoice_id, sales_order_items(id, product_id, quantity, customer_qty, line_total, unit_cost)')
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)'),
    db
      .from('shipments')
      .select('purchase_order_id, sales_order_id, load_status, actual_arrival, container_number, eta_port_tracking, confirmed_eta, eta_to_port, estimated_arrival')
      .is('deleted_at', null),
    db.from('inventory').select('product_id, on_hand, allocated'),
  ]);
  for (const r of [productsRes, invoicesRes, creditsRes, poRes, soRes, shipmentsRes, inventoryRes]) {
    if (r.error) {
      throw new Error(`Executive dashboard query failed: ${r.error.message}`);
    }
  }

  const tireIds = new Set((productsRes.data ?? []).filter((p) => p.item_type === 'inventory').map((p) => String(p.id)));
  // ERP cost per tire (cents); 0 = no cost recorded
  const productBaseCost = new Map((productsRes.data ?? []).map((p) => [String(p.id), Number(p.base_cost ?? 0)]));
  const cycleCost = await cycleCostPromise;

  // Build map of sales_order_item_id → saved unit_cost (set by the first fulfillment allocation)
  const itemSavedCost = new Map<string, number | null>();
  for (const so of soRes.data ?? []) {
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      const itemId = item.id ? String(item.id) : null;
      const savedCost = item.unit_cost !== undefined && item.unit_cost !== null ? Number(item.unit_cost) : null;
      if (itemId) {
        itemSavedCost.set(itemId, savedCost);
      }
    }
  }

  // Cost lookup: saved unit_cost of the sales order line, else the order cycle's cost, else the base cost
  const costOf = (
    productId: string,
    qty: number,
    salesOrderItemId: string | null,
    orderSeries: string | null
  ): { cost: number | null; complete: boolean } => {
    // Priority 1: Use saved unit_cost from sales_order_item
    if (salesOrderItemId && itemSavedCost.has(salesOrderItemId)) {
      const savedCost = itemSavedCost.get(salesOrderItemId);
      if (savedCost !== null && savedCost !== undefined && savedCost > 0) {
        return { cost: savedCost * qty, complete: true };
      }
    }
    // Priority 2 and 3: the order cycle's cost, else products.base_cost
    const c = cycleCost(productId, orderSeries, productBaseCost.get(productId) ?? 0);
    return c > 0 ? { cost: c * qty, complete: true } : { cost: null, complete: false };
  };
  // ---------- recognized sales: lines of delivered firm orders (recognized-sales.service) ----------
  const shipmentDates = shipmentDeliveryDates((shipmentsRes.data ?? []) as RecognitionShipment[]);
  const lines: SaleLine[] = [];
  for (const so of soRes.data ?? []) {
    const date = recognitionDate(so as unknown as RecognitionOrder, shipmentDates);
    if (!date || date > asOf) {
      continue;
    }
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      const productId = item.product_id ? String(item.product_id) : null;
      lines.push({
        date,
        order: String(so.order_number),
        productId,
        salesOrderItemId: String(item.id),
        orderSeries: so.order_series ? String(so.order_series) : null,
        // Same quantity the line total is priced on
        quantity: Number(item.quantity ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        isTire: Boolean(productId && tireIds.has(productId)),
      });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
  const recognizedItems = new Set(lines.map((l) => l.salesOrderItemId));

  // Commission invoice lines to Galileo (reported apart from tire revenue)
  const commissionLines = (invoicesRes.data ?? []).flatMap((inv) =>
    ((inv.invoice_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
      date: String(inv.invoice_date),
      lineTotal: Number(item.line_total ?? 0),
    }))
  );

  const pos = [...(poRes.data ?? [])].sort(
    (a, b) => String(a.po_date).localeCompare(String(b.po_date)) || String(a.po_number).localeCompare(String(b.po_number))
  );

  // ---------- sales per period ----------
  const lineCost = new Map<SaleLine, { cost: number | null; complete: boolean }>();
  for (const line of lines) {
    if (line.isTire && line.productId) {
      lineCost.set(line, costOf(line.productId, line.quantity, line.salesOrderItemId, line.orderSeries));
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
      cogs: units === 0 ? 0 : anyCost ? cents(cogs) : null,
      cogsComplete: complete,
    };
    creditSales[key] = cents(allSales - credit);
  }

  // ---------- commission revenue per period (separate from tire revenue) ----------
  const commission = {} as Record<PeriodKey, number>;
  for (const key of keys) {
    commission[key] = cents(
      commissionLines.filter((l) => inRange(l.date, periods[key])).reduce((s, l) => s + l.lineTotal, 0)
    );
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

  // ---------- backlog: firm orders not delivered yet ----------
  const sos = [...(soRes.data ?? [])].sort((a, b) => String(a.order_date).localeCompare(String(b.order_date)));
  let backlogTires = 0;
  let backlogRevenue = 0;
  let backlogCogs = 0;
  let backlogAnyCost = false;
  let backlogComplete = true;
  let commissionUnbilledAmount = 0;
  let commissionUnbilledOrders = 0;
  const backlogOrders: BacklogOrder[] = [];
  for (const so of sos) {
    // Commission-only: Galileo invoices the customer, so these tires are not Gesher
    // revenue backlog; their commission is tracked separately
    if (so.is_commission_only === true) {
      if (!so.commission_invoice_id && Number(so.commission_amount ?? 0) > 0) {
        commissionUnbilledAmount += Number(so.commission_amount);
        commissionUnbilledOrders += 1;
      }
      continue;
    }
    if (!BACKLOG_SO_STATUSES.includes(String(so.status))) {
      continue;
    }
    let orderTires = 0;
    let orderRevenue = 0;
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      const productId = item.product_id ? String(item.product_id) : null;
      if (!productId || !tireIds.has(productId)) {
        continue;
      }
      // A delivered order's tires are recognized revenue, not backlog
      const remaining = recognizedItems.has(String(item.id)) ? 0 : Number(item.customer_qty ?? item.quantity ?? 0);
      if (remaining === 0) {
        continue;
      }
      const qty = Number(item.quantity ?? 0);
      const unitNet = qty > 0 ? Number(item.line_total ?? 0) / qty : 0;
      backlogTires += remaining;
      backlogRevenue += remaining * unitNet;
      orderTires += remaining;
      orderRevenue += remaining * unitNet;
      const c = costOf(productId, remaining, item.id ? String(item.id) : null, so.order_series ? String(so.order_series) : null);
      if (c.cost !== null) {
        backlogCogs += c.cost;
        backlogAnyCost = true;
      }
      backlogComplete = backlogComplete && c.complete;
    }
    if (orderTires > 0) {
      const dates: Array<[BacklogOrder['dateSource'], unknown]> = [
        ['Requested delivery', so.requested_delivery_date],
        ['Confirmed ETA', so.confirmed_eta],
        ['ETA to US port', so.eta_to_us_port],
      ];
      const found = dates.find(([, d]) => Boolean(d));
      backlogOrders.push({
        order: String(so.order_number),
        orderDate: String(so.order_date),
        status: String(so.status),
        expectedDate: found ? String(found[1]).slice(0, 10) : null,
        dateSource: found ? found[0] : null,
        tires: orderTires,
        revenue: cents(orderRevenue),
      });
    }
  }

  // ---------- incoming supply per order cycle ----------
  const etaOf = (s: Record<string, unknown>) =>
    (s.eta_port_tracking ?? s.confirmed_eta ?? s.eta_to_port ?? s.estimated_arrival ?? null) as string | null;
  const shipmentEtas = new Map<string, string[]>();
  const shipmentContainers = new Map<string, string[]>();
  for (const s of shipmentsRes.data ?? []) {
    const container = String((s as Record<string, unknown>).container_number ?? '').trim().toUpperCase();
    if (s.purchase_order_id && container) {
      const list = shipmentContainers.get(String(s.purchase_order_id)) ?? [];
      list.push(container);
      shipmentContainers.set(String(s.purchase_order_id), list);
    }
    const eta = etaOf(s as Record<string, unknown>);
    if (s.purchase_order_id && eta) {
      const list = shipmentEtas.get(String(s.purchase_order_id)) ?? [];
      list.push(String(eta).slice(0, 10));
      shipmentEtas.set(String(s.purchase_order_id), list);
    }
  }
  const velocityFrom = addDays(asOf, -27); // last 4 weeks
  const cycles = new Map<string, { ordered: number; etas: string[]; containers: Set<string>; sold: number; recent: number }>();
  const cycleOf = (series: unknown) => (series ? String(series) : 'Unassigned');
  for (const po of pos) {
    const c = cycles.get(cycleOf(po.order_series)) ?? { ordered: 0, etas: [], containers: new Set<string>(), sold: 0, recent: 0 };
    for (const container of shipmentContainers.get(String(po.id)) ?? []) {
      c.containers.add(container);
    }
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
        containerCount: c.containers.size,
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
      cogs: backlogTires === 0 ? 0 : backlogAnyCost ? cents(backlogCogs) : null,
      cogsComplete: backlogComplete,
    },
    backlogOrders,
    commission,
    commissionUnbilled: { amount: cents(commissionUnbilledAmount), orders: commissionUnbilledOrders },
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
