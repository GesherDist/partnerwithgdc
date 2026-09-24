/**
 * Permission Service
 *
 * Business logic for Permission management.
 */

import { ValidationError } from '@/shared/lib/errors';
import { auditService } from '@/shared/lib/audit';
import { logger } from '@/shared/lib/logger';
import { permissionRepository } from '../repository';
import type {
  Permission,
  CreatePermissionData,
  PermissionQueryFilters,
  PermissionGroup,
  HierarchicalPermissionGroup,
  RoleScope,
} from '../types';

/**
 * Service context for operations
 */
export interface ServiceContext {
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

class PermissionServiceImpl {
  private readonly serviceName = 'PermissionService';

  /**
   * Get all permissions
   */
  async getAllPermissions(filters?: PermissionQueryFilters): Promise<Permission[]> {
    return permissionRepository.findAllFiltered(filters);
  }

  /**
   * Get permissions grouped by group_name (flat structure)
   */
  async getPermissionsGrouped(permissionType?: RoleScope): Promise<PermissionGroup[]> {
    return permissionRepository.findAllGroupedByModule(permissionType);
  }

  /**
   * Get permissions grouped by group_name with hierarchy
   */
  async getPermissionsGroupedHierarchical(permissionType?: RoleScope): Promise<HierarchicalPermissionGroup[]> {
    return permissionRepository.findAllGroupedByModuleHierarchical(permissionType);
  }

  /**
   * Get unique group names
   */
  async getGroupNames(): Promise<string[]> {
    return permissionRepository.getGroupNames();
  }

  /**
   * Get permission by name
   */
  async getByName(name: string): Promise<Permission | null> {
    return permissionRepository.findByName(name);
  }

  /**
   * Get permissions for a role
   */
  async getByRoleId(roleId: string): Promise<Permission[]> {
    return permissionRepository.getByRoleId(roleId);
  }

  /**
   * Get permission IDs for a role
   */
  async getIdsByRoleId(roleId: string): Promise<string[]> {
    return permissionRepository.getIdsByRoleId(roleId);
  }

  /**
   * Create permission
   */
  async createPermission(
    data: CreatePermissionData,
    ctx?: ServiceContext
  ): Promise<Permission> {
    logger.info(`${this.serviceName}.createPermission`, { userId: ctx?.userId });

    // Validate
    if (!data.name?.trim()) {
      throw ValidationError.required('name');
    }

    // Check uniqueness
    const isUnique = await permissionRepository.isNameUnique(data.name);
    if (!isUnique) {
      throw ValidationError.field('name', 'Permission with this name already exists');
    }

    // Create
    const permission = await permissionRepository.create(data);

    // Audit log
    await auditService.logCreate(
      'roles',
      'Permission',
      permission.id,
      {
        name: permission.name,
        permissionType: permission.permissionType,
        groupName: permission.groupName,
      },
      {
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      }
    );

    return permission;
  }

  /**
   * Seed default permissions
   */
  async seedDefaultPermissions(ctx?: ServiceContext): Promise<number> {
    logger.info(`${this.serviceName}.seedDefaultPermissions`, { userId: ctx?.userId });

    const defaultPermissions: CreatePermissionData[] = [
      // User permissions (for internal users)
      // Dashboard
      { name: 'dashboard.view', description: 'View Dashboard', groupName: 'Dashboard', permissionType: 'user', sortOrder: 1 },

      // Users
      { name: 'users.view', description: 'View Users', groupName: 'User Management', permissionType: 'user', sortOrder: 1 },
      { name: 'users.create', description: 'Create Users', groupName: 'User Management', permissionType: 'user', sortOrder: 2 },
      { name: 'users.edit', description: 'Edit Users', groupName: 'User Management', permissionType: 'user', sortOrder: 3 },
      { name: 'users.delete', description: 'Delete Users', groupName: 'User Management', permissionType: 'user', sortOrder: 4 },
      { name: 'users.export', description: 'Export Users', groupName: 'User Management', permissionType: 'user', sortOrder: 5 },

      // Roles
      { name: 'roles.view', description: 'View Roles', groupName: 'Role Management', permissionType: 'user', sortOrder: 1 },
      { name: 'roles.create', description: 'Create Roles', groupName: 'Role Management', permissionType: 'user', sortOrder: 2 },
      { name: 'roles.edit', description: 'Edit Roles', groupName: 'Role Management', permissionType: 'user', sortOrder: 3 },
      { name: 'roles.delete', description: 'Delete Roles', groupName: 'Role Management', permissionType: 'user', sortOrder: 4 },
      { name: 'roles.manage', description: 'Manage Role Permissions', groupName: 'Role Management', permissionType: 'user', sortOrder: 5 },

      // Permissions
      { name: 'permissions.view', description: 'View Permissions', groupName: 'Permission Management', permissionType: 'user', sortOrder: 1 },
      { name: 'permissions.manage', description: 'Manage Permissions', groupName: 'Permission Management', permissionType: 'user', sortOrder: 2 },

      // Audit Logs
      { name: 'audit.view', description: 'View Audit Logs', groupName: 'Audit', permissionType: 'user', sortOrder: 1 },
      { name: 'audit.export', description: 'Export Audit Logs', groupName: 'Audit', permissionType: 'user', sortOrder: 2 },

      // Settings
      { name: 'settings.view', description: 'View Settings', groupName: 'Settings', permissionType: 'user', sortOrder: 1 },
      { name: 'settings.edit', description: 'Edit Settings', groupName: 'Settings', permissionType: 'user', sortOrder: 2 },

      // Products
      // Hierarchical names - see migration 039_seed_product_permissions.sql
      { name: 'products.view_module', description: 'View Product Module', groupName: 'Products Module', permissionType: 'user', sortOrder: 0 },
      { name: 'products.view_detail', description: 'View Product Detail', groupName: 'Products Module', permissionType: 'user', sortOrder: 1 },
      { name: 'products.create', description: 'Create New Product', groupName: 'Products Module', permissionType: 'user', sortOrder: 2 },
      { name: 'products.edit', description: 'Edit Product', groupName: 'Products Module', permissionType: 'user', sortOrder: 3 },
      { name: 'products.delete', description: 'Delete Product', groupName: 'Products Module', permissionType: 'user', sortOrder: 4 },

      // Customers
      { name: 'customers.view', description: 'View Customers', groupName: 'Customers', permissionType: 'user', sortOrder: 1 },
      { name: 'customers.create', description: 'Create Customers', groupName: 'Customers', permissionType: 'user', sortOrder: 2 },
      { name: 'customers.edit', description: 'Edit Customers', groupName: 'Customers', permissionType: 'user', sortOrder: 3 },
      { name: 'customers.delete', description: 'Delete Customers', groupName: 'Customers', permissionType: 'user', sortOrder: 4 },

      // Orders
      { name: 'orders.view', description: 'View Orders', groupName: 'Orders', permissionType: 'user', sortOrder: 1 },
      { name: 'orders.create', description: 'Create Orders', groupName: 'Orders', permissionType: 'user', sortOrder: 2 },
      { name: 'orders.edit', description: 'Edit Orders', groupName: 'Orders', permissionType: 'user', sortOrder: 3 },
      { name: 'orders.delete', description: 'Delete Orders', groupName: 'Orders', permissionType: 'user', sortOrder: 4 },
      { name: 'orders.approve', description: 'Approve Orders', groupName: 'Orders', permissionType: 'user', sortOrder: 5 },

      // Inventory
      { name: 'inventory.view', description: 'View Inventory', groupName: 'Inventory', permissionType: 'user', sortOrder: 1 },
      { name: 'inventory.manage', description: 'Manage Inventory', groupName: 'Inventory', permissionType: 'user', sortOrder: 2 },
      { name: 'inventory.adjust', description: 'Adjust Inventory', groupName: 'Inventory', permissionType: 'user', sortOrder: 3 },

      // Reports
      { name: 'reports.view', description: 'View Reports', groupName: 'Reports', permissionType: 'user', sortOrder: 1 },
      { name: 'reports.export', description: 'Export Reports', groupName: 'Reports', permissionType: 'user', sortOrder: 2 },

      // Customer permissions (for external customers)
      // Customer Dashboard
      { name: 'customer.dashboard.view', description: 'View Customer Dashboard', groupName: 'Customer Dashboard', permissionType: 'customer', sortOrder: 1 },

      // Customer Orders
      { name: 'customer.orders.view', description: 'View My Orders', groupName: 'Customer Orders', permissionType: 'customer', sortOrder: 1 },
      { name: 'customer.orders.create', description: 'Place Orders', groupName: 'Customer Orders', permissionType: 'customer', sortOrder: 2 },
      { name: 'customer.orders.cancel', description: 'Cancel Orders', groupName: 'Customer Orders', permissionType: 'customer', sortOrder: 3 },

      // Customer Products
      { name: 'customer.products.view', description: 'View Products Catalog', groupName: 'Customer Products', permissionType: 'customer', sortOrder: 1 },

      // Customer Profile
      { name: 'customer.profile.view', description: 'View My Profile', groupName: 'Customer Profile', permissionType: 'customer', sortOrder: 1 },
      { name: 'customer.profile.edit', description: 'Edit My Profile', groupName: 'Customer Profile', permissionType: 'customer', sortOrder: 2 },
    ];

    const count = await permissionRepository.createMany(defaultPermissions);

    if (count > 0) {
      await auditService.log({
        action: 'import',
        module: 'roles',
        entityType: 'Permission',
        description: `Seeded ${count} default permissions`,
        metadata: { count },
        userId: ctx?.userId,
        requestId: ctx?.requestId,
      });
    }

    return count;
  }
}

export const permissionService = new PermissionServiceImpl();
export { PermissionServiceImpl };
