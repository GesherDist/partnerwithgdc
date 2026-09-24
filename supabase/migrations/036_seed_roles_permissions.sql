-- ============================================
-- MIGRATION: 036_seed_roles_permissions.sql
-- PURPOSE: Create hierarchical permissions for Roles module
-- DATE: 2026
-- ============================================

-- ============================================
-- ROLES MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Role & Permission Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('roles.view_module', 'View Role & Permission Module', 'Roles Module', 'user', 5)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- 1. Create New Role (child of roles.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'roles.create', 'Create New Role', 'Roles Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'roles.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2. Edit Role (child of roles.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'roles.edit', 'Edit Role', 'Roles Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'roles.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 3. Delete Role (child of roles.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'roles.delete', 'Delete Role', 'Roles Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'roles.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 4. Update Role Permissions (child of roles.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'roles.update_permission', 'Update Role Permissions', 'Roles Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'roles.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- GRANT ALL NEW PERMISSIONS TO SUPER ADMIN
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'roles.view_module', 'roles.create', 'roles.edit', 'roles.delete', 'roles.update_permission'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
