/**
 * Purchase Order Email Service (Ankur's email, Nov 6 2026: the supplier never
 * received the PO — "Send to Supplier" only changed the status, it sent no email)
 *
 * Emails the PO PDF to the supplier contacts the user selects. Recipients come
 * from the suppliers on the PO items: the supplier's primary contact email and
 * its supplier contacts that have an email. Uses SMTP (Nodemailer), the same
 * settings as the pick ticket emails. Server-side only.
 */

import nodemailer from 'nodemailer';
import { db } from '@/shared/lib/supabase/database';
import type { PurchaseOrderWithItems } from '../types';
import { generatePurchaseOrderPdf, purchaseOrderPdfFileName } from './pdf.service';

export interface PurchaseOrderEmailRecipient {
  email: string;
  name: string | null;
  supplierName: string;
  /** "Primary contact" (supplier record) or the contact type, e.g. "Purchasing" */
  role: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Email addresses of the suppliers on this PO (deduplicated, primary first)
 */
export async function getPurchaseOrderRecipients(po: PurchaseOrderWithItems): Promise<PurchaseOrderEmailRecipient[]> {
  const supplierIds = [...new Set(po.items.map((i) => i.supplierId).filter((id): id is string => Boolean(id)))];
  if (supplierIds.length === 0) {
    return [];
  }

  const [{ data: suppliers, error: supplierError }, { data: contacts, error: contactError }] = await Promise.all([
    db.from('suppliers').select('id, name, primary_contact_name, primary_contact_email').in('id', supplierIds),
    db
      .from('supplier_contacts')
      .select('supplier_id, first_name, last_name, email, contact_type, is_primary')
      .in('supplier_id', supplierIds)
      .not('email', 'is', null),
  ]);

  if (supplierError) {
    throw new Error(`Failed to load suppliers: ${supplierError.message}`);
  }
  if (contactError) {
    throw new Error(`Failed to load supplier contacts: ${contactError.message}`);
  }

  const supplierName = new Map<string, string>();
  for (const s of suppliers ?? []) {
    supplierName.set(String(s.id), String(s.name));
  }

  const out: PurchaseOrderEmailRecipient[] = [];
  const seen = new Set<string>();
  const add = (email: unknown, recipient: Omit<PurchaseOrderEmailRecipient, 'email'>) => {
    const e = String(email ?? '').trim();
    if (!EMAIL_RE.test(e) || seen.has(e.toLowerCase())) {
      return;
    }
    seen.add(e.toLowerCase());
    out.push({ email: e, ...recipient });
  };

  for (const s of suppliers ?? []) {
    add(s.primary_contact_email, {
      name: s.primary_contact_name ? String(s.primary_contact_name) : null,
      supplierName: String(s.name),
      role: 'Primary contact',
    });
  }
  const sortedContacts = [...(contacts ?? [])].sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)));
  for (const c of sortedContacts) {
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
    add(c.email, {
      name: name || null,
      supplierName: supplierName.get(String(c.supplier_id)) ?? 'Supplier',
      role: c.contact_type ? titleCase(String(c.contact_type)) : 'Contact',
    });
  }

  return out;
}

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.postmarkapp.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error('Email is not configured on the server (SMTP_USER, SMTP_PASSWORD)');
  }

  return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Email the PO PDF to each recipient (one email per recipient).
 * Returns who got it and the errors per address.
 */
export async function sendPurchaseOrderEmail(
  po: PurchaseOrderWithItems,
  recipients: PurchaseOrderEmailRecipient[]
): Promise<{ sentTo: string[]; errors: string[] }> {
  if (recipients.length === 0) {
    return { sentTo: [], errors: ['No recipients selected'] };
  }

  const transporter = createTransporter();
  const pdf = Buffer.from(await generatePurchaseOrderPdf(po), 'base64');
  const fileName = purchaseOrderPdfFileName(po.poNumber);

  const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
  const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';
  const subject = `Purchase Order ${po.poNumber} from Gesher Distribution`;

  const sentTo: string[] = [];
  const errors: string[] = [];

  for (const r of recipients) {
    const greeting = r.name ? `Hello ${r.name},` : 'Hello,';
    const text = `${greeting}\n\nPlease find attached Purchase Order ${po.poNumber}.\n\nThank you,\nGesher Distribution`;
    const html = `<p>${escapeHtml(greeting)}</p><p>Please find attached Purchase Order <strong>${escapeHtml(po.poNumber)}</strong>.</p><p>Thank you,<br>Gesher Distribution</p>`;
    try {
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: r.email,
        subject,
        text,
        html,
        attachments: [{ filename: fileName, content: pdf, contentType: 'application/pdf' }],
      });
      sentTo.push(r.email);
    } catch (error) {
      console.error(`[sendPurchaseOrderEmail] ${po.poNumber} → ${r.email}:`, error);
      errors.push(`${r.email}: ${error instanceof Error ? error.message : 'failed to send'}`);
    }
  }

  return { sentTo, errors };
}
