/**
 * QuickBooks Webhook
 *
 * POST /api/webhooks/quickbooks
 *
 * Ankur, Nov 5 2026: when an invoice is created in QuickBooks, the matching
 * ERP sales order is closed out ("invoiced") automatically. Manual control
 * stays in the ERP ("Mark as Invoiced" / "Reopen Order").
 *
 * Only invoice "Create" events are used. Updates are ignored on purpose:
 * recording a payment updates the invoice, and that must not close an order
 * again after someone reopened it by hand.
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
}

/** Invoice "Create" events from either payload format */
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
        if (notification.realmId && entity.id && entity.name === 'Invoice' && entity.operation === 'Create') {
          found.push({ realmId: String(notification.realmId), invoiceId: String(entity.id) });
        }
      }
    }
  }

  // CloudEvents: [{ type: "qbo.invoice.created.v1", intuitentityid, intuitaccountid }]
  if (Array.isArray(payload)) {
    for (const event of payload as Array<{ type?: string; intuitentityid?: string; intuitaccountid?: string }>) {
      if (event.type?.startsWith('qbo.invoice.created') && event.intuitentityid && event.intuitaccountid) {
        found.push({ realmId: String(event.intuitaccountid), invoiceId: String(event.intuitentityid) });
      }
    }
  }

  // Same invoice twice in one call: once is enough
  const seen = new Set<string>();
  return found.filter((i) => {
    const key = `${i.realmId}:${i.invoiceId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
      for (const { realmId, invoiceId } of invoices) {
        try {
          const result = await closeSalesOrdersForQboInvoice(realmId, invoiceId);
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
