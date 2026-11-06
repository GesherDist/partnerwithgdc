/**
 * Purchase Order PDF API Route (Ankur's email, Nov 6 2026: view / download a PO as PDF)
 *
 * GET /api/purchase-orders/[id]/pdf
 * Same pattern as /api/sales-orders/[id]/pdf. Access is checked by
 * getPurchaseOrder (purchase_orders.view_detail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPurchaseOrder } from '@/features/purchase-orders/actions';
import { generatePurchaseOrderPdf, purchaseOrderPdfFileName } from '@/features/purchase-orders/services/pdf.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPurchaseOrder(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Purchase order not found' },
        { status: 404 }
      );
    }

    const po = result.data;
    const pdfBuffer = Buffer.from(await generatePurchaseOrderPdf(po), 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${purchaseOrderPdfFileName(po.poNumber)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating purchase order PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
