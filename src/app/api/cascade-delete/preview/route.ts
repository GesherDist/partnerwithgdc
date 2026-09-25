/**
 * Cascade Delete Preview API
 *
 * POST /api/cascade-delete/preview
 *
 * Returns count of records that will be deleted without actually deleting them
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  previewCascadeDelete,
  verifyEntityExists,
  type EntityType,
} from '@/features/shared/services/cascade-delete.service';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { entityType, entityId } = body;

    // Validate inputs
    if (!entityType || !entityId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: entityType, entityId',
        },
        { status: 400 }
      );
    }

    // Validate entity type
    const validTypes: EntityType[] = ['customer', 'quote', 'sales_order'];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(entityId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid UUID format for entityId',
        },
        { status: 400 }
      );
    }

    // Verify entity exists
    const verification = await verifyEntityExists(entityType, entityId);
    if (!verification.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error ||
            `${entityType.replace('_', ' ')} not found with ID: ${entityId}`,
        },
        { status: 404 }
      );
    }

    // Get preview counts
    const preview = await previewCascadeDelete(entityType, entityId);

    if (!preview.success) {
      return NextResponse.json(
        {
          success: false,
          error: preview.error || 'Failed to preview cascade delete',
        },
        { status: 500 }
      );
    }

    // Calculate total records
    const totalRecords = Object.values(preview.counts).reduce(
      (sum, count) => sum + count,
      0
    );

    return NextResponse.json({
      success: true,
      entityType,
      entityId,
      entityData: verification.data,
      counts: preview.counts,
      totalRecords,
    });
  } catch (error) {
    console.error('Preview cascade delete API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
