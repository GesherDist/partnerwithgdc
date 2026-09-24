/**
 * Platinum Dealer Email Actions
 *
 * Server actions for sending dealer allocation emails.
 */

'use server';

import { sendDealerAllocationEmail, type DealerAllocationItem } from '../services/email.service';
import { getSalesOrder } from '@/features/sales-orders/actions';
import { generateDealerAllocationPdf, type DealerAllocationPdfData } from '../services/dealer-allocation-pdf.service';

// ============================================
// TYPES
// ============================================

interface SendDealerAllocationEmailActionParams {
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
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Send allocation notification email to platinum dealer
 * Server action - can only be called from client components
 */
export async function sendDealerAllocationEmailAction(
  params: SendDealerAllocationEmailActionParams
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    console.log('🔄 [sendDealerAllocationEmailAction] Starting email send');

    // Validate required fields
    if (!params.dealerEmail) {
      return {
        success: false,
        error: 'Dealer email is required',
      };
    }

    if (!params.dealerName) {
      return {
        success: false,
        error: 'Dealer name is required',
      };
    }

    if (!params.salesOrderNumber) {
      return {
        success: false,
        error: 'Sales order number is required',
      };
    }

    if (!params.items || params.items.length === 0) {
      return {
        success: false,
        error: 'At least one item is required',
      };
    }

    // Generate Dealer-Specific Allocation PDF (NOT full Sales Order)
    let pdfAttachment: string | undefined;
    try {
      console.log('📄 [sendDealerAllocationEmailAction] Fetching sales order data for PDF...');
      const soResult = await getSalesOrder(params.salesOrderId);

      if (soResult.success && soResult.data) {
        const salesOrder = soResult.data;

        console.log('📄 [sendDealerAllocationEmailAction] Generating dealer allocation PDF...');
        console.log(`📋 [sendDealerAllocationEmailAction] PDF will include ${params.items.length} allocated items (not full SO)`);

        // Debug: Log full sales order data
        console.log('🔍 [DEBUG] Full Sales Order Data:', {
          id: salesOrder.id,
          orderNumber: salesOrder.orderNumber,
          customerName: salesOrder.customer?.name,
          shippingAddressStreet: salesOrder.shippingAddressStreet,
          shippingAddressCity: salesOrder.shippingAddressCity,
          shippingAddressState: salesOrder.shippingAddressState,
          shippingAddressPostalCode: salesOrder.shippingAddressPostalCode,
          shippingAddressCountry: salesOrder.shippingAddressCountry,
        });

        // Build Dealer Allocation PDF data (ONLY allocated items, not full SO)
        const pdfData: DealerAllocationPdfData = {
          // Sales Order info
          salesOrderNumber: salesOrder.orderNumber,
          salesOrderDate: salesOrder.orderDate.toISOString(),
          customerName: salesOrder.customer?.name || 'Unknown Customer',
          customerPoNumber: salesOrder.customerPoNumber || undefined,
          requestedDeliveryDate: salesOrder.requestedDeliveryDate?.toISOString() || undefined,

          // Customer address (from shipping address) - FIXED: Use correct field names
          customerAddress: {
            street: salesOrder.shippingAddressStreet || undefined,
            city: salesOrder.shippingAddressCity || undefined,
            state: salesOrder.shippingAddressState || undefined,
            postalCode: salesOrder.shippingAddressPostalCode || undefined,
            country: salesOrder.shippingAddressCountry || undefined,
          },

          // Dealer info
          dealerName: params.dealerName,
          dealerContactName: params.dealerContactName,
          dealerEmail: params.dealerEmail,

          // ONLY allocated items (from params.items, not salesOrder.items)
          items: params.items.map((item) => ({
            sku: item.productSku,
            description: item.productDescription,
            quantity: item.quantity,
            fulfillmentSource: item.fulfillmentSource,
            locationName: item.locationName,
            locationAddress: item.locationAddress,
            notes: item.notes,
          })),

          // Optional notes (from first item if exists)
          specialInstructions: params.items[0]?.notes || undefined,
        };

        pdfAttachment = await generateDealerAllocationPdf(pdfData);
        console.log('✅ [sendDealerAllocationEmailAction] Dealer allocation PDF generated successfully');
      } else {
        console.warn('⚠️ [sendDealerAllocationEmailAction] Failed to fetch sales order, skipping PDF attachment');
      }
    } catch (error) {
      console.error('❌ [sendDealerAllocationEmailAction] PDF generation failed:', error);
      // Continue without PDF if generation fails
    }

    // Call the email service (server-side only)
    const result = await sendDealerAllocationEmail({
      dealerEmail: params.dealerEmail,
      dealerName: params.dealerName,
      dealerContactName: params.dealerContactName,
      salesOrderId: params.salesOrderId,
      salesOrderNumber: params.salesOrderNumber,
      customerName: params.customerName,
      items: params.items,
      requestedDeliveryDate: params.requestedDeliveryDate,
      pdfAttachment,
    });

    if (!result.success) {
      console.error('❌ [sendDealerAllocationEmailAction] Email send failed:', result.error);
      return {
        success: false,
        error: result.error || 'Failed to send email',
      };
    }

    console.log('✅ [sendDealerAllocationEmailAction] Email sent successfully');

    return {
      success: true,
    };
  } catch (error) {
    console.error('❌ [sendDealerAllocationEmailAction] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
