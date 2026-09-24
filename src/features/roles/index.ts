/**
 * Role Module
 *
 * Manages roles and permissions for the application.
 */

// Types
export * from './types';

// Repositories
export { roleRepository, permissionRepository } from './repository';

// Services
export { roleService, permissionService } from './service';

// Hooks
export {
  useRoles,
  useRole,
  usePermissions,
  useSeedPermissions,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
} from './hooks';

// Components
export { RoleFormDialog } from './components';
