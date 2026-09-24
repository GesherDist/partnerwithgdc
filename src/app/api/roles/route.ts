/**
 * Roles API Routes
 *
 * GET /api/roles - Get all roles
 * POST /api/roles - Create a new role
 */

import { NextRequest, NextResponse } from 'next/server';
import { roleService } from '@/features/roles';
import { ValidationError, AppError } from '@/shared/lib/errors';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  scope: z.enum(['user', 'customer']).optional().default('user'),
  permissionIds: z.array(z.string().uuid()).optional(),
});

const querySchema = z.object({
  search: z.string().optional(),
  isSystemRole: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
});

// ============================================
// GET /api/roles
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      search: searchParams.get('search') || undefined,
      isSystemRole: searchParams.get('isSystemRole') || undefined,
    });

    const roles = await roleService.getAllRoles(query);

    return NextResponse.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    console.error('GET /api/roles error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch roles',
      },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/roles
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createRoleSchema.parse(body);

    // TODO: Get user ID from session
    const ctx = {
      userId: undefined,
      requestId: crypto.randomUUID(),
    };

    const role = await roleService.createRole(data, ctx);

    return NextResponse.json(
      {
        success: true,
        data: role,
        message: 'Role created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/roles error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          fields: error.fields,
        },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create role',
      },
      { status: 500 }
    );
  }
}
