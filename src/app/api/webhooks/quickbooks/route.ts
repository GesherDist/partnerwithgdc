/**
 * QuickBooks Webhook
 *
 * POST /api/webhooks/quickbooks
 *
 * Ankur, Nov 5 2026: when an invoice is created in QuickBooks, the matching
 * ERP sales order is closed out ("invoiced") automatically. Manual control
 * stays in the ERP ("Mark as Invoiced" / "Reopen Order").
 *
 * (Old, before Nov 9 2026:) Only invoice "Create" events are used. Updates
 * are ignored on purpose: recording a payment updates the invoice, and that
 * must not close an order again after someone reopened it by hand.
 *
 * Nov 9 2026: invoice "Update" events are used too, so an SO number filled in
 * after the first save still closes the order. An order that was reopened by
 * hand in the ERP is NOT closed again by an update (payments update invoices
 * too); only a new invoice ("Create") or "Mark as Invoiced" closes it then.
 *
 * Security: QuickBooks signs the body with the app's webhook verifier token
 * (header `intuit-signature`, HMAC-SHA256, base64). Set
 * QBO_WEBHOOK_VERIFIER_TOKEN; without it every request is rejected.
 *
 * QuickBooks expects a fast 200, so the invoices are processed after the
 * response is sent. Accepts the classic payload (eventNotifications) and the
 * CloudEvents payload (type "qbo.invoice.created.v1").
 */

import { after, NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { closeSalesOrdersForQboInvoice } from '@/features/sales-orders/services/qbo-invoice-close.service';

export const maxDuration = 60;

function isValidSignature(body: string, signature: string | null): boolean {
  const token = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!token || !signature) {
    return false;
  }
  const expected = Buffer.from(createHmac('sha256', token).update(body).digest('base64'));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

interface CreatedInvoice {
  realmId: string;
  invoiceId: string;
  /** 'update': an existing invoice was changed (Nov 9 2026) */
  operation: 'create' | 'update';
}

/** Invoice "Create" and "Update" events from either payload format */
function createdInvoices(payload: unknown): CreatedInvoice[] {
  const found: CreatedInvoice[] = [];

  // Classic: { eventNotifications: [{ realmId, dataChangeEvent: { entities: [{ name, id, operation }] } }] }
  const classic = (payload as { eventNotifications?: unknown })?.eventNotifications;
  if (Array.isArray(classic)) {
    for (const notification of classic as Array<{
      realmId?: string;
      dataChangeEvent?: { entities?: Array<{ name?: string; id?: string; operation?: string }> };
    }>) {
      for (const entity of notification.dataChangeEvent?.entities ?? []) {
        // if (notification.realmId && entity.id && entity.name === 'Invoice' && entity.operation === 'Create') {
        //   found.push({ realmId: String(notification.realmId), invoiceId: String(entity.id) });
        // }
        if (
          notification.realmId &&
          entity.id &&
          entity.name === 'Invoice' &&
          (entity.operation === 'Create' || entity.operation === 'Update')
        ) {
          found.push({
            realmId: String(notification.realmId),
            invoiceId: String(entity.id),
            operation: entity.operation === 'Create' ? 'create' : 'update',
          });
        }
      }
    }
  }

  // CloudEvents: [{ type: "qbo.invoice.created.v1", intuitentityid, intuitaccountid }]
  if (Array.isArray(payload)) {
    for (const event of payload as Array<{ type?: string; intuitentityid?: string; intuitaccountid?: string }>) {
      // if (event.type?.startsWith('qbo.invoice.created') && event.intuitentityid && event.intuitaccountid) {
      //   found.push({ realmId: String(event.intuitaccountid), invoiceId: String(event.intuitentityid) });
      // }
      const created = event.type?.startsWith('qbo.invoice.created');
      const updated = event.type?.startsWith('qbo.invoice.updated');
      if ((created || updated) && event.intuitentityid && event.intuitaccountid) {
        found.push({
          realmId: String(event.intuitaccountid),
          invoiceId: String(event.intuitentityid),
          operation: created ? 'create' : 'update',
        });
      }
    }
  }

  // Same invoice twice in one call: once is enough ("create" wins over "update")
  // const seen = new Set<string>();
  // return found.filter((i) => {
  //   const key = `${i.realmId}:${i.invoiceId}`;
  //   if (seen.has(key)) {
  //     return false;
  //   }
  //   seen.add(key);
  //   return true;
  // });
  const byInvoice = new Map<string, CreatedInvoice>();
  for (const i of found) {
    const key = `${i.realmId}:${i.invoiceId}`;
    const earlier = byInvoice.get(key);
    if (!earlier || (earlier.operation === 'update' && i.operation === 'create')) {
      byInvoice.set(key, i);
    }
  }
  return Array.from(byInvoice.values());
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!isValidSignature(body, request.headers.get('intuit-signature'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const invoices = createdInvoices(payload);
  if (invoices.length > 0) {
    after(async () => {
      for (const { realmId, invoiceId, operation } of invoices) {
        try {
          // const result = await closeSalesOrdersForQboInvoice(realmId, invoiceId);
          const result = await closeSalesOrdersForQboInvoice(realmId, invoiceId, {
            skipReopened: operation === 'update',
          });
          // Kept in the server logs: which order was closed, or why none was
          console.warn('[QuickBooks Webhook] Invoice processed:', JSON.stringify(result));
        } catch (error) {
          console.error(`[QuickBooks Webhook] Invoice ${invoiceId} failed:`, error);
        }
      }
    });
  }

  return NextResponse.json({ received: true, invoices: invoices.length });
}
