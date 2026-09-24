-- ============================================
-- MIGRATION: 046_add_quotes_approve_permission.sql
-- PURPOSE: Add quotes.approve permission and grant to Finance + super_admin roles
-- DATE: 2026
-- ============================================

-- Add quotes.approve permission (child of quotes.view_module)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT 'quotes.approve', 'Approve or Reject Quote Submissions', 'Quote Module', 'user', p.id, 5
FROM permissions p WHERE p.name = 'quotes.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- Grant quotes.approve to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'quotes.approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant quotes.approve to finance role (if exists)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'finance'
  AND p.name = 'quotes.approve'
ON CONFLICT (role_id, permission_id) DO NOTHING;
