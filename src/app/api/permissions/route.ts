/**
 * Permissions API Routes
 *
 * GET /api/permissions - Get all permissions
 * POST /api/permissions/seed - Seed default permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { permissionService } from '@/features/roles';
import { z } from 'zod';
import type { RoleScope } from '@/features/roles/types';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const querySchema = z.object({
  search: z.string().optional(),
  permissionType: z.enum(['user', 'customer', 'supplier']).optional(),
  groupName: z.string().optional(),
  grouped: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  hierarchical: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

// ============================================
// GET /api/permissions
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      search: searchParams.get('search') || undefined,
      permissionType: searchParams.get('permissionType') || undefined,
      groupName: searchParams.get('groupName') || undefined,
      grouped: searchParams.get('grouped') || undefined,
      hierarchical: searchParams.get('hierarchical') || undefined,
    });

    // Return hierarchical grouped permissions
    if (query.hierarchical) {
      const permissions = await permissionService.getPermissionsGroupedHierarchical(
        query.permissionType as RoleScope | undefined
      );
      return NextResponse.json({
        success: true,
        data: permissions,
      });
    }

    // Return flat grouped permissions
    if (query.grouped) {
      const permissions = await permissionService.getPermissionsGrouped(
        query.permissionType as RoleScope | undefined
      );
      return NextResponse.json({
        success: true,
        data: permissions,
      });
    }

    const permissions = await permissionService.getAllPermissions({
      search: query.search,
      permissionType: query.permissionType as RoleScope | undefined,
      groupName: query.groupName,
    });

    return NextResponse.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('GET /api/permissions error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch permissions',
      },
      { status: 500 }
    );
  }
}
