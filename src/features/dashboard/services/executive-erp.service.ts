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
 * plus commission on delivered commission-only orders not billed yet
 * (commission counts only after delivery: Ankur, Nov 4 2026).
 *
 * Money in the database is in cents; this service returns dollars.
 */

import { db } from '@/shared/lib/supabase/database';
import { productCycleCostRepository } from '@/features/products/repositories/product-cycle-cost.repository';
import {
  // Nov 13 2026: DELIVERED_LOAD_STATUSES for the supplier POs of Projected Cash
  DELIVERED_LOAD_STATUSES,
  deliveryDate,
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
  /**
   * Average Purchase Price per tire, $ (Ankur, Nov 11 2026): PO tire lines of the
   * cycle, Σ(unit price × qty ordered) ÷ Σ qty. Lines with no price are left out.
   * Nov 13 2026 (Ankur, Nov 12 email "Yes that works for me"): commission-only
   * loads left out too (Gesher buys nothing on them).
   */
  avgPurchasePrice: number | null;
  /** Nov 13 2026: PO numbers of the cycle left out of the Average Purchase Price as commission-only */
  commissionOnlyPos?: string[];
  /**
   * Average Sold Price per tire, $ (Ankur, Nov 11 2026): tire lines of the cycle's
   * sales orders (not draft / cancelled), Σ(unit price × qty) ÷ Σ qty.
   * Commission-only loads (Galileo sells, Gesher earns commission) and lines
   * with no price are left out.
   */
  avgSoldPrice: number | null;
  /** Nov 13 2026: the tires behind Sold and Average Sold Price, one row per PO and order line */
  soldRows?: CycleSoldRow[];
}

/**
 * Nov 13 2026: tires of one PO of a cycle that went to a firm customer order
 * (table 4.1 Sold, Ankur's Definition 5.1).
 */
export interface CycleSoldRow {
  cycle: string;
  po: string;
  order: string;
  orderDate: string | null;
  productId: string | null;
  /**
   * 'Allocation': fulfillment allocation on the PO; 'PO link': purchase_orders.sales_order_id
   * (no allocation on the PO); 'GDC warehouse stock': allocation from GDC inventory with no PO,
   * counted in the order's cycle (the cycle's loads received into a warehouse, then sold)
   */
  source: 'Allocation' | 'PO link' | 'GDC warehouse stock';
  tires: number;
  /** Order line unit price, cents (0 = no price) */
  unitPrice: number;
  commissionOnly: boolean;
  /** Counted in the Average Sold Price: priced, not commission-only */
  inSoldPrice: boolean;
}

/**
 * Nov 13 2026 (Ankur's spec, Definition 5.1: "Sold is the number of tires on the order
 * cycle allocated to firm customer orders"). Per PO of the cycle:
 *  - fulfillment allocations on the PO (not cancelled) to lines of firm orders
 *    (sales orders not draft / cancelled / deleted: `sos` holds only those)
 *  - else, when the PO has no such allocation, the order it is linked to
 *    (purchase_orders.sales_order_id): its tire lines (older loads were linked this way)
 *  - never more than the PO's tires ordered
 *  - Nov 13 2026 (GDC 1: Valmont C-SO-2600039/40 and Central Valley C-SO-2600037 were sold
 *    from Kansas / Nebraska stock of GDC 1 loads after receipt): allocations from GDC
 *    inventory with no PO count in the order's cycle (sales_orders.order_series), minus what
 *    the same order line already got from a PO, and never past the cycle's tires not sold
 *    through its POs
 * Platinum dealer tires (dealer inventory or dealer fulfillment) are not on the order cycle,
 * so they are not counted.
 */
function cycleSoldRows(
  pos: Array<Record<string, unknown>>,
  sos: Array<Record<string, unknown>>,
  allocations: Array<Record<string, unknown>>,
  tireIds: Set<string>
): CycleSoldRow[] {
  const cycleOf = (series: unknown) => (series ? String(series) : 'Unassigned');
  const soById = new Map(sos.map((so) => [String(so.id), so]));
  const itemById = new Map<string, { so: Record<string, unknown>; item: Record<string, unknown> }>();
  for (const so of sos) {
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      if (item.id) {
        itemById.set(String(item.id), { so, item });
      }
    }
  }
  const allocationsByPo = new Map<string, Array<Record<string, unknown>>>();
  for (const a of allocations) {
    if (!a.purchase_order_id || String(a.status) === 'cancelled') {
      continue;
    }
    const list = allocationsByPo.get(String(a.purchase_order_id)) ?? [];
    list.push(a);
    allocationsByPo.set(String(a.purchase_order_id), list);
  }
  const rowOf = (
    po: Record<string, unknown>,
    so: Record<string, unknown>,
    item: Record<string, unknown>,
    source: CycleSoldRow['source'],
    tires: number
  ): CycleSoldRow => {
    const unitPrice = Number(item.unit_price ?? 0);
    const commissionOnly = so.is_commission_only === true;
    return {
      cycle: cycleOf(po.order_series),
      po: String(po.po_number),
      order: String(so.order_number),
      orderDate: so.order_date ? String(so.order_date).slice(0, 10) : null,
      productId: item.product_id ? String(item.product_id) : null,
      source,
      tires,
      unitPrice,
      commissionOnly,
      inSoldPrice: !commissionOnly && unitPrice > 0,
    };
  };

  const out: CycleSoldRow[] = [];
  // Per cycle: tires ordered, tires counted so far; per order line: tires counted so far
  const cycleOrdered = new Map<string, number>();
  const cycleSold = new Map<string, number>();
  const itemCounted = new Map<string, number>();
  for (const po of pos) {
    const poTires =((po.purchase_order_items ?? []) as Array<Record<string, unknown>>)
      .filter((i) => i.product_id && tireIds.has(String(i.product_id)))
      .reduce((s, i) => s + Number(i.quantity_ordered ?? 0), 0);
    if (poTires <= 0) {
      continue;
    }
    // let rows: CycleSoldRow[] = [];
    let rows: Array<CycleSoldRow & { itemId: string }> = [];
    for (const a of allocationsByPo.get(String(po.id)) ?? []) {
      const found = itemById.get(String(a.sales_order_item_id ?? ''));
      const qty = Number(a.quantity ?? 0);
      if (found && qty > 0) {
        // rows.push(rowOf(po, found.so, found.item, 'Allocation', qty));
        rows.push({ ...rowOf(po, found.so, found.item, 'Allocation', qty), itemId: String(found.item.id) });
      }
    }
    if (rows.length === 0 && po.sales_order_id) {
      const so = soById.get(String(po.sales_order_id));
      for (const item of (so?.sales_order_items ?? []) as Array<Record<string, unknown>>) {
        const qty = Number(item.customer_qty ?? item.quantity ?? 0);
        if (so && item.product_id && tireIds.has(String(item.product_id)) && qty > 0) {
          // rows.push(rowOf(po, so, item, 'PO link', qty));
          rows.push({ ...rowOf(po, so, item, 'PO link', qty), itemId: String(item.id) });
        }
      }
    }
    // Never more than the PO's tires
    let left = poTires;
    rows = rows
      .map((r) => {
        const tires = Math.min(r.tires, left);
        left -= tires;
        return { ...r, tires };
      })
      .filter((r) => r.tires > 0);
    // out.push(...rows);
    const cycle = cycleOf(po.order_series);
    cycleOrdered.set(cycle, (cycleOrdered.get(cycle) ?? 0) + poTires);
    for (const { itemId, ...r } of rows) {
      itemCounted.set(itemId, (itemCounted.get(itemId) ?? 0) + r.tires);
      cycleSold.set(cycle, (cycleSold.get(cycle) ?? 0) + r.tires);
      out.push(r);
    }
  }

  // Nov 13 2026: GDC warehouse stock (allocation from GDC inventory, no PO) in the order's cycle
  for (const a of allocations) {
    if (a.purchase_order_id || String(a.status) === 'cancelled' || String(a.fulfillment_source) !== 'gdc_inventory') {
      continue;
    }
    const found = itemById.get(String(a.sales_order_item_id ?? ''));
    if (!found || !found.item.product_id || !tireIds.has(String(found.item.product_id))) {
      continue;
    }
    const cycle = cycleOf(found.so.order_series);
    // Only cycles with POs (Tires Ordered); never past the cycle's tires not sold yet
    const room = (cycleOrdered.get(cycle) ?? 0) - (cycleSold.get(cycle) ?? 0);
    // Not what this order line already got from a PO (e.g. MWI C-SO3600038 via PO-2600038)
    const itemId = String(found.item.id);
    const lineQty = Number(found.item.customer_qty ?? found.item.quantity ?? 0);
    const lineLeft = lineQty - (itemCounted.get(itemId) ?? 0);
    const tires = Math.min(Number(a.quantity ?? 0), lineLeft, room);
    if (tires <= 0) {
      continue;
    }
    itemCounted.set(itemId, (itemCounted.get(itemId) ?? 0) + tires);
    cycleSold.set(cycle, (cycleSold.get(cycle) ?? 0) + tires);
    const unitPrice = Number(found.item.unit_price ?? 0);
    const commissionOnly = found.so.is_commission_only === true;
    out.push({
      cycle,
      po: '',
      order: String(found.so.order_number),
      orderDate: found.so.order_date ? String(found.so.order_date).slice(0, 10) : null,
      productId: String(found.item.product_id),
      source: 'GDC warehouse stock',
      tires,
      unitPrice,
      commissionOnly,
      inSoldPrice: !commissionOnly && unitPrice > 0,
    });
  }
  return out;
}

/**
 * Nov 13 2026 (Ankur, Nov 12 email: "After the container is delivered we pay on net 45
 * terms"): a supplier PO whose container is not delivered yet, so its bill is not in
 * QuickBooks yet. Projected Cash pays it out at expected delivery + 45 days.
 */
export interface SupplierPayable {
  po: string;
  poDate: string;
  status: string;
  loadStatus: string | null;
  /** Expected delivery of the container, null when the PO has none */
  expectedDate: string | null;
  dateSource: 'Shipment ETA' | 'Confirmed ETA' | 'Expected delivery' | null;
  /** Tires (units) not received yet */
  tires: number;
  /** Dollars still to pay: sum of (qty ordered - qty received) x unit price, lines with a price */
  amount: number;
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
  /** Nov 13 2026: supplier POs not delivered yet (Projected Cash, net 45). Missing = not read */
  supplierPayables?: SupplierPayable[];
  /**
   * Commission revenue (Ankur: break commission-only sales out, keep it out of tire
   * revenue and gross margin): commission invoices to Galileo by invoice date.
   */
  commission: Record<PeriodKey, number>;
  /** Delivered commission-only orders whose commission is not billed to Galileo yet */
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
  dateSource: 'Requested delivery' | 'Confirmed ETA' | 'ETA to US port' | 'QuickBooks ship / due date' | null;
  tires: number;
  /** Dollars, same basis as backlog revenue (tire lines, net of discounts, excl. tax) */
  revenue: number;
  /**
   * Nov 13 2026: days after delivery the customer pays (Projected Cash only; set by
   * projectionOrdersOf on ERP orders, net 30). Missing = paid on the expected date.
   */
  paymentTermsDays?: number;
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
  // Nov 13 2026: POs of commission-only orders (Projected Cash leaves them out). Not fatal:
  // on an error only purchase_orders.sales_order_id is used.
  // Nov 13 2026: quantity added (table 4.1 Sold = tires of the cycle's POs allocated to firm orders)
  const allocationsPromise = db
    .from('fulfillment_allocations')
    // .select('purchase_order_id, sales_order_item_id, status')
    // .select('purchase_order_id, sales_order_item_id, status, quantity')
    // .not('purchase_order_id', 'is', null)
    // Nov 13 2026: also allocations without a PO (GDC warehouse stock, table 4.1 Sold);
    // rows without a PO are skipped by commissionOnlyPoIds (link() needs a PO id)
    .select('purchase_order_id, sales_order_item_id, status, quantity, fulfillment_source')
    .neq('status', 'cancelled');
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
      // .select('id, po_number, po_date, status, order_series, expected_delivery_date, confirmed_eta, purchase_order_items(product_id, quantity_ordered, unit_price, line_total)')
      // Nov 13 2026: sales_order_id, load_status, quantity_received for the supplier POs of Projected Cash
      .select('id, po_number, po_date, status, load_status, sales_order_id, order_series, expected_delivery_date, confirmed_eta, purchase_order_items(product_id, quantity_ordered, quantity_received, unit_price, line_total)')
      .is('deleted_at', null)
      .not('status', 'in', `(${OPEN_PO_EXCLUDED.join(',')})`),
    db
      .from('sales_orders')
      // unit_price added Nov 12 2026 (Average Sold Price, table 4.1)
      .select('id, order_number, order_date, status, order_series, actual_delivery_date, requested_delivery_date, confirmed_eta, eta_to_us_port, is_commission_only, commission_amount, commission_invoice_id, sales_order_items(id, product_id, quantity, customer_qty, line_total, unit_cost, unit_price)')
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
      const delivered = deliveryDate(so as unknown as RecognitionOrder, shipmentDates) !== null;
      if (delivered && !so.commission_invoice_id && Number(so.commission_amount ?? 0) > 0) {
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
  // const cycles = new Map<string, { ordered: number; etas: string[]; containers: Set<string>; sold: number; recent: number }>();
  // buy / sell: price sums (cents) and their tire counts, for the average prices (Nov 12 2026)
  type CycleSum = {
    ordered: number;
    etas: string[];
    containers: Set<string>;
    sold: number;
    recent: number;
    buyValue: number;
    buyQty: number;
    sellValue: number;
    sellQty: number;
  };
  const cycles = new Map<string, CycleSum>();
  const cycleOf = (series: unknown) => (series ? String(series) : 'Unassigned');
  // Nov 13 2026: commission-only POs (same rule as the supplier POs of Projected Cash).
  // The allocations query runs once and is shared with buildSupplierPayables below.
  const allocationsOnce = Promise.resolve(allocationsPromise);
  const commissionPos = await commissionOnlyPoIds(
    pos as Array<Record<string, unknown>>,
    (soRes.data ?? []) as Array<Record<string, unknown>>,
    allocationsOnce
  );
  const commissionPosByCycle = new Map<string, string[]>();
  for (const po of pos) {
    // const c = cycles.get(cycleOf(po.order_series)) ?? { ordered: 0, etas: [], containers: new Set<string>(), sold: 0, recent: 0 };
    const c: CycleSum = cycles.get(cycleOf(po.order_series)) ?? {
      ordered: 0,
      etas: [],
      containers: new Set<string>(),
      sold: 0,
      recent: 0,
      buyValue: 0,
      buyQty: 0,
      sellValue: 0,
      sellQty: 0,
    };
    for (const container of shipmentContainers.get(String(po.id)) ?? []) {
      c.containers.add(container);
    }
    const isCommissionPo = commissionPos.has(String(po.id));
    if (isCommissionPo) {
      const list = commissionPosByCycle.get(cycleOf(po.order_series)) ?? [];
      list.push(String(po.po_number));
      commissionPosByCycle.set(cycleOf(po.order_series), list);
    }
    for (const item of (po.purchase_order_items ?? []) as Array<Record<string, unknown>>) {
      if (item.product_id && tireIds.has(String(item.product_id))) {
        c.ordered += Number(item.quantity_ordered ?? 0);
        const price = Number(item.unit_price ?? 0);
        // if (price > 0) {
        // Nov 13 2026: commission-only POs still count in Tires Ordered, not in the average price
        if (price > 0 && !isCommissionPo) {
          c.buyValue += price * Number(item.quantity_ordered ?? 0);
          c.buyQty += Number(item.quantity_ordered ?? 0);
        }
      }
    }
    const etas = shipmentEtas.get(String(po.id));
    const poEta = (po.confirmed_eta ?? po.expected_delivery_date) as string | null;
    c.etas.push(...(etas && etas.length ? etas : poEta ? [String(poEta).slice(0, 10)] : []));
    cycles.set(cycleOf(po.order_series), c);
  }
  /* Before Nov 13 2026: Sold = every tire of the sales orders whose order series is the
     cycle, wherever the tires came from (e.g. C-SO2600023: 72 from PO-2600023 + 36 from
     platinum dealer stock all counted in GDC 0 → Sold 1,092 > Ordered 1,056).
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
    // Average Sold Price: priced tire lines, not commission-only loads
    if (!so.is_commission_only) {
      for (const i of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
        const price = Number(i.unit_price ?? 0);
        if (i.product_id && tireIds.has(String(i.product_id)) && price > 0) {
          c.sellValue += price * Number(i.quantity ?? 0);
          c.sellQty += Number(i.quantity ?? 0);
        }
      }
    }
  }
  */
  // Nov 13 2026 (Ankur's spec, Definition 5.1: "Sold is the number of tires on the order
  // cycle allocated to firm customer orders"): Sold is counted per PO of the cycle (see
  // cycleSoldRows); Average Sold Price is taken on those same tires.
  let allocationRows: Array<Record<string, unknown>> = [];
  try {
    const allocations = await allocationsOnce;
    if (allocations.error) {
      console.error('[executive-erp] table 4.1 Sold: allocations not read, PO links only:', allocations.error.message);
    }
    allocationRows = (allocations.data ?? []) as Array<Record<string, unknown>>;
  } catch (error) {
    console.error('[executive-erp] table 4.1 Sold: allocations not read, PO links only:', error);
  }
  const soldRows = cycleSoldRows(
    pos as Array<Record<string, unknown>>,
    sos as Array<Record<string, unknown>>,
    allocationRows,
    tireIds
  );
  const soldRowsByCycle = new Map<string, CycleSoldRow[]>();
  for (const row of soldRows) {
    const c = cycles.get(row.cycle);
    if (!c) {
      continue;
    }
    c.sold += row.tires;
    if (row.orderDate && row.orderDate >= velocityFrom && row.orderDate <= asOf) {
      c.recent += row.tires;
    }
    // Average Sold Price: priced tires, not commission-only loads
    if (row.inSoldPrice) {
      c.sellValue += row.unitPrice * row.tires;
      c.sellQty += row.tires;
    }
    const list = soldRowsByCycle.get(row.cycle) ?? [];
    list.push(row);
    soldRowsByCycle.set(row.cycle, list);
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
        // cents → $ per tire
        avgPurchasePrice: c.buyQty > 0 ? Math.round(c.buyValue / c.buyQty) / 100 : null,
        avgSoldPrice: c.sellQty > 0 ? Math.round(c.sellValue / c.sellQty) / 100 : null,
        commissionOnlyPos: commissionPosByCycle.get(cycle) ?? [],
        soldRows: soldRowsByCycle.get(cycle) ?? [],
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

  // ---------- supplier POs to pay (Projected Cash, Nov 13 2026) ----------
  const supplierPayables = await buildSupplierPayables(
    pos as Array<Record<string, unknown>>,
    (soRes.data ?? []) as Array<Record<string, unknown>>,
    (shipmentsRes.data ?? []) as Array<Record<string, unknown>>,
    shipmentEtas,
    // allocationsPromise
    allocationsOnce
  );

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
    supplierPayables,
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

// ============================================
// SUPPLIER POs TO PAY (Projected Cash)
// ============================================

/** PO statuses before the container is delivered (anything else: received, delivered, paid, closed, cancelled...) */
const PO_NOT_DELIVERED_STATUSES = ['sent', 'confirmed', 'in_production', 'ready_to_ship', 'in_transit', 'partial', 'open', 'processing', 'po_needed', 'hold'];
/** Operations (load) statuses that mean the container has arrived or is done */
// Nov 13 2026: 'available' removed. On POs it means "not sold yet" (Jenny's sheet:
// AVAILABLE loads with ETA Dec 2026 - Jan 2027; live PO-2600057..73 are 'confirmed',
// 0 received, load 'available'), not "arrived". Arrival is still caught by the PO
// status (received...) and by delivered shipments.
// const PO_LOAD_DONE_STATUSES = ['delivered', 'invoiced', 'available', 'closed', 'paid', 'partially_paid', 'not_invoiced'];
const PO_LOAD_DONE_STATUSES = ['delivered', 'invoiced', 'closed', 'paid', 'partially_paid', 'not_invoiced'];

/**
 * Nov 13 2026: ids of commission-only POs (Galileo invoices the customer; Gesher buys
 * and pays nothing): POs linked only to commission-only orders, through
 * purchase_orders.sales_order_id or fulfillment allocations. A PO with no linked order
 * is not commission-only. If the allocations cannot be read, only the PO link is used.
 */
async function commissionOnlyPoIds(
  pos: Array<Record<string, unknown>>,
  sos: Array<Record<string, unknown>>,
  allocationsPromise: PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
): Promise<Set<string>> {
  // Commission-only orders and the order of each line
  const commissionSoIds = new Set(sos.filter((so) => so.is_commission_only === true).map((so) => String(so.id)));
  const itemOrder = new Map<string, string>();
  for (const so of sos) {
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      if (item.id) {
        itemOrder.set(String(item.id), String(so.id));
      }
    }
  }
  // Orders each PO is linked to (PO link + allocations)
  const poOrders = new Map<string, Set<string>>();
  const link = (poId: unknown, soId: unknown) => {
    if (!poId || !soId) {
      return;
    }
    const set = poOrders.get(String(poId)) ?? new Set<string>();
    set.add(String(soId));
    poOrders.set(String(poId), set);
  };
  for (const po of pos) {
    link(po.id, po.sales_order_id);
  }
  try {
    const allocations = await allocationsPromise;
    if (allocations.error) {
      console.error('[executive-erp] commission-only POs: allocations not read:', allocations.error.message);
    }
    for (const a of allocations.data ?? []) {
      link(a.purchase_order_id, itemOrder.get(String(a.sales_order_item_id ?? '')));
    }
  } catch (error) {
    console.error('[executive-erp] commission-only POs: allocations not read:', error);
  }
  const out = new Set<string>();
  for (const [poId, orders] of poOrders) {
    if (orders.size > 0 && [...orders].every((id) => commissionSoIds.has(id))) {
      out.add(poId);
    }
  }
  return out;
}

/**
 * Nov 13 2026 (Ankur, Nov 12 email): supplier POs whose container is not delivered
 * yet, i.e. whose bill is not in QuickBooks yet. Left out:
 *  - PO status not before delivery (received, delivered, paid, closed, cancelled, draft...)
 *  - load status delivered / invoiced / paid / closed ('available' = not sold yet, still counted)
 *  - every shipment of the PO delivered
 *  - commission-only loads (Galileo invoices the customer; Gesher pays nothing): POs linked
 *    only to commission-only orders (purchase_orders.sales_order_id or fulfillment allocations)
 *  - nothing left to pay (all received, or no prices)
 */
async function buildSupplierPayables(
  pos: Array<Record<string, unknown>>,
  sos: Array<Record<string, unknown>>,
  shipments: Array<Record<string, unknown>>,
  shipmentEtas: Map<string, string[]>,
  allocationsPromise: PromiseLike<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>
): Promise<SupplierPayable[]> {
  // Nov 13 2026: moved to commissionOnlyPoIds (also used by the Average Purchase Price)
  const commissionPoSet = await commissionOnlyPoIds(pos, sos, allocationsPromise);
  const commissionOnly = (poId: string) => commissionPoSet.has(poId);
  /* Before Nov 13 2026 (same logic, now in commissionOnlyPoIds):
  // Commission-only orders and the order of each line
  const commissionSoIds = new Set(sos.filter((so) => so.is_commission_only === true).map((so) => String(so.id)));
  const itemOrder = new Map<string, string>();
  for (const so of sos) {
    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      if (item.id) {
        itemOrder.set(String(item.id), String(so.id));
      }
    }
  }
  // Orders each PO is linked to (PO link + allocations)
  const poOrders = new Map<string, Set<string>>();
  const link = (poId: unknown, soId: unknown) => {
    if (!poId || !soId) {
      return;
    }
    const set = poOrders.get(String(poId)) ?? new Set<string>();
    set.add(String(soId));
    poOrders.set(String(poId), set);
  };
  for (const po of pos) {
    link(po.id, po.sales_order_id);
  }
  try {
    const allocations = await allocationsPromise;
    if (allocations.error) {
      console.error('[executive-erp] supplier POs: allocations not read:', allocations.error.message);
    }
    for (const a of allocations.data ?? []) {
      link(a.purchase_order_id, itemOrder.get(String(a.sales_order_item_id ?? '')));
    }
  } catch (error) {
    console.error('[executive-erp] supplier POs: allocations not read:', error);
  }
  const commissionOnly = (poId: string) => {
    const orders = poOrders.get(poId);
    return Boolean(orders && orders.size > 0 && [...orders].every((id) => commissionSoIds.has(id)));
  };
  */

  // Shipments per PO: how many, how many delivered
  const shipCount = new Map<string, { all: number; delivered: number }>();
  for (const sh of shipments) {
    if (!sh.purchase_order_id) {
      continue;
    }
    const c = shipCount.get(String(sh.purchase_order_id)) ?? { all: 0, delivered: 0 };
    c.all += 1;
    if (sh.actual_arrival && DELIVERED_LOAD_STATUSES.includes(String(sh.load_status))) {
      c.delivered += 1;
    }
    shipCount.set(String(sh.purchase_order_id), c);
  }

  const out: SupplierPayable[] = [];
  for (const po of pos) {
    const id = String(po.id);
    if (!PO_NOT_DELIVERED_STATUSES.includes(String(po.status))) {
      continue;
    }
    if (po.load_status && PO_LOAD_DONE_STATUSES.includes(String(po.load_status))) {
      continue;
    }
    const ships = shipCount.get(id);
    if (ships && ships.all > 0 && ships.delivered === ships.all) {
      continue;
    }
    if (commissionOnly(id)) {
      continue;
    }
    let amount = 0;
    let tires = 0;
    for (const item of (po.purchase_order_items ?? []) as Array<Record<string, unknown>>) {
      const open = Math.max(0, Number(item.quantity_ordered ?? 0) - Number(item.quantity_received ?? 0));
      const price = Number(item.unit_price ?? 0);
      if (open > 0 && price > 0) {
        amount += open * price;
        tires += open;
      }
    }
    if (amount <= 0) {
      continue;
    }
    // Container's expected delivery: latest shipment ETA, else confirmed ETA, else expected delivery
    const etas = (shipmentEtas.get(id) ?? []).slice().sort();
    const dates: Array<[SupplierPayable['dateSource'], unknown]> = [
      ['Shipment ETA', etas.length ? etas[etas.length - 1] : null],
      ['Confirmed ETA', po.confirmed_eta],
      ['Expected delivery', po.expected_delivery_date],
    ];
    const found = dates.find(([, d]) => Boolean(d));
    out.push({
      po: String(po.po_number),
      poDate: String(po.po_date ?? ''),
      status: String(po.status),
      loadStatus: po.load_status ? String(po.load_status) : null,
      expectedDate: found ? String(found[1]).slice(0, 10) : null,
      dateSource: found ? found[0] : null,
      tires,
      amount: cents(amount),
    });
  }
  return out;
}
