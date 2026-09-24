/**
 * Role Service
 *
 * Business logic for Role management.
 */

import { ValidationError, ConflictError } from '@/shared/lib/errors';
import { auditService } from '@/shared/lib/audit';
import { logger } from '@/shared/lib/logger';
import { roleRepository } from '../repository';
import type {
  Role,
  CreateRoleData,
  UpdateRoleData,
  RoleWithPermissions,
  RoleQueryFilters,
  RoleListItem,
  RoleDetail,
} from '../types';

/**
 * Service context for operations
 */
export interface ServiceContext {
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

class RoleServiceImpl {
  private readonly serviceName = 'RoleService';

  /**
   * Validate role creation data
   */
  private async validateCreate(data: CreateRoleData): Promise<void> {
    if (!data.name?.trim()) {
      throw ValidationError.required('name');
    }

    // Check name uniqueness
    const isUnique = await roleRepository.isNameUnique(data.name);
    if (!isUnique) {
      throw ConflictError.duplicate('name', data.name);
    }
  }

  /**
   * Validate role update data
   */
  private async validateUpdate(id: string, data: UpdateRoleData): Promise<void> {
    // Check if role exists and is not system role
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    if (existing.isSystemRole && data.name) {
      throw ValidationError.field('role', 'Cannot modify name of system roles');
    }

    // Check name uniqueness if changing
    if (data.name && data.name !== existing.name) {
      const isUnique = await roleRepository.isNameUnique(data.name, id);
      if (!isUnique) {
        throw ConflictError.duplicate('name', data.name);
      }
    }
  }

  /**
   * Get all roles with counts
   */
  async getAllRoles(filters?: RoleQueryFilters): Promise<RoleListItem[]> {
    return roleRepository.findAllWithCounts(filters);
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(id: string): Promise<RoleDetail | null> {
    const role = await roleRepository.findByIdWithPermissions(id);
    if (!role) {return null;}

    return {
      id: role.id,
      scope: role.scope,
      isSystemRole: role.isSystemRole,
      name: role.name,
      description: role.description,
      userCount: role._count?.users ?? 0,
      permissionCount: role.rolePermissions.length,
      createdAt: role.createdAt,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string): Promise<Role | null> {
    return roleRepository.findByName(name);
  }

  /**
   * Create a new role
   */
  async createRole(data: CreateRoleData, ctx?: ServiceContext): Promise<RoleWithPermissions> {
    logger.info(`${this.serviceName}.createRole`, { userId: ctx?.userId });

    // Validate
    await this.validateCreate(data);

    // Create role with permissions
    const role = await roleRepository.createWithPermissions(data, ctx?.userId);

    // Audit log
    await auditService.logCreate(
      'roles',
      'Role',
      role.id,
      {
        name: role.name,
        scope: role.scope,
        permissionCount: role.rolePermissions.length,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Update a role
   */
  async updateRole(
    id: string,
    data: UpdateRoleData,
    ctx?: ServiceContext
  ): Promise<RoleWithPermissions> {
    logger.info(`${this.serviceName}.updateRole`, { id, userId: ctx?.userId });

    // Get existing role
    const existing = await roleRepository.findByIdWithPermissions(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    // Validate
    await this.validateUpdate(id, data);

    // Update role with permissions
    const role = await roleRepository.updateWithPermissions(id, data, ctx?.userId);

    // Audit log
    await auditService.logUpdate(
      'roles',
      'Role',
      role.id,
      {
        name: existing.name,
        scope: existing.scope,
        permissionCount: existing.rolePermissions.length,
      },
      {
        name: role.name,
        scope: role.scope,
        permissionCount: role.rolePermissions.length,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Delete a role (soft delete)
   */
  async deleteRole(id: string, ctx?: ServiceContext): Promise<Role> {
    logger.info(`${this.serviceName}.deleteRole`, { id, userId: ctx?.userId });

    // Get existing role
    const existing = await roleRepository.findById(id);
    if (!existing) {
      throw ValidationError.field('id', 'Role not found');
    }

    // Check if system role
    if (existing.isSystemRole) {
      throw ValidationError.field('role', 'Cannot delete system roles');
    }

    // Check if role has users
    const hasUsers = await roleRepository.hasUsers(id);
    if (hasUsers) {
      throw ValidationError.field(
        'role',
        'Cannot delete role with assigned users. Please reassign users first.'
      );
    }

    // Soft delete
    const role = await roleRepository.delete(id, ctx?.userId);

    // Audit log
    await auditService.logDelete(
      'roles',
      'Role',
      role.id,
      {
        name: role.name,
        scope: role.scope,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return role;
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(roleId: string): Promise<string[]> {
    return roleRepository.getPermissions(roleId);
  }

  /**
   * Check if user has permission
   */
  async userHasPermission(_userId: string, _permissionName: string): Promise<boolean> {
    // This would typically check the user's role and its permissions
    // For now, return false - will be implemented when we integrate with user service
    return false;
  }
}

export const roleService = new RoleServiceImpl();
export { RoleServiceImpl };
