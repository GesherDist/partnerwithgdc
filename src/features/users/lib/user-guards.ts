/**
 * Users Module - Route Permission Guards
 *
 * The Users API resolves its actor with resolveActor(); these helpers add the
 * permission checks on top. Super Admin bypasses every permission check, so
 * only a Super Admin may grant that role or act on a Super Admin account -
 * otherwise anyone with users.change_role or users.reset_password could take
 * over the system.
 */

import { db } from '@/shared/lib/supabase/database';
import { hasPermission, hasAnyPermission, isSuperAdmin, isSuperAdminRoleName } from '@/shared/lib/auth';
import { forbiddenResponse } from '@/shared/lib/api/response';
import type { AppUser } from '@/shared/stores/auth.store';
import { userService } from '../services/user.service';

/** 403 unless the actor has the permission */
export function denyWithout(actor: AppUser, permission: string): Response | null {
  return hasPermission(actor, permission)
    ? null
    : forbiddenResponse(`Permission denied: ${permission}`);
}

/** 403 unless the actor has any of the permissions */
export function denyWithoutAny(actor: AppUser, permissions: string[]): Response | null {
  return hasAnyPermission(actor, permissions)
    ? null
    : forbiddenResponse(`Permission denied: requires any of [${permissions.join(', ')}]`);
}

/** 403 when a non-super-admin tries to grant the Super Admin role */
export async function denySuperAdminRoleGrant(
  actor: AppUser,
  roleId: string | null | undefined
): Promise<Response | null> {
  if (!roleId || isSuperAdmin(actor)) {
    return null;
  }

  const { data: role } = await db.from('roles').select('name').eq('id', roleId).maybeSingle();

  return isSuperAdminRoleName(role?.name)
    ? forbiddenResponse('Only Super Admin can assign the Super Admin role')
    : null;
}

/** 403 when a non-super-admin tries to act on a Super Admin account */
export async function denySuperAdminTarget(
  actor: AppUser,
  targetUserId: string
): Promise<Response | null> {
  if (isSuperAdmin(actor)) {
    return null;
  }

  const target = await userService.getById(targetUserId);

  return isSuperAdminRoleName(target.data?.role?.name)
    ? forbiddenResponse('Only Super Admin can change a Super Admin account')
    : null;
}
