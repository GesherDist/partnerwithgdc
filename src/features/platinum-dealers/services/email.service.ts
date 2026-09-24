/**
 * Platinum Dealer Email Service
 *
 * Sends allocation notification emails to platinum dealers.
 * Uses SMTP (Nodemailer) for email delivery.
 */

import nodemailer from 'nodemailer';

// ============================================
// TYPES
// ============================================

export interface DealerAllocationItem {
  productSku: string;
  productDescription: string;
  quantity: number;
  fulfillmentSource: 'platinum_dealer_inventory' | 'platinum_dealer_fulfillment';
  locationName?: string;
  locationAddress?: string;
  notes?: string;
}

export interface SendDealerAllocationEmailParams {
  // Dealer Info
  dealerEmail: string;
  dealerName: string;
  dealerContactName?: string;

  // Sales Order Info
  salesOrderId: string;
  salesOrderNumber: string;
  customerName: string;

  // Allocation Items (can be multiple)
  items: DealerAllocationItem[];

  // Additional Info
  requestedDeliveryDate?: string;

  // PDF Attachment (base64 encoded)
  pdfAttachment?: string;
}

// ============================================
// SMTP TRANSPORTER
// ============================================

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

// ============================================
// EMAIL SENDING
// ============================================

/**
 * Send allocation notification email to platinum dealer
 */
export async function sendDealerAllocationEmail(
  params: SendDealerAllocationEmailParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('📧 [sendDealerAllocationEmail] Sending to:', params.dealerEmail);

    const transporter = createTransporter();
    const fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@gesherdistribution.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Gesher Distribution';
    const from = `"${fromName}" <${fromEmail}>`;

    // Determine subject based on items count
    const itemCount = params.items.length;
    const subject =
      itemCount > 1
        ? `New Order Assignment - ${itemCount} Items - SO ${params.salesOrderNumber}`
        : `New Order Assignment - SO ${params.salesOrderNumber}`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: from,
      to: params.dealerEmail,
      subject: subject,
      html: generateDealerEmailHtml(params),
      text: generateDealerEmailText(params),
    };

    // Add PDF attachment if provided
    if (params.pdfAttachment) {
      mailOptions.attachments = [
        {
          filename: `DealerAllocation-${params.salesOrderNumber}.pdf`,
          content: params.pdfAttachment,
          encoding: 'base64',
          contentType: 'application/pdf',
        },
      ];
    }

    await transporter.sendMail(mailOptions);

    console.log('✅ [sendDealerAllocationEmail] Email sent successfully to:', params.dealerEmail);

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ [sendDealerAllocationEmail] SMTP Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Generate HTML email body for dealer allocation notification
 * Simple version - details are in the PDF attachment
 */
function generateDealerEmailHtml(_params: SendDealerAllocationEmailParams): string {
  // Email body is intentionally blank - all details are in the PDF attachment
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order Assignment</title>
</head>
<body>
  <!-- Blank email body - only PDF attachment -->
</body>
</html>
  `;
}

/**
 * Generate plain text email body for dealer allocation notification
 * Simple version - details are in the PDF attachment
 */
function generateDealerEmailText(_params: SendDealerAllocationEmailParams): string {
  // Email text is intentionally blank - all details are in the PDF attachment
  return '';
}
