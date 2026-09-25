/**
 * Customer Cascade Delete API
 *
 * DELETE /api/customers/:customerId/cascade-delete
 *
 * Deletes a customer and all related data (quotes, sales orders, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteCustomerCascade,
  verifyEntityExists,
} from '@/features/shared/services/cascade-delete.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const { customerId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(customerId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for customer ID',
        },
        { status: 400 }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { deleteAuditLogs = true } = body;

    // Verify customer exists
    const verification = await verifyEntityExists('customer', customerId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error || `Customer not found with ID: ${customerId}`,
        },
        { status: 404 }
      );
    }

    // Execute cascade delete
    const result = await deleteCustomerCascade(customerId, {
      deleteAuditLogs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete customer',
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
      message: `Customer and all related data deleted successfully`,
      customerId,
      customerName: verification.data?.name,
      deletedCounts: result.deletedCounts,
      totalDeleted,
    });
  } catch (error) {
    console.error('Customer cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
