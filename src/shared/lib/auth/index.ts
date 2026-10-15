/**
 * Auth Library
 *
 * Server-side authentication utilities.
 */

export { getAppUserByAuthId } from './get-app-user';
export { getCachedProfile, setCachedProfile, clearCachedProfile } from './profile-cache';
export { refreshProfileCache } from './actions';

// Permission checking utilities
export {
  // Check functions
  isSuperAdmin,
  isSuperAdminRoleName,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  // Async check functions (fetches current user)
  getCurrentUser,
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  // Guard functions for API routes
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireSuperAdmin,
  // Response helpers
  forbiddenResponse,
  unauthorizedResponse,
  // Types
  type PermissionCheckResult,
} from './check-permission';
