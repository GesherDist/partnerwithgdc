-- ============================================
-- MIGRATION: 047_add_quote_granular_permissions.sql
-- PURPOSE: Add granular permissions for quote workflow actions
--   - quotes.submit_for_approval
--   - quotes.convert_to_order
-- DATE: 2026
-- ============================================

-- ============================================
-- 1. Add quotes.submit_for_approval permission
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.submit_for_approval', 'Submit Quote for Approval', 'Quote Module', 'user', p.id, 6
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 2. Add quotes.convert_to_order permission
-- ============================================

INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.convert_to_order', 'Convert Quote to Sales Order', 'Quote Module', 'user', p.id, 7
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- 3. Grant permissions to super_admin
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name IN ('quotes.submit_for_approval', 'quotes.convert_to_order')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 4. Grant quotes.submit_for_approval to sales roles (if exist)
-- ============================================

-- Grant to sales_rep role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales_rep'
  AND p.name = 'quotes.submit_for_approval'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant to sales_director role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'sales_director'
  AND p.name IN ('quotes.submit_for_approval', 'quotes.convert_to_order')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- 5. Grant quotes.convert_to_order to finance role
-- ============================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND p.name = 'quotes.convert_to_order'
ON CONFLICT (role_id, permission_id) DO NOTHING;
