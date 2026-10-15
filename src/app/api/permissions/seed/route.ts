/**
 * Seed Permissions API Route
 *
 * POST /api/permissions/seed - Seed default permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { permissionService } from '@/features/roles';
import { requireSuperAdmin } from '@/shared/lib/auth';

// ============================================
// POST /api/permissions/seed
// ============================================

export async function POST(_request: NextRequest) {
  try {
    const guard = await requireSuperAdmin();
    if (guard.response) {return guard.response;}

    const ctx = {
      userId: guard.user.id,
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
