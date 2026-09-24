-- ============================================
-- MIGRATION: 063_supplier_rls_policies.sql
-- PURPOSE: RLS policies for supplier data isolation
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 062_supplier_id_on_tables.sql
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get the supplier_id for the current authenticated user
CREATE OR REPLACE FUNCTION get_user_supplier_id()
RETURNS UUID AS $$
  SELECT supplier_id
  FROM users
  WHERE auth_user_id = auth.uid()
    AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_supplier_id() IS 'Returns supplier_id for current authenticated user, NULL if not a supplier user';

-- Check if current user is a supplier user
CREATE OR REPLACE FUNCTION is_supplier_user()
RETURNS BOOLEAN AS $$
  SELECT get_user_supplier_id() IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_supplier_user() IS 'Returns TRUE if current user is linked to a supplier';

-- ============================================
-- UPDATE PURCHASE ORDERS RLS
-- ============================================

-- Drop existing select policy to replace it
DROP POLICY IF EXISTS purchase_orders_select ON purchase_orders;

-- New policy: Internal users see all POs, supplier users see only their POs
CREATE POLICY purchase_orders_select ON purchase_orders
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated' AND
    (
      -- Non-supplier users can see all POs
      NOT is_supplier_user()
      OR
      -- Supplier users can only see their own POs
      supplier_id = get_user_supplier_id()
    )
  );

-- Add update policy for suppliers to update their POs
CREATE POLICY purchase_orders_supplier_update ON purchase_orders
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    is_supplier_user() AND
    supplier_id = get_user_supplier_id() AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND (p.name = 'supplier_portal.confirm_po' OR
             p.name = 'supplier_portal.update_production')
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- UPDATE SHIPMENTS RLS
-- ============================================

-- Drop existing select policy to replace it
DROP POLICY IF EXISTS shipments_select ON shipments;

-- New policy: Internal users see all shipments, supplier users see only their shipments
CREATE POLICY shipments_select ON shipments
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated' AND
    (
      -- Non-supplier users can see all shipments
      NOT is_supplier_user()
      OR
      -- Supplier users can only see their own shipments
      supplier_id = get_user_supplier_id()
    )
  );

-- Add update policy for suppliers to update their shipments
CREATE POLICY shipments_supplier_update ON shipments
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    is_supplier_user() AND
    supplier_id = get_user_supplier_id() AND
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.auth_user_id = auth.uid()
        AND p.name = 'supplier_portal.update_shipment'
        AND u.deleted_at IS NULL
    )
  );

-- ============================================
-- UPDATE SUPPLIERS RLS
-- ============================================

-- Drop existing select policy to replace it
DROP POLICY IF EXISTS suppliers_select ON suppliers;

-- New policy: Internal users see all suppliers, supplier users see only their own company
CREATE POLICY suppliers_select ON suppliers
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated' AND
    (
      -- Non-supplier users can see all suppliers
      NOT is_supplier_user()
      OR
      -- Supplier users can only see their own company
      id = get_user_supplier_id()
    )
  );

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP POLICY IF EXISTS suppliers_select ON suppliers;
-- DROP POLICY IF EXISTS shipments_supplier_update ON shipments;
-- DROP POLICY IF EXISTS shipments_select ON shipments;
-- DROP POLICY IF EXISTS purchase_orders_supplier_update ON purchase_orders;
-- DROP POLICY IF EXISTS purchase_orders_select ON purchase_orders;
-- DROP FUNCTION IF EXISTS is_supplier_user();
-- DROP FUNCTION IF EXISTS get_user_supplier_id();
-- -- Then recreate original policies:
-- CREATE POLICY purchase_orders_select ON purchase_orders FOR SELECT USING (deleted_at IS NULL AND auth.role() = 'authenticated');
-- CREATE POLICY shipments_select ON shipments FOR SELECT USING (deleted_at IS NULL AND auth.role() = 'authenticated');
-- CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (deleted_at IS NULL AND auth.role() = 'authenticated');
