/**
 * Cascade Delete Preview API
 *
 * POST /api/cascade-delete/preview
 *
 * Returns count of records that will be deleted without actually deleting them
 * Accepts entity numbers (e.g., PO-2600064, CUST-GALILEO) instead of UUIDs
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  previewCascadeDelete,
  verifyEntityExistsByNumber,
  type EntityType,
} from '@/features/shared/services/cascade-delete.service';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const { entityType, entityNumber } = body;

    // Validate inputs
    if (!entityType || !entityNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: entityType, entityNumber',
        },
        { status: 400 }
      );
    }

    // Validate entity type
    const validTypes: EntityType[] = [
      'customer',
      'quote',
      'sales_order',
      'purchase_order',
      'shipment',
    ];
    if (!validTypes.includes(entityType)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid entity type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Verify entity exists by number and get UUID
    const verification = await verifyEntityExistsByNumber(entityType, entityNumber);
    if (!verification.exists || !verification.entityId) {
      return NextResponse.json(
        {
          success: false,
          error:
            verification.error ||
            `${entityType.replace('_', ' ')} not found with number: ${entityNumber}`,
        },
        { status: 404 }
      );
    }

    // Get preview counts using UUID
    const preview = await previewCascadeDelete(entityType, verification.entityId);

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
      entityNumber,
      entityId: verification.entityId,
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
