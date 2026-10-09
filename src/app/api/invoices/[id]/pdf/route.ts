/**
 * Invoice PDF API Route
 *
 * Generates and returns a PDF for an invoice.
 * GET /api/invoices/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateInvoicePdf, type InvoicePdfData } from '@/features/invoices/services/pdf.service';
import { getAllocationsByItemId } from '@/features/sales-orders/repositories/fulfillment-allocations.repository';
import { db } from '@/shared/lib/supabase/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the invoice with items and sales order
    const { data: invoice, error } = await db
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, customer_code, email, phone),
        sales_order:sales_orders(id, order_number, customer_po_number),
        items:invoice_items(
          *,
          product:products(sku, name, description)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Helper function to get fulfillment source label
    const getFulfillmentSourceLabel = (source: string): string => {
      const labels: Record<string, string> = {
        direct: 'Manufacturer Direct',
        gdc_inventory: 'GDC Inventory',
        platinum_dealer_inventory: 'Dealer Inventory',
        platinum_dealer_fulfillment: 'Dealer Fulfillment',
      };
      return labels[source] || source;
    };

    // Fetch allocations for all items (database uses snake_case)
    const itemsWithAllocations = await Promise.all(
      (invoice.items || []).map(async (item: any, index: number) => {
        // Try to fetch allocations if sales_order_item_id exists
        let allocations: any[] = [];
        if (item.sales_order_item_id) {
          const { data: allocationData } = await getAllocationsByItemId(item.sales_order_item_id);
          allocations = allocationData?.map(allocation => ({
            source: getFulfillmentSourceLabel(allocation.fulfillmentSource),
            locationName: allocation.location?.name ||
                         allocation.platinumDealer?.dealerName ||
                         allocation.dealerLocation?.locationName ||
                         null,
            quantity: allocation.quantity,
          })) || [];
        }

        return {
          rowNum: index + 1,
          sku: item.product?.sku || item.sku,
          description: item.description || item.product?.description || item.product?.name || item.sku,
          quantity: item.quantity,
          unitCode: item.unit_code || 'EA',
          unitPrice: item.unit_price,
          discountPercent: item.discount_percent || 0,
          lineTotal: item.line_total,
          allocations,
        };
      })
    );

    // Extract sales order info (handle Supabase join result)
    const salesOrder = invoice.sales_order as { id: string; order_number: string; customer_po_number: string | null } | null;

    // Map to PDF data format (database uses snake_case)
    const pdfData: InvoicePdfData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      salesOrderNumber: salesOrder?.order_number || null,
      customerPoNumber: salesOrder?.customer_po_number || null,
      status: invoice.status,

      customerName: invoice.customer?.name || 'Unknown Customer',
      customerCode: invoice.customer?.customer_code || '-',
      customerEmail: invoice.customer?.email,
      customerPhone: invoice.customer?.phone,

      billingAddress: {
        street: invoice.billing_address_street,
        city: invoice.billing_address_city,
        state: invoice.billing_address_state,
        postalCode: invoice.billing_address_postal_code,
        country: invoice.billing_address_country,
      },
      shippingAddress: {
        street: invoice.shipping_address_street || invoice.billing_address_street,
        city: invoice.shipping_address_city || invoice.billing_address_city,
        state: invoice.shipping_address_state || invoice.billing_address_state,
        postalCode: invoice.shipping_address_postal_code || invoice.billing_address_postal_code,
        country: invoice.shipping_address_country || invoice.billing_address_country,
      },

      items: itemsWithAllocations,

      subtotal: invoice.subtotal,
      discountTotal: invoice.discount_total,
      taxTotal: invoice.tax_total,
      shippingCost: invoice.shipping_cost || 0,
      grandTotal: invoice.grand_total,
      amountPaid: invoice.amount_paid || 0,
      amountDue: invoice.balance_due,

      customerNotes: invoice.customer_notes,
      paymentTerms: invoice.payment_terms || 'Net 30',
    };

    // Generate PDF
    const pdfBase64 = await generateInvoicePdf(pdfData);

    // Return PDF as binary
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Filename format: INV-XXXXX.pdf (just the invoice number)
    const filename = `${invoice.invoice_number}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
