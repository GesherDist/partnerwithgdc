/**
 * Debug API - Check Role Permissions
 *
 * GET /api/debug/permissions
 *
 * Returns permission counts and details for each business role.
 * This is a debug endpoint - remove in production.
 */

import { NextResponse } from 'next/server';
import { db } from '@/shared/lib/supabase/database';

export async function GET() {
  try {
    // Get all roles with permission counts
    const { data: roles, error: rolesError } = await db
      .from('roles')
      .select('id, name')
      .in('name', ['Sales Rep', 'Sales Director', 'Operations', 'Finance', 'Management', 'super_admin'])
      .order('name');

    if (rolesError) {
      return NextResponse.json({ error: rolesError.message }, { status: 500 });
    }

    // Get permissions for each role
    const rolePermissions: Record<string, { count: number; permissions: string[] }> = {};

    for (const role of roles || []) {
      const { data: perms, error: permsError } = await db
        .from('role_permissions')
        .select('permissions:permission_id (name)')
        .eq('role_id', role.id);

      if (permsError) {
        rolePermissions[role.name] = { count: 0, permissions: [] };
        continue;
      }

      const permNames = (perms || [])
        .map((p) => {
          const perm = p.permissions as { name: string } | { name: string }[] | null;
          if (Array.isArray(perm)) return perm[0]?.name;
          return perm?.name;
        })
        .filter((name): name is string => Boolean(name))
        .sort();

      rolePermissions[role.name] = {
        count: permNames.length,
        permissions: permNames,
      };
    }

    // Summary
    const summary = Object.entries(rolePermissions).map(([role, data]) => ({
      role,
      permissionCount: data.count,
    }));

    return NextResponse.json({
      success: true,
      summary,
      details: rolePermissions,
    });
  } catch (error) {
    console.error('Debug permissions error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
