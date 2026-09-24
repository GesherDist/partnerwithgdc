/**
 * Role Module Types
 */

// ============================================
// ENUMS
// ============================================

/**
 * Role/Permission scope types
 */
export type RoleScope = 'user' | 'customer' | 'supplier';

// ============================================
// ENTITY TYPES
// ============================================

/**
 * Role entity
 */
export interface Role {
  id: string;
  scope: RoleScope;
  isSystemRole: boolean;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Permission entity
 */
export interface Permission {
  id: string;
  permissionType: RoleScope;
  parentId: string | null;
  name: string;
  groupName: string | null;
  sortOrder: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Permission with children for hierarchical display
 */
export interface HierarchicalPermission extends Permission {
  children: HierarchicalPermission[];
}

/**
 * Role-Permission junction
 */
export interface RolePermission {
  roleId: string;
  permissionId: string;
  isActive: boolean;
}

/**
 * Role with permissions included
 */
export interface RoleWithPermissions extends Role {
  rolePermissions: (RolePermission & {
    permission: Permission;
  })[];
  _count?: {
    users: number;
  };
}

/**
 * Permission grouped by group_name (flat structure)
 */
export interface PermissionGroup {
  groupName: string;
  permissions: Permission[];
}

/**
 * Permission grouped by group_name with hierarchy
 */
export interface HierarchicalPermissionGroup {
  groupName: string;
  permissions: HierarchicalPermission[];
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/**
 * Data for creating a new role
 */
export interface CreateRoleData {
  name: string;
  description?: string;
  scope?: RoleScope;
  isSystemRole?: boolean;
  permissionIds?: string[];
}

/**
 * Data for updating a role
 */
export interface UpdateRoleData {
  name?: string;
  description?: string;
  scope?: RoleScope;
  permissionIds?: string[];
}

/**
 * Data for creating a permission
 */
export interface CreatePermissionData {
  name: string;
  description?: string;
  permissionType?: RoleScope;
  groupName?: string;
  parentId?: string;
  sortOrder?: number;
}

/**
 * Data for updating a permission
 */
export interface UpdatePermissionData {
  name?: string;
  description?: string;
  groupName?: string;
  sortOrder?: number;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Role query filters
 */
export interface RoleQueryFilters {
  search?: string;
  scope?: RoleScope;
  isSystemRole?: boolean;
}

/**
 * Permission query filters
 */
export interface PermissionQueryFilters {
  search?: string;
  permissionType?: RoleScope;
  groupName?: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Role list item for display
 */
export interface RoleListItem {
  id: string;
  scope: RoleScope;
  isSystemRole: boolean;
  name: string;
  description: string | null;
  userCount: number;
  permissionCount: number;
  createdAt: Date;
}

/**
 * Role detail with all permissions
 */
export interface RoleDetail extends RoleListItem {
  permissions: Permission[];
}

/**
 * Permission matrix row
 */
export interface PermissionMatrixRow {
  permission: Permission;
  roleAssignments: Record<string, boolean>;
}
