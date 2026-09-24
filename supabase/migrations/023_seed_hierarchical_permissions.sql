-- ============================================
-- SEED HIERARCHICAL PERMISSIONS
-- ============================================
-- Seeds hierarchical permissions for customers module as example
-- Other modules can follow the same pattern
-- ============================================

-- Add missing columns first
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES permissions(id);
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_permissions_parent_id ON permissions(parent_id);

-- First, update sort_order for existing permissions
UPDATE permissions SET sort_order = 0 WHERE sort_order IS NULL;

-- ============================================
-- CUSTOMERS MODULE - Hierarchical Permissions
-- ============================================

-- Insert parent: View Customer Module (if not exists)
INSERT INTO permissions (name, display_name, description, module, action, category, sort_order)
VALUES ('customers.view_module', 'View Customer Module', 'Access to view customer module', 'customers', 'view_module', 'Customers', 0)
ON CONFLICT (name) DO NOTHING;

-- Insert children under View Customer Module
-- 1. Create Customer
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.create', 'Create Customer', 'Create new customers', 'customers', 'create', 'Customers', p.id, 1
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2. View Customer Detail
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.view_detail', 'View Customer Detail', 'View detailed customer information', 'customers', 'view_detail', 'Customers', p.id, 2
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.1 View Customer Contacts (under View Customer Detail)
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.view_contacts', 'View Customer Contacts', 'View customer contact information', 'customers', 'view_contacts', 'Customers', p.id, 0
FROM permissions p WHERE p.name = 'customers.view_detail'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.1.1 Create Customer Contact
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.create_contact', 'Create Customer Contact', 'Add new customer contacts', 'customers', 'create_contact', 'Customers', p.id, 0
FROM permissions p WHERE p.name = 'customers.view_contacts'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.1.2 Edit Customer Contact
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.edit_contact', 'Edit Customer Contact', 'Edit customer contact details', 'customers', 'edit_contact', 'Customers', p.id, 1
FROM permissions p WHERE p.name = 'customers.view_contacts'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.1.3 Delete Customer Contact
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.delete_contact', 'Delete Customer Contact', 'Remove customer contacts', 'customers', 'delete_contact', 'Customers', p.id, 2
FROM permissions p WHERE p.name = 'customers.view_contacts'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2 View Customer Documents (under View Customer Detail)
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.view_documents', 'View Customer Documents', 'View customer document list', 'customers', 'view_documents', 'Customers', p.id, 1
FROM permissions p WHERE p.name = 'customers.view_detail'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2.1 Upload Customer Document
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.upload_document', 'Upload Customer Document', 'Upload new customer documents', 'customers', 'upload_document', 'Customers', p.id, 0
FROM permissions p WHERE p.name = 'customers.view_documents'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2.2 View Customer Document
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.view_document', 'View Customer Document', 'View individual customer documents', 'customers', 'view_document', 'Customers', p.id, 1
FROM permissions p WHERE p.name = 'customers.view_documents'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2.3 Download Customer Document
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.download_document', 'Download Customer Document', 'Download customer documents', 'customers', 'download_document', 'Customers', p.id, 2
FROM permissions p WHERE p.name = 'customers.view_documents'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2.4 Replace Customer Document
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.replace_document', 'Replace Customer Document', 'Replace existing customer documents', 'customers', 'replace_document', 'Customers', p.id, 3
FROM permissions p WHERE p.name = 'customers.view_documents'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2.2.5 Archive Customer Document
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.archive_document', 'Archive Customer Document', 'Archive customer documents', 'customers', 'archive_document', 'Customers', p.id, 4
FROM permissions p WHERE p.name = 'customers.view_documents'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 3. Edit Customer (under View Customer Module)
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.edit', 'Edit Customer', 'Edit customer information', 'customers', 'edit', 'Customers', p.id, 3
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 4. Delete Customer (under View Customer Module)
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'customers.delete', 'Delete Customer', 'Delete customers', 'customers', 'delete', 'Customers', p.id, 4
FROM permissions p WHERE p.name = 'customers.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- ============================================
-- SALES ORDERS MODULE - Hierarchical Permissions
-- ============================================

-- Insert parent: View Sales Order Module
INSERT INTO permissions (name, display_name, description, module, action, category, sort_order)
VALUES ('orders.view_module', 'View Sales Order Module', 'Access to view sales order module', 'orders', 'view_module', 'Orders', 0)
ON CONFLICT (name) DO NOTHING;

-- 1. Create Sales Order
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'orders.create', 'Create Sales Order', 'Create new sales orders', 'orders', 'create', 'Orders', p.id, 1
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 2. Edit Sales Order
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'orders.edit', 'Edit Sales Order', 'Edit sales order details', 'orders', 'edit', 'Orders', p.id, 2
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 3. Delete Sales Order
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'orders.delete', 'Delete Sales Order', 'Delete sales orders', 'orders', 'delete', 'Orders', p.id, 3
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- 4. Approve Sales Order
INSERT INTO permissions (name, display_name, description, module, action, category, parent_id, sort_order)
SELECT 'orders.approve', 'Approve Sales Order', 'Approve sales orders', 'orders', 'approve', 'Orders', p.id, 4
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO UPDATE SET parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order;

-- Clean up old flat permissions that are now hierarchical
-- (Keep them but set deleted_at if you want to preserve history)
-- DELETE FROM permissions WHERE name IN ('customers.view', 'orders.view') AND deleted_at IS NULL;
