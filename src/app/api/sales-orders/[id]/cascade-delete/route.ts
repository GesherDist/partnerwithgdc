/**
 * Sales Order Cascade Delete API
 *
 * DELETE /api/sales-orders/:id/cascade-delete
 *
 * Deletes a sales order and all related data (pick tickets, packing lists, shipments, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteSalesOrderCascade,
  verifyEntityExists,
} from '@/features/shared/services/cascade-delete.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: salesOrderId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(salesOrderId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for sales order ID',
        },
        { status: 400 }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { deleteAuditLogs = true } = body;

    // Verify sales order exists
    const verification = await verifyEntityExists('sales_order', salesOrderId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error ||
            `Sales order not found with ID: ${salesOrderId}`,
        },
        { status: 404 }
      );
    }

    // Execute cascade delete
    const result = await deleteSalesOrderCascade(salesOrderId, {
      deleteAuditLogs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete sales order',
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
      message: `Sales order and all related data deleted successfully`,
      salesOrderId,
      orderNumber: verification.data?.order_number,
      deletedCounts: result.deletedCounts,
      totalDeleted,
    });
  } catch (error) {
    console.error('Sales order cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
