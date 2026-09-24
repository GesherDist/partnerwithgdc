/**
 * Permission Repository
 *
 * Data access layer for Permission entity using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Permission,
  CreatePermissionData,
  UpdatePermissionData,
  PermissionQueryFilters,
  PermissionGroup,
  HierarchicalPermission,
  HierarchicalPermissionGroup,
  RoleScope,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbPermission {
  id: string;
  permission_type: 'user' | 'customer';
  parent_id: string | null;
  name: string;
  group_name: string | null;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// REPOSITORY
// ============================================

class PermissionRepositoryImpl {
  /**
   * Find permission by ID
   */
  async findById(id: string): Promise<Permission | null> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return data ? this.mapToPermission(data as DbPermission) : null;
  }

  /**
   * Find permission by name
   */
  async findByName(name: string): Promise<Permission | null> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch permission: ${error.message}`);
    }

    return data ? this.mapToPermission(data as DbPermission) : null;
  }

  /**
   * Find permissions by group name
   */
  async findByGroupName(groupName: string): Promise<Permission[]> {
    const { data, error } = await db
      .from('permissions')
      .select('*')
      .eq('group_name', groupName)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return (data || []).map((p) => this.mapToPermission(p as DbPermission));
  }

  /**
   * Get all permissions grouped by group_name (flat structure)
   */
  async findAllGroupedByModule(permissionType?: RoleScope): Promise<PermissionGroup[]> {
    let query = db
      .from('permissions')
      .select('*')
      .order('group_name', { ascending: true })
      .order('sort_order', { ascending: true });

    if (permissionType) {
      query = query.eq('permission_type', permissionType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    const grouped: Record<string, Permission[]> = {};

    for (const permission of data || []) {
      const perm = this.mapToPermission(permission as DbPermission);
      const groupKey = perm.groupName || 'Other';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(perm);
    }

    return Object.entries(grouped).map(([groupName, permissions]) => ({
      groupName,
      permissions,
    }));
  }

  /**
   * Get all permissions with filters
   */
  async findAllFiltered(filters?: PermissionQueryFilters): Promise<Permission[]> {
    let query = db
      .from('permissions')
      .select('*');

    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters?.permissionType) {
      query = query.eq('permission_type', filters.permissionType);
    }

    if (filters?.groupName) {
      query = query.eq('group_name', filters.groupName);
    }

    query = query.order('group_name', { ascending: true }).order('sort_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return (data || []).map((p) => this.mapToPermission(p as DbPermission));
  }

  /**
   * Find all permissions
   */
  async findAll(): Promise<Permission[]> {
    return this.findAllFiltered();
  }

  /**
   * Get unique group names
   */
  async getGroupNames(): Promise<string[]> {
    const { data, error } = await db
      .from('permissions')
      .select('group_name')
      .not('group_name', 'is', null)
      .order('group_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch group names: ${error.message}`);
    }

    // Get unique group names
    const groups = [...new Set((data || []).filter((r) => r.group_name).map((r) => r.group_name as string))];
    return groups;
  }

  /**
   * Create a permission
   */
  async create(data: CreatePermissionData): Promise<Permission> {
    const { data: result, error } = await db
      .from('permissions')
      .insert({
        name: data.name,
        description: data.description ?? null,
        permission_type: data.permissionType ?? 'user',
        group_name: data.groupName ?? null,
        parent_id: data.parentId ?? null,
        sort_order: data.sortOrder ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create permission: ${error.message}`);
    }

    return this.mapToPermission(result as DbPermission);
  }

  /**
   * Create multiple permissions
   */
  async createMany(permissions: CreatePermissionData[]): Promise<number> {
    if (permissions.length === 0) {return 0;}

    const { data, error } = await db
      .from('permissions')
      .upsert(
        permissions.map((p) => ({
          name: p.name,
          description: p.description ?? null,
          permission_type: p.permissionType ?? 'user',
          group_name: p.groupName ?? null,
          parent_id: p.parentId ?? null,
          sort_order: p.sortOrder ?? 0,
        })),
        { onConflict: 'name', ignoreDuplicates: true }
      )
      .select();

    if (error) {
      throw new Error(`Failed to create permissions: ${error.message}`);
    }

    return data?.length ?? 0;
  }

  /**
   * Update a permission
   */
  async update(id: string, data: UpdatePermissionData): Promise<Permission> {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) {updateData.name = data.name;}
    if (data.description !== undefined) {updateData.description = data.description;}
    if (data.groupName !== undefined) {updateData.group_name = data.groupName;}
    if (data.sortOrder !== undefined) {updateData.sort_order = data.sortOrder;}

    const { data: result, error } = await db
      .from('permissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update permission: ${error.message}`);
    }

    return this.mapToPermission(result as DbPermission);
  }

  /**
   * Delete a permission (hard delete)
   */
  async delete(id: string): Promise<void> {
    const { error } = await db
      .from('permissions')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete permission: ${error.message}`);
    }
  }

  /**
   * Check if permission name is unique
   */
  async isNameUnique(name: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('permissions')
      .select('id', { count: 'exact', head: true })
      .eq('name', name);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check name: ${error.message}`);
    }

    return (count ?? 0) === 0;
  }

  /**
   * Get permissions for a role
   */
  async getByRoleId(roleId: string): Promise<Permission[]> {
    const { data, error } = await db
      .from('role_permissions')
      .select(`
        permissions:permission_id (*)
      `)
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to get permissions: ${error.message}`);
    }

    return (data || [])
      .filter((r) => r.permissions)
      .map((r) => {
        const perm = r.permissions as DbPermission | DbPermission[];
        const permData = Array.isArray(perm) ? perm[0] : perm;
        return permData ? this.mapToPermission(permData) : null;
      })
      .filter((p): p is Permission => p !== null);
  }

  /**
   * Get permission IDs for a role
   */
  async getIdsByRoleId(roleId: string): Promise<string[]> {
    const { data, error } = await db
      .from('role_permissions')
      .select('permission_id')
      .eq('role_id', roleId);

    if (error) {
      throw new Error(`Failed to get permission IDs: ${error.message}`);
    }

    return (data || []).map((rp) => rp.permission_id);
  }

  /**
   * Map database row to Permission type
   */
  private mapToPermission(data: DbPermission): Permission {
    return {
      id: data.id,
      permissionType: data.permission_type,
      parentId: data.parent_id,
      name: data.name,
      groupName: data.group_name,
      sortOrder: data.sort_order ?? 0,
      description: data.description,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Build hierarchical structure from flat permissions
   */
  private buildHierarchy(permissions: Permission[]): HierarchicalPermission[] {
    const permissionMap = new Map<string, HierarchicalPermission>();
    const roots: HierarchicalPermission[] = [];

    // First pass: create all nodes with empty children
    for (const perm of permissions) {
      permissionMap.set(perm.id, { ...perm, children: [] });
    }

    // Second pass: build parent-child relationships
    for (const perm of permissions) {
      const node = permissionMap.get(perm.id)!;
      if (perm.parentId && permissionMap.has(perm.parentId)) {
        const parent = permissionMap.get(perm.parentId)!;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Sort children by sortOrder
    const sortChildren = (nodes: HierarchicalPermission[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      for (const node of nodes) {
        if (node.children.length > 0) {
          sortChildren(node.children);
        }
      }
    };

    sortChildren(roots);
    return roots;
  }

  /**
   * Get all permissions grouped by group_name with hierarchy
   * Groups are sorted by the minimum sort_order of their root (parentId = null) permissions
   */
  async findAllGroupedByModuleHierarchical(permissionType?: RoleScope): Promise<HierarchicalPermissionGroup[]> {
    let query = db
      .from('permissions')
      .select('*')
      .order('sort_order', { ascending: true });

    if (permissionType) {
      query = query.eq('permission_type', permissionType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    // Group by group_name first
    const grouped: Record<string, Permission[]> = {};
    // Track minimum sort_order of root permissions for each group
    const groupSortOrder: Record<string, number> = {};

    for (const permission of data || []) {
      const perm = this.mapToPermission(permission as DbPermission);
      const groupKey = perm.groupName || 'Other';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
        groupSortOrder[groupKey] = Infinity;
      }
      grouped[groupKey]!.push(perm);

      // Track minimum sort_order of root permissions (no parent)
      if (!perm.parentId && perm.sortOrder < groupSortOrder[groupKey]!) {
        groupSortOrder[groupKey] = perm.sortOrder;
      }
    }

    // Build hierarchy for each group and sort groups by their root permission sort_order
    const groups = Object.entries(grouped).map(([groupName, permissions]) => ({
      groupName,
      permissions: this.buildHierarchy(permissions),
      sortOrder: groupSortOrder[groupName] ?? Infinity,
    }));

    // Sort groups by sortOrder then remove the sortOrder property
    groups.sort((a, b) => a.sortOrder - b.sortOrder);

    return groups.map(({ groupName, permissions }) => ({
      groupName,
      permissions,
    }));
  }
}

export const permissionRepository = new PermissionRepositoryImpl();
export { PermissionRepositoryImpl };
