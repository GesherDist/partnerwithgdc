/**
 * Seed Permissions API Route
 *
 * POST /api/permissions/seed - Seed default permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { permissionService } from '@/features/roles';

// ============================================
// POST /api/permissions/seed
// ============================================

export async function POST(_request: NextRequest) {
  try {
    // TODO: Get user ID from session and check admin permission
    const ctx = {
      userId: undefined,
      requestId: crypto.randomUUID(),
    };

    const count = await permissionService.seedDefaultPermissions(ctx);

    return NextResponse.json({
      success: true,
      message: `Seeded ${count} permissions`,
      data: { count },
    });
  } catch (error) {
    console.error('POST /api/permissions/seed error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to seed permissions',
      },
      { status: 500 }
    );
  }
}
