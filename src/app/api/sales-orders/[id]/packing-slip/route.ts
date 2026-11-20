/**
 * Sales Order Packing Slip API Route (Nov 19 2026)
 *
 * GET /api/sales-orders/[id]/packing-slip
 * Packing slip of one sales order, no prices (Jenny / Ankur, Nov 19 2026).
 * Access: same as viewing the order (orders.view_detail, checked by getSalesOrder).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSalesOrder } from '@/features/sales-orders/actions';
import { generatePackingSlipPdf } from '@/features/sales-orders/services/packing-slip.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await getSalesOrder(id);
    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Sales order not found' },
        { status: 404 }
      );
    }

    const order = result.data;
    const pdfBase64 = await generatePackingSlipPdf(order);
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="PackingSlip-${order.orderNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating packing slip PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate packing slip' },
      { status: 500 }
    );
  }
}
