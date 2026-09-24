/**
 * Migration 124: Fix platinum_dealer_locations RLS policies
 *
 * Purpose: Update RLS policies to use permission-based checks instead of simple auth checks
 *
 * Issue: Current policies use auth.uid() IS NOT NULL which doesn't integrate with
 * the app's permission system. This migration updates policies to match the pattern
 * used by platinum_dealers table (checking for suppliers.create/update permissions).
 *
 * Related: https://github.com/anthropics/claude-code/issues/XXX
 */

-- ============================================
-- Drop existing policies
-- ============================================

DROP POLICY IF EXISTS "Users can view dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Authenticated users can create dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Authenticated users can update dealer locations" ON platinum_dealer_locations;
DROP POLICY IF EXISTS "Only admins can delete dealer locations" ON platinum_dealer_locations;

-- ============================================
-- Create updated policies with permission checks
-- ============================================

-- Policy: Authenticated users can view locations (not soft-deleted)
CREATE POLICY platinum_dealer_locations_select ON platinum_dealer_locations
FOR SELECT
USING (
  deleted_at IS NULL AND
  auth.role() = 'authenticated'
);

-- Policy: Users with suppliers.create permission can create dealer locations
CREATE POLICY platinum_dealer_locations_insert ON platinum_dealer_locations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.auth_user_id = auth.uid()
      AND p.name = 'suppliers.create'
      AND u.deleted_at IS NULL
  )
);

-- Policy: Users with suppliers.update permission can update dealer locations
CREATE POLICY platinum_dealer_locations_update ON platinum_dealer_locations
FOR UPDATE
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.auth_user_id = auth.uid()
      AND p.name = 'suppliers.update'
      AND u.deleted_at IS NULL
  )
);

-- Policy: Users with suppliers.delete permission can delete (soft delete) locations
CREATE POLICY platinum_dealer_locations_delete ON platinum_dealer_locations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE u.auth_user_id = auth.uid()
      AND p.name = 'suppliers.delete'
      AND u.deleted_at IS NULL
  )
);

-- ============================================
-- Success message
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 124 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fixed: platinum_dealer_locations RLS policies';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - SELECT: Now checks auth.role() = authenticated';
  RAISE NOTICE '  - INSERT: Now checks suppliers.create permission';
  RAISE NOTICE '  - UPDATE: Now checks suppliers.update permission';
  RAISE NOTICE '  - DELETE: Now checks suppliers.delete permission';
  RAISE NOTICE '';
  RAISE NOTICE 'Note: Policies now match platinum_dealers table pattern';
  RAISE NOTICE '';
END $$;
