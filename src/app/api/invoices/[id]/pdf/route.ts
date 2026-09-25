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

    // Fetch the invoice with items
    const { data: invoice, error } = await db
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, customer_code, email, phone),
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

    // Fetch allocations for all items
    const itemsWithAllocations = await Promise.all(
      (invoice.items || []).map(async (item: any, index: number) => {
        // Try to fetch allocations if salesOrderItemId exists
        let allocations: any[] = [];
        if (item.salesOrderItemId) {
          const { data: allocationData } = await getAllocationsByItemId(item.salesOrderItemId);
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
          unitCode: item.unitCode || 'EA',
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent || 0,
          lineTotal: item.lineTotal,
          allocations,
        };
      })
    );

    // Map to PDF data format
    const pdfData: InvoicePdfData = {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      salesOrderNumber: invoice.salesOrderNumber || null,
      customerPoNumber: invoice.customerPoNumber || null,
      status: invoice.status,

      customerName: invoice.customer?.name || 'Unknown Customer',
      customerCode: invoice.customer?.customerCode || '-',
      customerEmail: invoice.customer?.email,
      customerPhone: invoice.customer?.phone,

      billingAddress: {
        street: invoice.billingAddressStreet,
        city: invoice.billingAddressCity,
        state: invoice.billingAddressState,
        postalCode: invoice.billingAddressPostalCode,
        country: invoice.billingAddressCountry,
      },
      shippingAddress: {
        street: invoice.shippingAddressStreet,
        city: invoice.shippingAddressCity,
        state: invoice.shippingAddressState,
        postalCode: invoice.shippingAddressPostalCode,
        country: invoice.shippingAddressCountry,
      },

      items: itemsWithAllocations,

      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      shippingCost: invoice.shippingCost || 0,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid || 0,
      amountDue: invoice.amountDue,

      customerNotes: invoice.customerNotes,
      paymentTerms: invoice.paymentTerms || 'Net 30',
    };

    // Generate PDF
    const pdfBase64 = await generateInvoicePdf(pdfData);

    // Return PDF as binary
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
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
