/**
 * Recognized sales (Ankur's Definitions 3.1-3.4, 4.1-4.2)
 *
 * One rule for every dashboard: a firm sales order's tires are recognized
 * when the order is fulfilled (delivered); until then they are backlog.
 * Revenue, COGS and tires sold come from the same delivered tire lines.
 *
 * Delivery date: sales_orders.actual_delivery_date, else the latest
 * actual_arrival of its delivered/invoiced shipments, else the order date for
 * an order with status delivered. Commission-only orders are Galileo's sales
 * (Gesher earns the commission only) and are not recognized here.
 *
 * Revenue = tire line totals (net of line discounts, excl. tax) − credit notes
 * (issued/applied, subtotal) on their credit-note date. Rebates are not
 * recorded in the ERP (open issue, counted as 0).
 *
 * Line cost: the cost saved on the line (unit_cost, set by its first
 * fulfillment allocation), else the order cycle cost, else the base cost.
 *
 * Money is in cents.
 */

import { db } from '@/shared/lib/supabase/database';
import { productCycleCostRepository } from '@/features/products/repositories/product-cycle-cost.repository';

/** Sales order statuses whose delivered tires are recognized */
export const RECOGNIZABLE_SO_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];
/** Shipment load statuses that mean the load reached the customer */
export const DELIVERED_LOAD_STATUSES = ['delivered', 'invoiced'];
/** Credit notes that reduce revenue */
export const RECOGNIZED_CREDIT_NOTE_STATUSES = ['issued', 'applied'];

export type TireSize = '38' | '24' | 'other';

export interface RecognitionOrder {
  id: string;
  order_number: string;
  order_date: string | null;
  status: string;
  actual_delivery_date: string | null;
  is_commission_only: boolean | null;
}

export interface RecognitionShipment {
  sales_order_id: string | null;
  load_status: string | null;
  actual_arrival: string | null;
}

export interface RecognizedSaleLine {
  /** Delivery date (YYYY-MM-DD) */
  date: string;
  salesOrderId: string;
  orderNumber: string;
  salesOrderItemId: string;
  productId: string | null;
  orderSeries: string | null;
  customerChannel: string | null;
  customerName: string | null;
  customerPoNumber: string | null;
  sku: string | null;
  productName: string | null;
  tireSize: TireSize;
  quantity: number;
  /** cents */
  lineTotal: number;
  /** cents */
  unitPrice: number;
  /** cents for the line; null when the tire has no cost */
  cost: number | null;
  /** cents per tire; 0 when none */
  unitCost: number;
  /** Where the cost comes from (drill-down exports) */
  costSource: 'saved' | 'cycle' | 'base' | 'none';
  isTire: boolean;
}

export interface RecognizedSales {
  lines: RecognizedSaleLine[];
  /** Credit notes (cents) on their credit-note date */
  credits: Array<{ date: string; amount: number; number: string | null; customerName: string | null }>;
}

export interface RecognizedSummary {
  /** Tire revenue less credit notes (cents) */
  revenue: number;
  /** Tire COGS (cents) of the same lines */
  cogs: number;
  /** false when a tire sold has no cost */
  cogsComplete: boolean;
  units: number;
  units38: number;
  units24: number;
}

/** 38" / 24" from the product's rim size, else its name */
export function detectTireSize(rimSize: string | null | undefined, name: string | null | undefined): TireSize {
  if (rimSize) {
    const clean = rimSize.replace(/"/g, '').trim();
    if (clean.startsWith('38')) {return '38';}
    if (clean.startsWith('24')) {return '24';}
  }
  if (name) {
    if (/\b38["'\s]|38\s*inch|38in|\sr38\b/i.test(name)) {return '38';}
    if (/\b24["'\s]|24\s*inch|24in|\sr24\b/i.test(name)) {return '24';}
  }
  return 'other';
}

/** Latest delivered/invoiced shipment arrival per sales order */
export function shipmentDeliveryDates(shipments: RecognitionShipment[]): Map<string, string> {
  const dates = new Map<string, string>();
  for (const s of shipments) {
    if (!s.sales_order_id || !s.actual_arrival || !DELIVERED_LOAD_STATUSES.includes(String(s.load_status))) {
      continue;
    }
    const arrival = String(s.actual_arrival).slice(0, 10);
    if (arrival > (dates.get(s.sales_order_id) ?? '')) {
      dates.set(s.sales_order_id, arrival);
    }
  }
  return dates;
}

/** Date the order's tires are recognized, or null while they are backlog */
export function recognitionDate(order: RecognitionOrder, shipmentDates: Map<string, string>): string | null {
  if (order.is_commission_only === true || !RECOGNIZABLE_SO_STATUSES.includes(String(order.status))) {
    return null;
  }
  if (order.actual_delivery_date) {
    return String(order.actual_delivery_date).slice(0, 10);
  }
  const fromShipment = shipmentDates.get(order.id);
  if (fromShipment) {
    return fromShipment;
  }
  return order.status === 'delivered' && order.order_date ? String(order.order_date).slice(0, 10) : null;
}

/** Recognized tire and non-tire lines of all delivered firm orders, with their cost */
export async function loadRecognizedSales(): Promise<RecognizedSales> {
  const cycleCostPromise = productCycleCostRepository.loadLookup();
  const [soRes, shipRes, creditRes] = await Promise.all([
    db
      .from('sales_orders')
      .select(
        'id, order_number, order_date, status, order_series, actual_delivery_date, is_commission_only, customer_po_number, ' +
          'customers (name, channel), ' +
          'sales_order_items (id, product_id, sku, description, quantity, unit_price, line_total, unit_cost, products (item_type, base_cost, rim_size, name))'
      )
      .is('deleted_at', null)
      .in('status', RECOGNIZABLE_SO_STATUSES),
    db.from('shipments').select('sales_order_id, load_status, actual_arrival').is('deleted_at', null).not('sales_order_id', 'is', null),
    db
      .from('credit_notes')
      .select('credit_note_number, credit_note_date, subtotal, customers (name)')
      .in('status', RECOGNIZED_CREDIT_NOTE_STATUSES)
      .is('deleted_at', null),
  ]);
  for (const r of [soRes, shipRes, creditRes]) {
    if (r.error) {
      throw new Error(`Recognized sales query failed: ${r.error.message}`);
    }
  }

  const cycleCost = await cycleCostPromise;
  const shipmentDates = shipmentDeliveryDates((shipRes.data ?? []) as RecognitionShipment[]);
  const lines: RecognizedSaleLine[] = [];

  for (const so of (soRes.data ?? []) as unknown as Array<Record<string, unknown>>) {
    const date = recognitionDate(so as unknown as RecognitionOrder, shipmentDates);
    if (!date) {
      continue;
    }
    const customer = (Array.isArray(so.customers) ? so.customers[0] : so.customers) as { name: string | null; channel: string | null } | null;
    const orderSeries = so.order_series ? String(so.order_series) : null;

    for (const item of (so.sales_order_items ?? []) as Array<Record<string, unknown>>) {
      const product = (Array.isArray(item.products) ? item.products[0] : item.products) as
        | { item_type: string | null; base_cost: number | null; rim_size: string | null; name: string | null }
        | null;
      const productId = item.product_id ? String(item.product_id) : null;
      const quantity = Number(item.quantity ?? 0);
      const isTire = product?.item_type === 'inventory';
      const saved = item.unit_cost === null || item.unit_cost === undefined ? null : Number(item.unit_cost);
      const baseCost = Number(product?.base_cost ?? 0);
      const fromCycle = cycleCost(productId, orderSeries, baseCost);
      const unitCost = saved !== null && saved > 0 ? saved : fromCycle;
      const costSource: RecognizedSaleLine['costSource'] =
        unitCost <= 0 ? 'none' : saved !== null && saved > 0 ? 'saved' : fromCycle !== baseCost ? 'cycle' : 'base';

      lines.push({
        date,
        salesOrderId: String(so.id),
        orderNumber: String(so.order_number),
        salesOrderItemId: String(item.id),
        productId,
        orderSeries,
        customerChannel: customer?.channel ?? null,
        customerName: customer?.name ?? null,
        customerPoNumber: so.customer_po_number ? String(so.customer_po_number) : null,
        sku: item.sku ? String(item.sku) : null,
        productName: product?.name ?? (item.description ? String(item.description) : null),
        tireSize: detectTireSize(product?.rim_size, product?.name),
        quantity,
        unitPrice: Number(item.unit_price ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        cost: unitCost > 0 ? unitCost * quantity : null,
        unitCost: unitCost > 0 ? unitCost : 0,
        costSource,
        isTire,
      });
    }
  }

  return {
    lines,
    credits: (creditRes.data ?? []).map((c) => {
      const customer = (Array.isArray(c.customers) ? c.customers[0] : c.customers) as { name: string | null } | null;
      return {
        date: String(c.credit_note_date),
        amount: Number(c.subtotal ?? 0),
        number: c.credit_note_number ? String(c.credit_note_number) : null,
        customerName: customer?.name ?? null,
      };
    }),
  };
}

/** Tire revenue, COGS and units recognized between from and to (inclusive, YYYY-MM-DD) */
export function summarizeRecognizedSales(sales: RecognizedSales, from: string, to: string): RecognizedSummary {
  const summary: RecognizedSummary = { revenue: 0, cogs: 0, cogsComplete: true, units: 0, units38: 0, units24: 0 };
  for (const line of sales.lines) {
    if (!line.isTire || line.date < from || line.date > to) {
      continue;
    }
    summary.revenue += line.lineTotal;
    summary.units += line.quantity;
    if (line.tireSize === '38') {summary.units38 += line.quantity;}
    if (line.tireSize === '24') {summary.units24 += line.quantity;}
    if (line.cost === null) {
      summary.cogsComplete = false;
    } else {
      summary.cogs += line.cost;
    }
  }
  for (const credit of sales.credits) {
    if (credit.date >= from && credit.date <= to) {
      summary.revenue -= credit.amount;
    }
  }
  return summary;
}
