-- ============================================
-- MIGRATION: 037_add_orders_view_detail_permission.sql
-- PURPOSE: Add "View Sales Order Detail" permission to Orders module
-- DATE: 2026
-- ============================================

-- Add View Sales Order Detail permission (child of orders.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'orders.view_detail', 'View Sales Order Detail', 'Orders', 'user', p.id, 2
FROM permissions p WHERE p.name = 'orders.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Update sort_order for existing permissions to make room for view_detail
-- view_detail should come after create (1), before edit (was 2, now 3)
UPDATE permissions SET sort_order = 3 WHERE name = 'orders.edit';
UPDATE permissions SET sort_order = 4 WHERE name = 'orders.delete';
UPDATE permissions SET sort_order = 5 WHERE name = 'orders.approve';

-- Grant to super_admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'orders.view_detail'
ON CONFLICT (role_id, permission_id) DO NOTHING;
