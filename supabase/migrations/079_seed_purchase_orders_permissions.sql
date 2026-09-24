-- ============================================
-- MIGRATION: 079_seed_purchase_orders_permissions.sql
-- PURPOSE: Create permissions for Purchase Orders module
-- DATE: 2025-08-17
-- ============================================

-- ============================================
-- PURCHASE ORDERS MODULE - Hierarchical Permissions
-- ============================================

-- Parent: View Purchase Orders Module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('purchase_orders.view_module', 'View Purchase Orders Module', 'Purchase Orders', 'user', 1)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  group_name = EXCLUDED.group_name,
  sort_order = EXCLUDED.sort_order;

-- View PO Detail (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.view_detail', 'View Purchase Order Detail', 'Purchase Orders', 'user', p.id, 1
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Create PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.create', 'Create Purchase Order', 'Purchase Orders', 'user', p.id, 2
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Edit PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.edit', 'Edit Purchase Order', 'Purchase Orders', 'user', p.id, 3
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Delete PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.delete', 'Delete Purchase Order', 'Purchase Orders', 'user', p.id, 4
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Send PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.send', 'Send Purchase Order to Supplier', 'Purchase Orders', 'user', p.id, 5
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Confirm PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.confirm', 'Confirm Purchase Order', 'Purchase Orders', 'user', p.id, 6
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Receive PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.receive', 'Mark Purchase Order Received', 'Purchase Orders', 'user', p.id, 7
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Cancel PO (child of purchase_orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'purchase_orders.cancel', 'Cancel Purchase Order', 'Purchase Orders', 'user', p.id, 8
FROM permissions p WHERE p.name = 'purchase_orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- GRANT ALL PERMISSIONS TO SUPER ADMIN
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name LIKE 'purchase_orders.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name LIKE 'purchase_orders.%');
-- DELETE FROM permissions WHERE name LIKE 'purchase_orders.%';
