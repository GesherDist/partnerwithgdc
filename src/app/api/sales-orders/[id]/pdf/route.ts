/**
 * Sales Order PDF API Route
 *
 * Generates and returns a PDF for a sales order.
 * GET /api/sales-orders/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSalesOrder } from '@/features/sales-orders/actions';
import { generateSalesOrderPdf, type SalesOrderPdfData } from '@/features/sales-orders/services/pdf.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the sales order
    const result = await getSalesOrder(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Sales order not found' },
        { status: 404 }
      );
    }

    const order = result.data;

    // Map to PDF data format
    const pdfData: SalesOrderPdfData = {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate.toISOString(),
      requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() || null,
      customerPoNumber: order.customerPoNumber,
      status: order.status,

      customerName: order.customer?.name || 'Unknown Customer',
      customerCode: order.customer?.customerCode || '-',
      customerEmail: order.customer?.email,
      customerPhone: order.customer?.phone,

      salesRepName: order.salesRep
        ? `${order.salesRep.firstName || ''} ${order.salesRep.lastName || ''}`.trim() || order.salesRep.email
        : null,

      billingAddress: {
        street: order.billingAddressStreet,
        city: order.billingAddressCity,
        state: order.billingAddressState,
        postalCode: order.billingAddressPostalCode,
        country: order.billingAddressCountry,
      },
      shippingAddress: {
        street: order.shippingAddressStreet,
        city: order.shippingAddressCity,
        state: order.shippingAddressState,
        postalCode: order.shippingAddressPostalCode,
        country: order.shippingAddressCountry,
      },
      shippingMethod: order.shippingMethod,

      items: order.items.map((item, index) => ({
        rowNum: index + 1,
        sku: item.sku,
        description: item.description || item.sku,
        quantity: item.quantity,
        unitCode: item.unitCode,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        lineTotal: item.lineTotal,
      })),

      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      shippingCost: order.shippingCost,
      grandTotal: order.grandTotal,

      customerNotes: order.customerNotes,
      internalNotes: order.internalNotes,
    };

    // Generate PDF
    const pdfBase64 = await generateSalesOrderPdf(pdfData);

    // Return PDF as binary
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="SalesOrder-${order.orderNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating sales order PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
