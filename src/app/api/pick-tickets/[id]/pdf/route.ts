/**
 * Pick Ticket PDF API Route
 *
 * Generates and returns a PDF for a pick ticket.
 * GET /api/pick-tickets/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPickTicketPdfData } from '@/features/pick-tickets/actions';
import {
  generatePickTicketPdf,
  type PickTicketPdfData,
} from '@/features/pick-tickets/services/pdf.service';
import type { PickTicketPdfSalesOrderFields } from '@/features/pick-tickets/types';

/**
 * Build a single-line ship-to address from the sales order columns.
 */
function formatShipToAddress(order: PickTicketPdfSalesOrderFields | null): string {
  if (!order) {
    return '-';
  }

  const parts = [
    order.shipping_address_street,
    order.shipping_address_city,
    order.shipping_address_state,
    order.shipping_address_postal_code,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length > 0 ? parts.join(', ') : '-';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // The action enforces pick_tickets.view / .edit
    const result = await getPickTicketPdfData(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Pick ticket not found' },
        { status: result.error === 'Authentication required' ? 401 : 404 }
      );
    }

    const { pickTicket, salesOrder } = result.data;

    const assignedTo = pickTicket.assignedUser
      ? `${pickTicket.assignedUser.firstName || ''} ${pickTicket.assignedUser.lastName || ''}`.trim() ||
        pickTicket.assignedUser.email
      : null;

    // Fetch product weights for weight calculation
    const { db } = await import('@/shared/lib/supabase/database');
    const productIds = (pickTicket.items || []).map((item) => item.productId);
    const { data: products } = await db
      .from('products')
      .select('id, weight_lbs')
      .in('id', productIds);

    // Create a map of productId -> weight_lbs
    const productWeightMap = new Map<string, number>();
    if (products) {
      products.forEach((product) => {
        if (product.weight_lbs) {
          productWeightMap.set(product.id, product.weight_lbs);
        }
      });
    }

    // Calculate total weight
    let totalWeight = 0;
    const itemsWithWeights = (pickTicket.items || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item, index) => {
        const productWeight = productWeightMap.get(item.productId) || 0;
        const itemWeight = item.quantityToPick * productWeight;
        totalWeight += itemWeight;

        return {
          rowNum: index + 1,
          sku: item.sku,
          productName: item.description || item.sku,
          binLocation: item.binLocation || undefined,
          quantity: item.quantityToPick,
          uom: 'EA',
          weight: itemWeight > 0 ? itemWeight : undefined,
        };
      });

    const pdfData: PickTicketPdfData = {
      pickTicketNumber: pickTicket.pickTicketNumber,
      createdAt: new Date(pickTicket.createdAt).toISOString(),
      salesOrderNumber: pickTicket.salesOrder?.orderNumber || '-',
      customerName: pickTicket.salesOrder?.customerName || 'Unknown Customer',
      shipToAddress: formatShipToAddress(salesOrder),
      requiredDate: salesOrder?.requested_delivery_date || null,
      shippingMethod: salesOrder?.shipping_method || null,
      warehouseName: pickTicket.warehouse?.name || '-',
      warehouseCode: pickTicket.warehouse?.code || '-',
      assignedTo,
      status: pickTicket.status,
      customerPoNumber: salesOrder?.customer_po_number || null,
      notes: pickTicket.notes || pickTicket.specialInstructions || null,
      totalWeight: totalWeight > 0 ? totalWeight : undefined,
      items: itemsWithWeights,
    };

    const pdfBase64 = await generatePickTicketPdf(pdfData);
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="PickTicket-${pickTicket.pickTicketNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating pick ticket PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
