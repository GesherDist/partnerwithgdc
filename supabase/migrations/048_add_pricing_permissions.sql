-- ============================================
-- MIGRATION: 048_add_pricing_permissions.sql
-- PURPOSE: Create permissions for Price Matrix management
-- DATE: 2026
-- ============================================
-- Pricing permissions for managing channel-based product pricing.
-- These are children of products.view_module since pricing is
-- managed within the product context.
-- ============================================

-- ============================================
-- 1. PRICING PERMISSIONS
-- ============================================

-- pricing.view (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pricing.view', 'View Pricing', 'Products Module', 'user', p.id, 10
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- pricing.create (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pricing.create', 'Create Pricing', 'Products Module', 'user', p.id, 11
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- pricing.edit (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pricing.edit', 'Edit Pricing', 'Products Module', 'user', p.id, 12
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- pricing.delete (child of products.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'pricing.delete', 'Delete Pricing', 'Products Module', 'user', p.id, 13
FROM permissions p WHERE p.name = 'products.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. GRANT TO SUPER ADMIN
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN (
    'pricing.view', 'pricing.create', 'pricing.edit', 'pricing.delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 3. GRANT TO FINANCE ROLE (if exists)
-- ============================================
-- Finance users should be able to manage pricing

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND p.name IN (
    'pricing.view', 'pricing.create', 'pricing.edit', 'pricing.delete'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM role_permissions WHERE permission_id IN (
--   SELECT id FROM permissions WHERE name LIKE 'pricing.%'
-- );
-- DELETE FROM permissions WHERE name LIKE 'pricing.%';
