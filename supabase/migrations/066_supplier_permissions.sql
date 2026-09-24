-- ============================================
-- MIGRATION: 066_supplier_permissions.sql
-- PURPOSE: Create supplier portal permissions
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 065b_supplier_role.sql
-- ============================================

-- ============================================
-- SUPPLIER PORTAL PERMISSIONS
-- ============================================

-- Parent permission for supplier portal access
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('supplier_portal.view_module', 'Access Supplier Portal', 'Supplier Portal', 'supplier', 1)
ON CONFLICT (name) DO NOTHING;

-- Child permissions (linked to parent)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.view_pos', 'View Purchase Orders', 'Supplier Portal', 'supplier', p.id, 2
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.confirm_po', 'Confirm/Accept PO', 'Supplier Portal', 'supplier', p.id, 3
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.reject_po', 'Reject PO', 'Supplier Portal', 'supplier', p.id, 4
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.update_production', 'Update Production Status', 'Supplier Portal', 'supplier', p.id, 5
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.view_shipments', 'View Shipments', 'Supplier Portal', 'supplier', p.id, 6
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.update_shipment', 'Update Shipment Info', 'Supplier Portal', 'supplier', p.id, 7
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.view_documents', 'View Documents', 'Supplier Portal', 'supplier', p.id, 8
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'supplier_portal.upload_documents', 'Upload Documents', 'Supplier Portal', 'supplier', p.id, 9
FROM permissions p WHERE p.name = 'supplier_portal.view_module'
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ASSIGN PERMISSIONS TO SUPPLIER ROLE
-- ============================================

INSERT INTO role_permissions (role_id, permission_id, is_active)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Supplier'
  AND p.name LIKE 'supplier_portal.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ADMIN PERMISSIONS FOR SUPPLIER MANAGEMENT
-- ============================================

-- Parent permission for suppliers module
INSERT INTO permissions (name, description, group_name, permission_type, sort_order)
VALUES ('suppliers.view_module', 'View Suppliers Module', 'Suppliers', 'user', 1)
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'suppliers.create', 'Create Supplier', 'Suppliers', 'user', p.id, 2
FROM permissions p WHERE p.name = 'suppliers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'suppliers.edit', 'Edit Supplier', 'Suppliers', 'user', p.id, 3
FROM permissions p WHERE p.name = 'suppliers.view_module'
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'suppliers.delete', 'Delete Supplier', 'Suppliers', 'user', p.id, 4
FROM permissions p WHERE p.name = 'suppliers.view_module'
ON CONFLICT (name) DO NOTHING;

-- Assign supplier management permissions to Super Admin
INSERT INTO role_permissions (role_id, permission_id, is_active)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name LIKE 'suppliers.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE name LIKE 'supplier_portal.%' OR name LIKE 'suppliers.%');
-- DELETE FROM permissions WHERE name LIKE 'supplier_portal.%' OR name LIKE 'suppliers.%';
