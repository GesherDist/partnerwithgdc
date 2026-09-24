/**
 * Pick Ticket Email Service
 *
 * Sends pick ticket notification emails to warehouse contacts with PDF attachment.
 * Uses SMTP (Nodemailer) for email delivery.
 */

import nodemailer from 'nodemailer';
import { db } from '@/shared/lib/supabase/database';
import { generatePickTicketPdf } from './pdf.service';

interface SendPickTicketEmailParams {
  pickTicketId: string;
  pickTicketNumber: string;
  salesOrderNumber: string;
  warehouseName: string;
  warehouseCode: string;
  contactIds: string[];
  customerName: string;
  shipToAddress: string;
  requiredDate: string | null;
  shippingMethod: string | null;
  customerPoNumber: string | null;
  notes: string | null;
  items: Array<{
    sku: string;
    productName: string;
    quantity: number;
    uom: string;
  }>;
}

interface ContactInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * Send pick ticket notification emails to selected contacts with PDF attachment
 */
export async function sendPickTicketEmails(params: SendPickTicketEmailParams): Promise<{
  success: boolean;
  sentTo: string[];
  errors: string[];
}> {
  const {
    pickTicketNumber,
    salesOrderNumber,
    warehouseName,
    warehouseCode,
    contactIds,
    customerName,
    shipToAddress,
    requiredDate,
    shippingMethod,
    customerPoNumber,
    notes,
    items,
  } = params;

  if (!contactIds || contactIds.length === 0) {
    return { success: true, sentTo: [], errors: [] };
  }

  // Fetch contact details
  const { data: contacts, error: fetchError } = await db
    .from('location_contacts')
    .select('id, name, email')
    .in('id', contactIds)
    .eq('is_active', true);

  if (fetchError || !contacts || contacts.length === 0) {
    console.error('[sendPickTicketEmails] Failed to fetch contacts:', fetchError);
    return {
      success: false,
      sentTo: [],
      errors: ['Failed to fetch contact information'],
    };
  }

  // Get assigned contact name (first selected contact)
  const assignedToName = contacts.length > 0 ? (contacts[0] as ContactInfo).name : null;

  // Generate PDF - required for email
  let pdfBase64: string;
  try {
    pdfBase64 = await generatePickTicketPdf({
      pickTicketNumber,
      createdAt: new Date().toISOString(),
      salesOrderNumber,
      customerName,
      shipToAddress,
      requiredDate,
      shippingMethod,
      warehouseName,
      warehouseCode,
      assignedTo: assignedToName,
      customerPoNumber,
      notes,
      items: items.map((item, index) => ({
        rowNum: index + 1,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        uom: item.uom,
      })),
    });
    console.log('[sendPickTicketEmails] PDF generated successfully, size:', pdfBase64.length);
  } catch (pdfError) {
    console.error('[sendPickTicketEmails] Failed to generate PDF:', pdfError);
    return {
      success: false,
      sentTo: [],
      errors: ['Failed to generate PDF: ' + (pdfError instanceof Error ? pdfError.message : 'Unknown error')],
    };
  }

  const sentTo: string[] = [];
  const errors: string[] = [];

  // Send email to each contact
  for (const contact of contacts as ContactInfo[]) {
    try {
      const emailSent = await sendEmail({
        to: contact.email,
        toName: contact.name,
        subject: `Pick Ticket ${pickTicketNumber} - ${salesOrderNumber}`,
        htmlBody: generatePickTicketEmailHtml({
          contactName: contact.name,
          pickTicketNumber,
          salesOrderNumber,
          warehouseName,
        }),
        textBody: generatePickTicketEmailText({
          contactName: contact.name,
          pickTicketNumber,
          salesOrderNumber,
          warehouseName,
        }),
        attachment: {
          Name: `Pick Ticket - ${pickTicketNumber}.pdf`,
          Content: pdfBase64,
          ContentType: 'application/pdf',
        },
      });

      if (emailSent) {
        sentTo.push(contact.email);
        console.log(`[sendPickTicketEmails] Email sent to ${contact.email}`);
      } else {
        errors.push(`Failed to send to ${contact.email}`);
      }
    } catch (error) {
      console.error(`[sendPickTicketEmails] Error sending to ${contact.email}:`, error);
      errors.push(`Failed to send to ${contact.email}`);
    }
  }

  return {
    success: errors.length === 0,
    sentTo,
    errors,
  };
}

/**
 * Create SMTP transporter
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.postmarkapp.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!user || !pass) {
    throw new Error('SMTP credentials not configured (SMTP_USER, SMTP_PASSWORD)');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Send email via SMTP with optional PDF attachment
 */
async function sendEmail(params: {
  to: string;
  toName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  attachment?: {
    Name: string;
    Content: string;
    ContentType: string;
  };
}): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';
    const from = `"${fromName}" <${fromEmail}>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: from,
      to: params.to,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
    };

    // Add attachment if provided
    if (params.attachment) {
      mailOptions.attachments = [
        {
          filename: params.attachment.Name,
          content: Buffer.from(params.attachment.Content, 'base64'),
          contentType: params.attachment.ContentType,
        },
      ];
    }

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[sendEmail] SMTP Error:', error);
    return false;
  }
}

/**
 * Generate HTML email body - minimal, only PDF attachment matters
 */
function generatePickTicketEmailHtml(_params: {
  contactName: string;
  pickTicketNumber: string;
  salesOrderNumber: string;
  warehouseName: string;
}): string {
  return `Please find attached Pick Ticket.`;
}

/**
 * Generate plain text email body - minimal, only PDF attachment matters
 */
function generatePickTicketEmailText(_params: {
  contactName: string;
  pickTicketNumber: string;
  salesOrderNumber: string;
  warehouseName: string;
}): string {
  return `Please find attached Pick Ticket.`;
}
