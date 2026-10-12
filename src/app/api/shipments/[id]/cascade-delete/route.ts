/**
 * Shipment Cascade Delete API
 *
 * DELETE /api/shipments/:id/cascade-delete
 *
 * Deletes a shipment and all related data (items, status history, etc.)
 * Shipping emails, packing lists, and invoices are unlinked, not deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteShipmentCascade,
  verifyEntityExists,
} from '@/features/shared/services/cascade-delete.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shipmentId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shipmentId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for shipment ID',
        },
        { status: 400 }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { deleteAuditLogs = true } = body;

    // Verify shipment exists
    const verification = await verifyEntityExists('shipment', shipmentId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error || `Shipment not found with ID: ${shipmentId}`,
        },
        { status: 404 }
      );
    }

    // Execute cascade delete
    const result = await deleteShipmentCascade(shipmentId, {
      deleteAuditLogs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete shipment',
        },
        { status: 500 }
      );
    }

    // Calculate total deleted
    const totalDeleted = Object.values(result.deletedCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return NextResponse.json({
      success: true,
      message: `Shipment and all related data deleted successfully`,
      shipmentId,
      shipmentNumber: verification.data?.shipment_number,
      deletedCounts: result.deletedCounts,
      totalDeleted,
    });
  } catch (error) {
    console.error('Shipment cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
