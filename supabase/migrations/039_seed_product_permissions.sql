-- ============================================
-- MIGRATION: 039_seed_product_permissions.sql
-- PURPOSE: Create hierarchical permissions for the Products module
-- DATE: 2026
-- ============================================
-- The Products module was still on the flat `products.view` permission from the
-- legacy seeder, while the sidebar and page guards expect the hierarchical
-- `<module>.view_module` shape used by every other module (see 034 / 036).
--
-- This migration:
--   1. Creates products.view_module and products.view_detail
--   2. Re-parents the existing products.create / edit / delete underneath it
--   3. Carries over grants from the old products.view, then drops it
--   4. Grants the full set to super_admin
-- ============================================

-- ============================================
-- 1. PRODUCTS MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Product Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('products.view_module', 'View Product Module', 'Products Module', 'user', 2)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- 1.1 View Product Detail (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'products.view_detail', 'View Product Detail', 'Products Module', 'user', p.id, 1
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.2 Create Product (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'products.create', 'Create New Product', 'Products Module', 'user', p.id, 2
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.3 Edit Product (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'products.edit', 'Edit Product', 'Products Module', 'user', p.id, 3
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- 1.4 Delete Product (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'products.delete', 'Delete Product', 'Products Module', 'user', p.id, 4
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. MIGRATE GRANTS FROM THE OLD FLAT PERMISSION
-- ============================================
-- Any role that could previously view products keeps that access under the
-- new names, so no role loses the module when this migration runs.

INSERT INTO role_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM role_permissions rp
JOIN permissions old ON old.id = rp.permission_id AND old.name = 'products.view'
CROSS JOIN permissions target
WHERE target.name IN ('products.view_module', 'products.view_detail')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- The old permission is now unused by the application. Dropping it also removes
-- its role_permissions rows (ON DELETE CASCADE).
DELETE FROM permissions WHERE name = 'products.view';

-- ============================================
-- 3. GRANT THE FULL SET TO SUPER ADMIN
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'products.view_module', 'products.view_detail',
    'products.create', 'products.edit', 'products.delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
--   INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
--   VALUES ('products.view', 'View Products', 'Products', 'user', 1)
--   ON CONFLICT (name) DO NOTHING;
--   DELETE FROM permissions WHERE name IN ('products.view_module', 'products.view_detail');
--   UPDATE permissions SET parent_id = NULL
--   WHERE name IN ('products.create', 'products.edit', 'products.delete');
