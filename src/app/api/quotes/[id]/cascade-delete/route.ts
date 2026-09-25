/**
 * Quote Cascade Delete API
 *
 * DELETE /api/quotes/:id/cascade-delete
 *
 * Deletes a quote and all related data (including created sales orders)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteQuoteCascade,
  verifyEntityExists,
} from '@/features/shared/services/cascade-delete.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(quoteId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for quote ID',
        },
        { status: 400 }
      );
    }

    // Parse request body for options
    const body = await req.json().catch(() => ({}));
    const { deleteAuditLogs = true } = body;

    // Verify quote exists
    const verification = await verifyEntityExists('quote', quoteId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error: verification.error || `Quote not found with ID: ${quoteId}`,
        },
        { status: 404 }
      );
    }

    // Execute cascade delete
    const result = await deleteQuoteCascade(quoteId, {
      deleteAuditLogs,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to delete quote',
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
      message: `Quote and all related data deleted successfully`,
      quoteId,
      quoteNumber: verification.data?.quote_number,
      deletedCounts: result.deletedCounts,
      totalDeleted,
    });
  } catch (error) {
    console.error('Quote cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
