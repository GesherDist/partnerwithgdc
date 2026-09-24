-- ============================================
-- MIGRATION: 034_seed_module_permissions.sql
-- PURPOSE: Create hierarchical permissions for Dashboard, Quote, User, Audit, Settings modules
-- DATE: 2026
-- ============================================

-- ============================================
-- 0. DASHBOARD MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Dashboard Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('dashboard.view_module', 'View Dashboard Module', 'Dashboard Module', 'user', 0)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- 0.1 View Analytics (child of dashboard.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'dashboard.view_analytics', 'View Analytics & KPIs', 'Dashboard Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 0.2 View Sales Summary (child of dashboard.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'dashboard.view_sales', 'View Sales Summary', 'Dashboard Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 0.3 View Recent Activity (child of dashboard.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'dashboard.view_activity', 'View Recent Activity', 'Dashboard Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 0.4 Export Dashboard Data (child of dashboard.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'dashboard.export', 'Export Dashboard Data', 'Dashboard Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'dashboard.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 1. QUOTE MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Quote Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('quotes.view_module', 'View Quote Module', 'Quote Module', 'user', 1)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- 1.1 Create New Quote (child of quotes.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.create', 'Create New Quote', 'Quote Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.2 View Quote Detail (child of quotes.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.view_detail', 'View Quote Detail', 'Quote Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.3 Edit Quote Detail (child of quotes.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.edit', 'Edit Quote Detail', 'Quote Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.4 Delete Quote (child of quotes.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.delete', 'Delete Quote', 'Quote Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. USER MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Users Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('users.view_module', 'View Users Module', 'User Module', 'user', 2)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- 2.1 Create New User (child of users.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'users.create', 'Create New User', 'User Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'users.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2.2 Edit User (child of users.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'users.edit', 'Edit User', 'User Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'users.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2.3 Change User Role (child of users.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'users.change_role', 'Change User Role', 'User Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'users.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2.4 Reset User Password (child of users.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'users.reset_password', 'Reset User Password', 'User Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'users.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 2.5 Delete User (child of users.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'users.delete', 'Delete User', 'User Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'users.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 3. AUDIT LOG MODULE - Single Permission (no children)
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('audit.view_module', 'View Audit Log Module', 'Audit Module', 'user', 3)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 4. SETTINGS MODULE - Single Permission (no children)
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('settings.view_module', 'View Settings Module', 'Settings Module', 'user', 4)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
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
    'dashboard.view_module', 'dashboard.view_analytics', 'dashboard.view_sales', 'dashboard.view_activity', 'dashboard.export',
    'quotes.view_module', 'quotes.create', 'quotes.view_detail', 'quotes.edit', 'quotes.delete',
    'users.view_module', 'users.create', 'users.edit', 'users.change_role', 'users.reset_password', 'users.delete',
    'audit.view_module',
    'settings.view_module'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- CLEANUP: Remove old flat permissions if they exist
-- ============================================
-- Note: We keep them but update their parent_id if needed
-- If you want to delete old ones, uncomment below:
-- DELETE FROM permissions WHERE name IN ('users.view', 'quotes.view', 'audit.view', 'settings.view');
