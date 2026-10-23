/**
 * ERP order status -> Pipedrive deal (one way).
 *
 * A won deal's ERP quote (quotes.pipedrive_deal_id) and the sales order made
 * from it (sales_orders.quote_id) give the deal's "ERP Order Status" field,
 * e.g. "Quote pending approval · QT-2026-00058" or "Shipped · SO-2600045".
 * The order's shipments give "Shipment ETA" (earliest open ETA, or
 * "Delivered") and "Container Status" (one entry per container), and its
 * invoices give "Invoice Status" (e.g. "INV-2600012 · Paid"). These are
 * display only: they are never read back from Pipedrive.
 *
 * The text is always computed from the ERP records, so every call writes the
 * current state and repeating a call is harmless; an unchanged field is not
 * written. Pipedrive keeps the field's change history.
 *
 * Runs after quote and sales order status changes and shipment edits on the
 * Shipments page / Operations Dashboard (background), after the SO number
 * write-back, and daily for anything changed elsewhere, e.g. CMA CGM
 * tracking and shipping emails (pipedrive-reconcile cron).
 */

import { db } from '@/shared/lib/supabase/database';
import { fetchAllRows } from '@/shared/lib/supabase/paginate';
import { pipedriveProvider, isPipedriveNotFound } from '@/modules/integrations/providers/crm/pipedrive';
import { runPipedriveRequest, runPipedriveWrite } from '../lib/rate-limiter';
import { getGdcConfig } from './setup.service';
import { getActivePipedriveConnectionId } from './settings';

export interface OrderStatusSyncResult {
  status: 'written' | 'unchanged' | 'not_linked' | 'not_connected' | 'setup_required' | 'deal_not_found';
  message: string;
  text?: string;
}

const QUOTE_LABELS: Record<string, string> = {
  draft: 'Quote draft',
  pending_approval: 'Quote pending approval',
  approved: 'Quote approved',
  rejected: 'Quote rejected',
  expired: 'Quote expired',
  converted: 'Quote converted',
};

const ORDER_LABELS: Record<string, string> = {
  draft: 'Order draft',
  pending: 'Order pending',
  confirmed: 'Order confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

interface QuoteRow {
  id: string;
  quote_number: string;
  status: string;
}

interface OrderRow {
  order_number: string;
  status: string;
}

/** "Shipped · SO-2600045", or the quote's status before an order exists */
export function orderStatusText(quote: QuoteRow, order: OrderRow | null): string {
  if (order) {
    return `${ORDER_LABELS[order.status] ?? order.status} · ${order.order_number}`;
  }
  return `${QUOTE_LABELS[quote.status] ?? quote.status} · ${quote.quote_number}`;
}

// ============================================
// SHIPMENT ETA / CONTAINER STATUS
// ============================================

const TRACKING_LABELS: Record<string, string> = {
  booked: 'Booked',
  container_picked: 'Container picked up',
  loaded_on_vessel: 'Loaded on vessel',
  departed_origin: 'Departed origin',
  in_transit: 'In transit',
  arrived_port: 'Arrived at port',
  customs_clearance: 'In customs',
  on_rail: 'On rail',
  loaded_on_rail: 'On rail',
  at_ramp: 'At rail ramp',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Exception',
  pending: 'Pending',
  failed: 'Failed',
};

export interface ShipmentRow {
  shipment_number: string | null;
  container_number: string | null;
  status: string | null;
  tracking_status: string | null;
  eta_port_tracking: string | null;
  eta_to_port: string | null;
  estimated_arrival: string | null;
}

const isDelivered = (s: ShipmentRow) => s.status === 'delivered' || s.tracking_status === 'delivered';
/** Same priority as the Operations Dashboard: tracking ETA > manual ETA > estimated arrival */
const etaOf = (s: ShipmentRow) => (s.eta_port_tracking || s.eta_to_port || s.estimated_arrival || '').slice(0, 10) || null;
const label = (value: string) => TRACKING_LABELS[value] ?? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Deal fields for the order's shipments:
 * - eta: earliest ETA of the shipments not delivered yet ("2026-11-12"),
 *   "Delivered" when all are delivered, "" without shipments or ETA
 * - containers: one entry per shipment, "CMAU1234567 · Arrived at port · ETA 2026-11-12"
 */
export function shipmentFieldsText(shipments: ShipmentRow[]): { eta: string; containers: string } {
  if (shipments.length === 0) {
    return { eta: '', containers: '' };
  }
  const open = shipments.filter((s) => !isDelivered(s));
  const etas = open.map(etaOf).filter((d): d is string => Boolean(d)).sort();
  const eta = open.length === 0 ? 'Delivered' : etas[0] ?? '';
  const containers = shipments
    .map((s) => {
      const name = s.container_number || s.shipment_number || 'Shipment';
      const status = isDelivered(s) ? 'Delivered' : label(s.tracking_status || s.status || 'pending');
      const shipmentEta = !isDelivered(s) && etaOf(s) ? ` · ETA ${etaOf(s)}` : '';
      return `${name} · ${status}${shipmentEta}`;
    })
    .join(' | ');
  // Pipedrive text fields hold 255 characters
  return { eta, containers: containers.length > 255 ? `${containers.slice(0, 252)}...` : containers };
}

// ============================================
// INVOICE STATUS
// ============================================

export interface InvoiceRow {
  invoice_number: string;
  status: string;
  grand_total: number | null;
  balance_due: number | null;
  due_date: string | null;
}

/** ERP amounts are integer cents */
const money = (cents: number | null) =>
  `$${((cents ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Deal "Invoice Status": one entry per invoice of the order, e.g.
 * "INV-2600012 · Sent · $60,000.00 due 2026-11-30" or "INV-2600012 · Paid".
 * A sent / partly paid invoice past its due date shows as Overdue.
 * No order yet: "". Order without an invoice: "Not invoiced yet".
 * It reflects the ERP invoices; payments recorded only in QuickBooks show
 * once they reach the ERP.
 */
export function invoiceStatusText(hasOrder: boolean, invoices: InvoiceRow[], today = new Date().toISOString().slice(0, 10)): string {
  if (!hasOrder) {
    return '';
  }
  const live = invoices.filter((i) => i.status !== 'cancelled');
  const shown = live.length > 0 ? live : invoices;
  if (shown.length === 0) {
    return 'Not invoiced yet';
  }
  const text = shown
    .map((i) => {
      const due = i.due_date?.slice(0, 10) ?? null;
      const open = ['sent', 'partial', 'overdue'].includes(i.status);
      const overdue = i.status === 'overdue' || (open && due !== null && due < today);
      if (i.status === 'paid') {return `${i.invoice_number} · Paid`;}
      if (i.status === 'cancelled') {return `${i.invoice_number} · Cancelled`;}
      if (i.status === 'draft') {return `${i.invoice_number} · Draft · ${money(i.grand_total)}`;}
      if (overdue) {return `${i.invoice_number} · Overdue · ${money(i.balance_due)} open${due ? ` (due ${due})` : ''}`;}
      if (i.status === 'partial') {return `${i.invoice_number} · Partially paid · ${money(i.balance_due)} open${due ? ` (due ${due})` : ''}`;}
      return `${i.invoice_number} · Sent · ${money(i.balance_due ?? i.grand_total)}${due ? ` due ${due}` : ''}`;
    })
    .join(' | ');
  return text.length > 255 ? `${text.slice(0, 252)}...` : text;
}

/**
 * Write the current ERP order status on one Pipedrive deal.
 */
export async function syncDealOrderStatus(dealId: number): Promise<OrderStatusSyncResult> {
  const connectionId = await getActivePipedriveConnectionId();
  if (!connectionId) {
    return { status: 'not_connected', message: 'Pipedrive is not connected' };
  }
  const config = await getGdcConfig(connectionId);
  // Settings stored before these fields existed: "Apply setup" adds them
  const fields = config.fields as Partial<typeof config.fields>;
  const fieldCode = fields.deal_erp_order_status?.code;
  if (!fieldCode) {
    return { status: 'setup_required', message: 'Run "Apply setup" in Settings → Pipedrive to add the ERP Order Status field' };
  }
  const etaField = fields.deal_shipment_eta?.code;
  const containerField = fields.deal_container_status?.code;
  const invoiceField = fields.deal_invoice_status?.code;

  const { data: quote, error } = await db
    .from('quotes')
    .select('id, quote_number, status')
    .eq('pipedrive_deal_id', dealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load the quote of deal ${dealId}: ${error.message}`);
  }
  if (!quote) {
    return { status: 'not_linked', message: `No ERP quote for deal ${dealId}` };
  }
  const { data: order, error: orderError } = await db
    .from('sales_orders')
    .select('id, order_number, status')
    .eq('quote_id', quote.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) {
    throw new Error(`Failed to load the sales order of quote ${quote.quote_number}: ${orderError.message}`);
  }
  const text = orderStatusText(quote as QuoteRow, order as OrderRow | null);

  // Desired field values; shipment fields only when they exist in Pipedrive
  const desired: Record<string, string> = { [fieldCode]: text };
  if (etaField || containerField) {
    let shipments: ShipmentRow[] = [];
    if (order) {
      const { data, error: shipmentError } = await db
        .from('shipments')
        .select('shipment_number, container_number, status, tracking_status, eta_port_tracking, eta_to_port, estimated_arrival')
        .eq('sales_order_id', order.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (shipmentError) {
        throw new Error(`Failed to load the shipments of ${order.order_number}: ${shipmentError.message}`);
      }
      shipments = (data ?? []) as ShipmentRow[];
    }
    const shipping = shipmentFieldsText(shipments);
    if (etaField) {desired[etaField] = shipping.eta;}
    if (containerField) {desired[containerField] = shipping.containers;}
  }
  if (invoiceField) {
    let invoices: InvoiceRow[] = [];
    if (order) {
      const { data, error: invoiceError } = await db
        .from('invoices')
        .select('invoice_number, status, grand_total, balance_due, due_date')
        .eq('sales_order_id', order.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (invoiceError) {
        throw new Error(`Failed to load the invoices of ${order.order_number}: ${invoiceError.message}`);
      }
      invoices = (data ?? []) as InvoiceRow[];
    }
    desired[invoiceField] = invoiceStatusText(Boolean(order), invoices);
  }

  let current: Record<string, unknown>;
  try {
    const response = await runPipedriveRequest(() =>
      pipedriveProvider.request<{ custom_fields?: Record<string, unknown> }>(connectionId, 'GET', `deals/${dealId}`)
    );
    current = response.data?.custom_fields ?? {};
  } catch (requestError) {
    if (isPipedriveNotFound(requestError)) {
      return { status: 'deal_not_found', message: `Pipedrive deal ${dealId} was not found` };
    }
    throw requestError;
  }
  // Empty and missing count as the same value
  const changes = Object.fromEntries(
    Object.entries(desired).filter(([code, value]) => (current[code] ?? '') !== value)
  );
  if (Object.keys(changes).length === 0) {
    return { status: 'unchanged', message: `Deal ${dealId} already shows "${text}"`, text };
  }
  await runPipedriveWrite(() =>
    pipedriveProvider.request(connectionId, 'PATCH', `deals/${dealId}`, { custom_fields: changes })
  );
  return { status: 'written', message: `Deal ${dealId}: "${text}"`, text };
}

/**
 * After an invoice change (created, sent, payment, cancelled, ...): update the
 * deal of its sales order in the background. Never throws.
 */
export function syncInvoiceDealInBackground(invoiceId: string): void {
  void (async () => {
    try {
      const { data } = await db.from('invoices').select('sales_order_id').eq('id', invoiceId).maybeSingle();
      const salesOrderId = (data?.sales_order_id as string | null) ?? null;
      if (salesOrderId) {
        syncOrderStatusInBackground({ salesOrderId });
      }
    } catch (error) {
      console.error('[Pipedrive] Invoice status sync failed:', error);
    }
  })();
}

/**
 * After a shipment change (ETA, container, tracking): update the deal of its
 * sales order in the background. Never throws.
 */
export function syncShipmentDealInBackground(shipmentId: string): void {
  void (async () => {
    try {
      const { data } = await db.from('shipments').select('sales_order_id').eq('id', shipmentId).maybeSingle();
      const salesOrderId = (data?.sales_order_id as string | null) ?? null;
      if (salesOrderId) {
        syncOrderStatusInBackground({ salesOrderId });
      }
    } catch (error) {
      console.error('[Pipedrive] Shipment status sync failed:', error);
    }
  })();
}

/** Deal of a quote, or null */
async function dealOfQuote(quoteId: string): Promise<number | null> {
  const { data } = await db.from('quotes').select('pipedrive_deal_id').eq('id', quoteId).maybeSingle();
  const dealId = Number(data?.pipedrive_deal_id);
  return Number.isInteger(dealId) && dealId > 0 ? dealId : null;
}

/**
 * After a quote or sales order status change: update its deal in the
 * background. Never throws; only linked quotes / orders reach Pipedrive.
 */
export function syncOrderStatusInBackground(source: { quoteId?: string | null; salesOrderId?: string | null }): void {
  void (async () => {
    try {
      let quoteId = source.quoteId ?? null;
      if (!quoteId && source.salesOrderId) {
        const { data } = await db.from('sales_orders').select('quote_id').eq('id', source.salesOrderId).maybeSingle();
        quoteId = (data?.quote_id as string | null) ?? null;
      }
      const dealId = quoteId ? await dealOfQuote(quoteId) : null;
      if (!dealId) {
        return;
      }
      const result = await syncDealOrderStatus(dealId);
      if (result.status === 'setup_required') {
        console.warn(`[Pipedrive] Order status not synced: ${result.message}`);
      }
    } catch (error) {
      console.error('[Pipedrive] Order status sync failed:', error);
    }
  })();
}

/**
 * Daily safety net (pipedrive-reconcile cron): deals whose quote or sales
 * order changed in the last `sinceHours` hours, including changes made
 * outside the quote / sales order services.
 */
export async function reconcileRecentOrderStatuses(options: { sinceHours?: number } = {}): Promise<{
  deals: number;
  written: number;
  failed: number;
}> {
  const since = new Date(Date.now() - (options.sinceHours ?? 26) * 3600_000).toISOString();
  const [quotes, orders, shipments, invoices] = await Promise.all([
    fetchAllRows<{ pipedrive_deal_id: number | null }>((from, to) =>
      db
        .from('quotes')
        .select('pipedrive_deal_id')
        .not('pipedrive_deal_id', 'is', null)
        .gte('updated_at', since)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<{ quote_id: string | null }>((from, to) =>
      db
        .from('sales_orders')
        .select('quote_id')
        .not('quote_id', 'is', null)
        .gte('updated_at', since)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    // Shipments changed by CMA CGM tracking, shipping emails, the supplier portal, ...
    fetchAllRows<{ sales_order_id: string | null }>((from, to) =>
      db
        .from('shipments')
        .select('sales_order_id')
        .not('sales_order_id', 'is', null)
        .gte('updated_at', since)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    // Invoices changed (payments, status, and later the QuickBooks payment pull)
    fetchAllRows<{ sales_order_id: string | null }>((from, to) =>
      db
        .from('invoices')
        .select('sales_order_id')
        .not('sales_order_id', 'is', null)
        .gte('updated_at', since)
        .order('id', { ascending: true })
        .range(from, to)
    ),
  ]);

  const dealIds = new Set(quotes.map((q) => Number(q.pipedrive_deal_id)).filter((id) => id > 0));
  const quoteIds = new Set(orders.map((o) => o.quote_id).filter((id): id is string => Boolean(id)));
  const shipmentOrderIds = [...new Set([...shipments, ...invoices].map((s) => s.sales_order_id).filter((id): id is string => Boolean(id)))];
  for (let start = 0; start < shipmentOrderIds.length; start += 200) {
    const { data, error } = await db
      .from('sales_orders')
      .select('quote_id')
      .in('id', shipmentOrderIds.slice(start, start + 200))
      .not('quote_id', 'is', null);
    if (error) {
      throw new Error(`Failed to load the orders of changed shipments / invoices: ${error.message}`);
    }
    for (const row of data ?? []) {quoteIds.add(row.quote_id as string);}
  }
  const quoteIdList = [...quoteIds];
  for (let start = 0; start < quoteIdList.length; start += 200) {
    const { data, error } = await db
      .from('quotes')
      .select('pipedrive_deal_id')
      .in('id', quoteIdList.slice(start, start + 200))
      .not('pipedrive_deal_id', 'is', null);
    if (error) {
      throw new Error(`Failed to load the quotes of changed orders: ${error.message}`);
    }
    for (const row of data ?? []) {dealIds.add(Number(row.pipedrive_deal_id));}
  }

  const result = { deals: dealIds.size, written: 0, failed: 0 };
  for (const dealId of dealIds) {
    try {
      const outcome = await syncDealOrderStatus(dealId);
      if (outcome.status === 'not_connected' || outcome.status === 'setup_required') {
        console.warn(`[Pipedrive] Order status reconcile stopped: ${outcome.message}`);
        break;
      }
      if (outcome.status === 'written') {result.written++;}
    } catch (error) {
      result.failed++;
      console.error(`[Pipedrive] Order status reconcile failed for deal ${dealId}:`, error);
    }
  }
  return result;
}
