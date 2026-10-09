/**
 * Purchase Order Cascade Delete API
 *
 * DELETE /api/purchase-orders/:id/cascade-delete
 *
 * Deletes a purchase order and all related data (items, etc.)
 * Shipments linked to this PO are unlinked, not deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deletePurchaseOrderCascade,
  verifyEntityExists,
} from '@/features/shared/services/cascade-delete.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: purchaseOrderId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(purchaseOrderId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for purchase order ID',
        },
        { status: 400 }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { deleteAuditLogs = true } = body;

    // Verify purchase order exists
    const verification = await verifyEntityExists('purchase_order', purchaseOrderId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error || `Purchase order not found with ID: ${purchaseOrderId}`,
        },
        { status: 404 }
      );
    }

    // Execute cascade delete
    const result = await deletePurchaseOrderCascade(purchaseOrderId, {
      deleteAuditLogs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete purchase order',
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
      message: `Purchase order and all related data deleted successfully`,
      purchaseOrderId,
      poNumber: verification.data?.po_number,
      deletedCounts: result.deletedCounts,
      totalDeleted,
    });
  } catch (error) {
    console.error('Purchase order cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
