/**
 * Migration 128: Add suppliers.update permission
 *
 * Purpose: Add suppliers.update permission to allow users to update platinum dealers
 *
 * Issue: PGRST116 error when updating dealers due to missing permission
 * - RLS policy requires 'suppliers.update' permission for UPDATE operations
 * - This migration ensures the permission exists and is assigned to Admin role
 *
 * Related: platinum_dealers table RLS policies (migration 118)
 */

-- ============================================
-- Step 1: Add suppliers.update permission
-- ============================================

-- Add as a child of suppliers.view_module (same structure as suppliers.edit)
INSERT INTO permissions (name, description, group_name, permission_type, parent_id, sort_order)
SELECT
  'suppliers.update',
  'Update Supplier and Dealer Information',
  'Suppliers',
  'user',
  p.id,
  5  -- After suppliers.delete (sort_order 4)
FROM permissions p
WHERE p.name = 'suppliers.view_module'
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  parent_id = EXCLUDED.parent_id,
  sort_order = EXCLUDED.sort_order;

-- ============================================
-- Step 2: Assign to Admin roles
-- ============================================

-- Assign to Super Admin role
INSERT INTO role_permissions (role_id, permission_id, is_active)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
  AND p.name = 'suppliers.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign to Admin role (if exists)
INSERT INTO role_permissions (role_id, permission_id, is_active)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name = 'suppliers.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign to Operations Manager role (if exists)
INSERT INTO role_permissions (role_id, permission_id, is_active)
SELECT r.id, p.id, TRUE
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Operations Manager'
  AND p.name = 'suppliers.update'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================
-- Verification & Output
-- ============================================

DO $$
DECLARE
  perm_exists BOOLEAN;
  admin_count INTEGER;
  rec RECORD;
BEGIN
  -- Check if permission exists
  SELECT EXISTS (
    SELECT 1 FROM permissions WHERE name = 'suppliers.update'
  ) INTO perm_exists;

  -- Count how many roles have this permission
  SELECT COUNT(DISTINCT r.name)
  INTO admin_count
  FROM role_permissions rp
  JOIN roles r ON rp.role_id = r.id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE p.name = 'suppliers.update'
    AND rp.is_active = TRUE;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 128 Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Permission Created: %', perm_exists;
  RAISE NOTICE 'Assigned to % role(s)', admin_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Roles with suppliers.update permission:';

  -- List all roles with this permission
  FOR rec IN (
    SELECT r.name as role_name
    FROM role_permissions rp
    JOIN roles r ON rp.role_id = r.id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE p.name = 'suppliers.update'
      AND rp.is_active = TRUE
  )
  LOOP
    RAISE NOTICE '  - %', rec.role_name;
  END LOOP;

  RAISE NOTICE '';
END $$;

-- ============================================
-- Rollback (if needed)
-- ============================================
-- DELETE FROM role_permissions
-- WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'suppliers.update');
-- DELETE FROM permissions WHERE name = 'suppliers.update';
