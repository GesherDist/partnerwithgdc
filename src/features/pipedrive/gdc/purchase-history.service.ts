/**
 * Customer purchase history (historical tire sales) for Pipedrive.
 *
 * Source: Gesher ERP sales orders (including historically imported orders),
 * their items, and each item's product rim/tire size. Per order and per year:
 * total tires, 24" / 38" quantities, unit price per size, and order date.
 *
 * Published as one pinned note on the customer's Pipedrive organization,
 * identified by PURCHASE_HISTORY_NOTE_MARKER and updated in place, so it shows
 * on the organization timeline (desktop and mobile) without a custom UI.
 * Values that cannot be derived are reported, never invented.
 */

import { db } from '@/shared/lib/supabase/database';
import { fetchAllRows } from '@/shared/lib/supabase/paginate';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { PURCHASE_HISTORY_NOTE_MARKER, PURCHASE_HISTORY_ORDER_STATUSES, type TireSize } from './config';
import { getActivePipedriveConnectionId } from './settings';

// ============================================
// TYPES
// ============================================

export interface OrderHistoryLine {
  orderNumber: string;
  orderDate: string;
  status: string;
  qty24: number;
  qty38: number;
  qtyOther: number;
  totalTires: number;
  /** Distinct prices per size on this order (net of line discount, before tax) */
  unitPrices24: UnitPrice[];
  unitPrices38: UnitPrice[];
}

/**
 * Price actually charged per tire, following the ERP line formula
 * (line total = qty x unit price - round(qty x unit price x discount%), tax
 * added separately): net = line total / qty. `listCents` is set only when a
 * line discount applied.
 */
export interface UnitPrice {
  netCents: number;
  listCents?: number;
}

export interface YearHistoryLine {
  year: number;
  orders: number;
  qty24: number;
  qty38: number;
  qtyOther: number;
  totalTires: number;
}

export interface PurchaseHistory {
  customerId: string;
  erpCustomerId: string;
  orders: OrderHistoryLine[];
  years: YearHistoryLine[];
  /** SKUs whose size could not be determined from product data */
  unclassifiedSkus: string[];
}

interface OrderRow {
  order_number: string;
  order_date: string;
  status: string;
  sales_order_items: Array<{
    sku: string | null;
    quantity: number | null;
    unit_price: number | null;
    discount_percent: number | string | null;
    // Many-to-one join: an object at runtime, typed as an array by supabase-js
    products: ProductRef | ProductRef[] | null;
  }> | null;
}

interface ProductRef {
  rim_size: string | null;
  tire_size: string | null;
  name: string | null;
}

// ============================================
// SIZE CLASSIFICATION
// ============================================

/**
 * 24" or 38" from the product's rim size, tire size (e.g. 380/85R24) or SKU/name.
 */
export function classifyTireSize(product: {
  rimSize?: string | null;
  tireSize?: string | null;
  sku?: string | null;
  name?: string | null;
}): TireSize {
  const rim = product.rimSize?.match(/\b(24|38)\b/);
  if (rim) {return rim[1] as TireSize;}

  for (const text of [product.tireSize, product.sku, product.name]) {
    const match = text?.match(/R\s?(24|38)\b/i);
    if (match) {return match[1] as TireSize;}
  }
  return 'other';
}

// ============================================
// BUILD
// ============================================

/** Net price per tire for an ERP line (see UnitPrice); null without a price or quantity */
export function unitPriceOf(
  unitPrice: number | null,
  discountPercent: number | string | null,
  quantity: number
): UnitPrice | null {
  if (unitPrice === null || quantity <= 0) {
    return null;
  }
  const discount = Number(discountPercent ?? 0) || 0;
  if (discount <= 0) {
    return { netCents: unitPrice };
  }
  const subtotal = quantity * unitPrice;
  const lineTotal = subtotal - Math.round(subtotal * (discount / 100));
  return { netCents: Math.round(lineTotal / quantity), listCents: unitPrice };
}

function addPrice(list: UnitPrice[], price: UnitPrice | null): void {
  if (price && !list.some((p) => p.netCents === price.netCents && p.listCents === price.listCents)) {
    list.push(price);
  }
}

export async function buildPurchaseHistory(customerId: string): Promise<PurchaseHistory> {
  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, customer_code')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError || !customer) {
    throw new Error('Customer not found');
  }

  const orders = await fetchAllRows<OrderRow>((from, to) =>
    db
      .from('sales_orders')
      .select('order_number, order_date, status, sales_order_items(sku, quantity, unit_price, discount_percent, products(rim_size, tire_size, name))')
      .eq('customer_id', customerId)
      .in('status', [...PURCHASE_HISTORY_ORDER_STATUSES])
      .is('deleted_at', null)
      .order('order_date', { ascending: true })
      .order('order_number', { ascending: true })
      .range(from, to)
  );

  const unclassified = new Set<string>();
  const orderLines: OrderHistoryLine[] = orders.map((order) => {
    const line: OrderHistoryLine = {
      orderNumber: order.order_number,
      orderDate: order.order_date,
      status: order.status,
      qty24: 0,
      qty38: 0,
      qtyOther: 0,
      totalTires: 0,
      unitPrices24: [],
      unitPrices38: [],
    };
    for (const item of order.sales_order_items ?? []) {
      const quantity = item.quantity ?? 0;
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const size = classifyTireSize({
        rimSize: product?.rim_size,
        tireSize: product?.tire_size,
        sku: item.sku,
        name: product?.name,
      });
      line.totalTires += quantity;
      const price = unitPriceOf(item.unit_price, item.discount_percent, quantity);
      if (size === '24') {
        line.qty24 += quantity;
        addPrice(line.unitPrices24, price);
      } else if (size === '38') {
        line.qty38 += quantity;
        addPrice(line.unitPrices38, price);
      } else {
        line.qtyOther += quantity;
        if (item.sku) {unclassified.add(item.sku);}
      }
    }
    return line;
  });

  const byYear = new Map<number, YearHistoryLine>();
  for (const line of orderLines) {
    const year = Number(line.orderDate.slice(0, 4));
    const entry = byYear.get(year) ?? { year, orders: 0, qty24: 0, qty38: 0, qtyOther: 0, totalTires: 0 };
    entry.orders += 1;
    entry.qty24 += line.qty24;
    entry.qty38 += line.qty38;
    entry.qtyOther += line.qtyOther;
    entry.totalTires += line.totalTires;
    byYear.set(year, entry);
  }

  return {
    customerId,
    erpCustomerId: customer.customer_code,
    orders: orderLines,
    years: [...byYear.values()].sort((a, b) => b.year - a.year),
    unclassifiedSkus: [...unclassified].sort(),
  };
}

// ============================================
// RENDER
// ============================================

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const priceText = (price: UnitPrice) =>
  price.listCents !== undefined ? `${money(price.netCents)} (list ${money(price.listCents)})` : money(price.netCents);
const prices = (list: UnitPrice[]) => (list.length > 0 ? list.map(priceText).join(' / ') : '—');
const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Pipedrive note HTML (simple tags only: b, br, ul, li).
 */
export function renderPurchaseHistoryNote(history: PurchaseHistory): string {
  const header =
    `<b>${PURCHASE_HISTORY_NOTE_MARKER} Tire purchase history</b><br>` +
    `ERP Customer ID: ${escapeHtml(history.erpCustomerId)} · Source: Gesher ERP sales orders ` +
    `(${PURCHASE_HISTORY_ORDER_STATUSES.join(', ')}). Prices are per tire, net of line discounts, before tax.`;

  if (history.orders.length === 0) {
    return `${header}<br>No orders in the ERP for this customer.`;
  }

  const yearItems = history.years.map((year) => {
    const other = year.qtyOther > 0 ? ` · other sizes ${year.qtyOther}` : '';
    const orders = `${year.orders} order${year.orders === 1 ? '' : 's'}`;
    return `<li>${year.year}: ${year.totalTires} tires (24": ${year.qty24} · 38": ${year.qty38}${other}) in ${orders}</li>`;
  });

  const orderItems = [...history.orders].reverse().map((order) => {
    const other = order.qtyOther > 0 ? ` · other ${order.qtyOther}` : '';
    return (
      `<li>${escapeHtml(order.orderDate)} · ${escapeHtml(order.orderNumber)}: ${order.totalTires} tires — ` +
      `24": ${order.qty24} @ ${prices(order.unitPrices24)} · 38": ${order.qty38} @ ${prices(order.unitPrices38)}${other}</li>`
    );
  });

  const unknown =
    history.unclassifiedSkus.length > 0
      ? `<br>Size unknown in product data (counted as "other"): ${history.unclassifiedSkus.map(escapeHtml).join(', ')}`
      : '';

  return (
    `${header}<br><br><b>By year</b><ul>${yearItems.join('')}</ul>` +
    `<b>By order (newest first)</b><ul>${orderItems.join('')}</ul>${unknown}`
  );
}

// ============================================
// PUBLISH
// ============================================

export type PurchaseHistoryPublishStatus = 'created' | 'updated' | 'unchanged' | 'not_linked' | 'not_connected';

/**
 * Create or update the purchase history note on the customer's organization.
 */
export async function publishPurchaseHistory(
  customerId: string
): Promise<{ status: PurchaseHistoryPublishStatus; noteId?: number; history?: PurchaseHistory }> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return { status: 'not_connected' };
  }

  const { data: customer } = await db
    .from('customers')
    .select('pipedrive_org_id')
    .eq('id', customerId)
    .maybeSingle();
  const orgId = customer?.pipedrive_org_id as number | null | undefined;
  if (!orgId) {
    return { status: 'not_linked' };
  }

  const history = await buildPurchaseHistory(customerId);
  const content = renderPurchaseHistoryNote(history);

  // Notes stay on v1 (not deprecated); find the managed note by its marker
  const notes = await pipedriveProvider.fetchAllV1<{ id: number; content?: string }>(
    connectionId,
    'notes',
    new URLSearchParams({ org_id: String(orgId) }),
    runPipedriveRequest
  );
  const managed = notes.items
    .filter((note) => note.content?.includes(PURCHASE_HISTORY_NOTE_MARKER))
    .sort((a, b) => a.id - b.id);

  if (managed.length === 0 && !notes.complete) {
    // Cannot prove there is no existing note; creating one could duplicate it
    throw new Error('Could not read all organization notes; purchase history not published');
  }

  const existing = managed[0];
  if (existing) {
    if (existing.content === content) {
      return { status: 'unchanged', noteId: existing.id, history };
    }
    await runPipedriveWrite(() =>
      pipedriveProvider.request(connectionId, 'PUT', `notes/${existing.id}`, { content }, 'v1')
    );
    return { status: 'updated', noteId: existing.id, history };
  }

  const created = await runPipedriveWrite(() =>
    pipedriveProvider.request<{ id: number }>(
      connectionId, 'POST',
      'notes',
      { content, org_id: orgId, pinned_to_organization_flag: true },
      'v1'
    )
  );
  return { status: 'created', noteId: created.data?.id, history };
}

/**
 * Refresh purchase history after an ERP order changes status. Never throws:
 * an order status change must not fail because Pipedrive is unavailable.
 */
export async function refreshPurchaseHistoryForOrder(salesOrderId: string): Promise<void> {
  try {
    const { data: order } = await db
      .from('sales_orders')
      .select('customer_id')
      .eq('id', salesOrderId)
      .maybeSingle();
    if (order?.customer_id) {
      await publishPurchaseHistory(order.customer_id as string);
    }
  } catch (error) {
    console.error('[PurchaseHistory] Refresh after order change failed:', error);
  }
}
