/**
 * QuickBooks invoice → close out the ERP sales order
 *
 * Ankur, Nov 5 2026: invoices are raised in QuickBooks. When an invoice is
 * created there, QuickBooks calls our webhook and the matching ERP sales order
 * is marked "invoiced" automatically (paid or not). "Mark as Invoiced" stays
 * as the manual fallback for anything the webhook does not catch.
 *
 * Matching (read-only towards QuickBooks, no guessing on bare numbers):
 *   1. The QuickBooks sales order / estimate the invoice was created from
 *      (LinkedTxn): its number, e.g. SO2600057.
 *   2. An "SO" number written on the invoice: invoice number, memo, message
 *      or a custom field, e.g. "SO-2600057".
 * The digits are compared with ERP customer orders (C-SO2600057 /
 * C-SO-2600057, the ERP number has an extra "C"). Nothing is changed when no
 * ERP order matches; an order that is not confirmed / processing / shipped /
 * delivered (e.g. draft, cancelled, already invoiced) is left as it is.
 */

import { db } from '@/shared/lib/supabase/database';
import { getApiBaseUrl } from '@/modules/integrations/quickbooks/lib/oauth';
import { QBO_API_MINOR_VERSION } from '@/modules/integrations/quickbooks/lib/constants';
import { getQboAccess } from '@/modules/integrations/quickbooks/services/qbo-financials.service';
import type { QuickBooksEnvironment } from '@/modules/integrations/quickbooks/types';
import { salesOrderService } from './sales-order.service';
import { ORDER_STATUS_TRANSITIONS, type OrderStatus } from '../types';

type QboAccess = NonNullable<Awaited<ReturnType<typeof getQboAccess>>>;

interface QboInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string;
  PrivateNote?: string;
  CustomerMemo?: { value?: string };
  CustomField?: Array<{ StringValue?: string }>;
  LinkedTxn?: Array<{ TxnId?: string; TxnType?: string }>;
}

export interface InvoiceCloseResult {
  invoiceId: string;
  invoiceNumber: string | null;
  /** ERP orders marked invoiced */
  closed: string[];
  /** ERP orders found but not changed, with the reason */
  skipped: Array<{ orderNumber: string; reason: string }>;
  /** Set when nothing could be matched or QuickBooks could not be read */
  note?: string;
}

/** "SO2600057", "SO-2600057", "SO #2600057", "C-SO2600057" → "2600057" */
const SO_NUMBER = /SO[\s#:-]*(\d{5,})/gi;

function soDigits(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }
  return Array.from(text.matchAll(SO_NUMBER), (m) => m[1]!);
}

/** Digits of a QuickBooks sales order number: "SO2600057" or plain "2600057" */
function linkedDocDigits(docNumber: string | null | undefined): string[] {
  if (!docNumber) {
    return [];
  }
  const tagged = soDigits(docNumber);
  if (tagged.length > 0) {
    return tagged;
  }
  const plain = docNumber.trim().match(/^\d{5,}$/);
  return plain ? [plain[0]] : [];
}

async function getEntity<T>(access: QboAccess, entity: string, id: string): Promise<T | null> {
  const url = `${getApiBaseUrl(access.environment as QuickBooksEnvironment)}/v3/company/${access.realmId}/${entity.toLowerCase()}/${encodeURIComponent(id)}?minorversion=${QBO_API_MINOR_VERSION}`;
  let response: Response | null = null;
  // QuickBooks throttles bursts (429): back off and retry
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${access.accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status !== 429) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  if (!response || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`QuickBooks ${entity} ${id} could not be read (${response.status})`);
  }
  const json = (await response.json()) as Record<string, unknown>;
  return (json[entity] as T) ?? null;
}

/** ERP customer orders whose number has these digits (C-SO2600057 / C-SO-2600057) */
async function findErpOrders(digits: string): Promise<Array<{ id: string; order_number: string; status: OrderStatus }>> {
  const { data, error } = await db
    .from('sales_orders')
    .select('id, order_number, status')
    .ilike('order_number', `C-SO%${digits}`)
    .is('deleted_at', null);
  if (error) {
    throw new Error(`Sales order lookup failed: ${error.message}`);
  }
  return ((data ?? []) as Array<{ id: string; order_number: string; status: OrderStatus }>).filter(
    (o) => o.order_number.replace(/\D/g, '') === digits
  );
}

/** Today in the business time zone (YYYY-MM-DD) */
function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/**
 * Read one QuickBooks invoice and close out the ERP sales order(s) it is for.
 * Safe to call more than once for the same invoice.
 */
export async function closeSalesOrdersForQboInvoice(realmId: string, invoiceId: string): Promise<InvoiceCloseResult> {
  const result: InvoiceCloseResult = { invoiceId, invoiceNumber: null, closed: [], skipped: [] };

  const access = await getQboAccess();
  if (!access) {
    result.note = 'QuickBooks is not connected';
    return result;
  }
  if (access.realmId !== realmId) {
    result.note = `Notification is for another QuickBooks company (${realmId})`;
    return result;
  }

  const invoice = await getEntity<QboInvoice>(access, 'Invoice', invoiceId);
  if (!invoice) {
    result.note = 'Invoice not found in QuickBooks (deleted?)';
    return result;
  }
  result.invoiceNumber = invoice.DocNumber ?? null;

  // 1. The QuickBooks sales order / estimate the invoice was created from
  const digits = new Set<string>();
  for (const link of invoice.LinkedTxn ?? []) {
    if (!link.TxnId || (link.TxnType !== 'SalesOrder' && link.TxnType !== 'Estimate')) {
      continue;
    }
    const linked = await getEntity<{ DocNumber?: string }>(access, link.TxnType, link.TxnId).catch((error) => {
      console.error(`[QBO Invoice Close] Linked ${link.TxnType} ${link.TxnId} could not be read:`, error);
      return null;
    });
    linkedDocDigits(linked?.DocNumber).forEach((d) => digits.add(d));
  }

  // 2. An SO number written on the invoice
  if (digits.size === 0) {
    const texts = [
      invoice.DocNumber,
      invoice.PrivateNote,
      invoice.CustomerMemo?.value,
      ...(invoice.CustomField ?? []).map((f) => f.StringValue),
    ];
    texts.flatMap((t) => soDigits(t)).forEach((d) => digits.add(d));
  }

  if (digits.size === 0) {
    result.note = 'No sales order number found on the invoice';
    return result;
  }

  const today = businessToday();
  const invoicedAt = invoice.TxnDate && /^\d{4}-\d{2}-\d{2}$/.test(invoice.TxnDate) && invoice.TxnDate <= today ? invoice.TxnDate : today;

  let matched = 0;
  for (const d of digits) {
    const orders = await findErpOrders(d);
    matched += orders.length;
    for (const order of orders) {
      if (order.status === 'invoiced') {
        result.skipped.push({ orderNumber: order.order_number, reason: 'already invoiced' });
        continue;
      }
      if (!(ORDER_STATUS_TRANSITIONS[order.status] ?? []).includes('invoiced')) {
        result.skipped.push({ orderNumber: order.order_number, reason: `status is ${order.status}` });
        continue;
      }
      const closed = await salesOrderService.markInvoiced(order.id, {
        invoicedAt,
        qboInvoiceNumber: invoice.DocNumber?.slice(0, 50) ?? null,
      });
      if (closed.success) {
        result.closed.push(order.order_number);
      } else {
        result.skipped.push({ orderNumber: order.order_number, reason: closed.error ?? 'could not be updated' });
      }
    }
  }

  if (matched === 0) {
    result.note = `No ERP sales order matches SO ${Array.from(digits).join(', ')}`;
  }
  return result;
}
