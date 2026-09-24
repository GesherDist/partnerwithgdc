/**
 * Packing List PDF API Route
 *
 * Generates and returns a PDF for a packing list.
 * GET /api/packing-lists/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPackingListPdfData } from '@/features/pick-tickets/actions/packing-list.actions';
import {
  generatePackingListPdf,
  type PackingListPdfData,
} from '@/features/pick-tickets/services/packing-list-pdf.service';
import { PACKING_LIST_STATUS_LABELS } from '@/features/pick-tickets/types';
import type { PickTicketPdfSalesOrderFields } from '@/features/pick-tickets/types';
import { db } from '@/shared/lib/supabase/database';

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
    const result = await getPackingListPdfData(id);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Packing list not found' },
        { status: result.error === 'Authentication required' ? 401 : 404 }
      );
    }

    const { packingList, salesOrder } = result.data;

    // Look up packed by user name
    let packedByName: string | null = null;
    if (packingList.packedBy) {
      const { data: userData } = await db
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', packingList.packedBy)
        .single();

      if (userData) {
        const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        packedByName = fullName || userData.email || null;
      }
    }

    const pdfData: PackingListPdfData = {
      packingListNumber: packingList.packingListNumber,
      createdAt: new Date(packingList.createdAt).toISOString(),
      status: PACKING_LIST_STATUS_LABELS[packingList.status] || packingList.status,
      packedAt: packingList.packedAt
        ? new Date(packingList.packedAt).toISOString()
        : null,
      packedBy: packedByName,

      pickTicketNumber: packingList.pickTicket?.pickTicketNumber || '-',
      salesOrderNumber: packingList.salesOrder?.orderNumber || '-',
      customerName: packingList.salesOrder?.customerName || 'Unknown Customer',
      customerPoNumber: salesOrder?.customer_po_number || null,
      shipToAddress: formatShipToAddress(salesOrder),
      shipmentNumber: packingList.shipment?.shipmentNumber || null,

      totalPackages: packingList.totalPackages,
      totalWeight: packingList.totalWeight,
      weightUnit: packingList.weightUnit || 'lbs',

      items: (packingList.items || [])
        .slice()
        .sort(
          (a, b) =>
            a.packageNumber - b.packageNumber || a.sortOrder - b.sortOrder
        )
        .map((item, index) => ({
          rowNum: index + 1,
          sku: item.sku,
          productName: item.description || item.sku,
          packageNumber: item.packageNumber,
          quantityPacked: item.quantityPacked,
          weight: item.weight,
        })),
      notes: packingList.notes,
    };

    const pdfBase64 = await generatePackingListPdf(pdfData);
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="PackingList-${packingList.packingListNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating packing list PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
