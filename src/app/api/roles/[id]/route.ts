/**
 * Role API Routes - Individual Role
 *
 * GET /api/roles/[id] - Get role by ID
 * PATCH /api/roles/[id] - Update role
 * DELETE /api/roles/[id] - Delete role
 */

import { NextRequest, NextResponse } from 'next/server';
import { roleService } from '@/features/roles';
import { ValidationError, AppError, NotFoundError } from '@/shared/lib/errors';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scope: z.enum(['user', 'customer']).optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

// ============================================
// GET /api/roles/[id]
// ============================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const role = await roleService.getRoleById(id);

    if (!role) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: role,
    });
  } catch (error) {
    console.error('GET /api/roles/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch role',
      },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/roles/[id]
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    // TODO: Get user ID from session
    const ctx = {
      userId: undefined,
      requestId: crypto.randomUUID(),
    };

    const role = await roleService.updateRole(id, data, ctx);

    // Create response
    const response = NextResponse.json({
      success: true,
      data: role,
      message: 'Role updated successfully',
    });

    // Clear cached profile when permissions change
    // Explicitly delete cookie in response headers to ensure browser receives it
    if (data.permissionIds) {
      response.cookies.delete('app_user_profile');
    }

    return response;
  } catch (error) {
    console.error('PATCH /api/roles/[id] error:', error);

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

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
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
        error: 'Failed to update role',
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/roles/[id]
// ============================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // TODO: Get user ID from session
    const ctx = {
      userId: undefined,
      requestId: crypto.randomUUID(),
    };

    await roleService.deleteRole(id, ctx);

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('DELETE /api/roles/[id] error:', error);

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

    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
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
        error: 'Failed to delete role',
      },
      { status: 500 }
    );
  }
}
