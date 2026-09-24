-- ============================================
-- MIGRATION: 126_fix_po_rls_circular_dependency.sql
-- PURPOSE: Fix circular dependency in PO and PO Items RLS policies
-- AUTHOR: System
-- DATE: 2025
-- ============================================

-- ============================================
-- CREATE SECURITY DEFINER FUNCTIONS TO BYPASS RLS
-- ============================================

-- Function to check if user can see a specific PO (bypasses RLS)
CREATE OR REPLACE FUNCTION can_user_see_purchase_order(po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_supplier_id UUID;
  is_supplier BOOLEAN;
BEGIN
  -- Get user's supplier ID if they are a supplier
  SELECT get_user_supplier_id() INTO user_supplier_id;
  SELECT is_supplier_user() INTO is_supplier;

  -- Non-supplier users can see all POs
  IF NOT is_supplier THEN
    RETURN TRUE;
  END IF;

  -- Supplier users can see POs where at least one item belongs to them
  RETURN EXISTS (
    SELECT 1 FROM purchase_order_items poi
    WHERE poi.purchase_order_id = po_id
      AND poi.supplier_id = user_supplier_id
  );
END;
$$;

-- Function to check if user can see a specific PO item (bypasses RLS)
CREATE OR REPLACE FUNCTION can_user_see_po_item(item_supplier_id UUID, po_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_supplier_id UUID;
  is_supplier BOOLEAN;
BEGIN
  -- Get user info
  SELECT get_user_supplier_id() INTO user_supplier_id;
  SELECT is_supplier_user() INTO is_supplier;

  -- Non-supplier users can see all items
  IF NOT is_supplier THEN
    RETURN TRUE;
  END IF;

  -- Supplier users can only see items assigned to them
  RETURN item_supplier_id = user_supplier_id;
END;
$$;

-- ============================================
-- UPDATE RLS POLICIES TO USE SECURITY DEFINER FUNCTIONS
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS purchase_orders_select ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_supplier_update ON purchase_orders;
DROP POLICY IF EXISTS po_items_select ON purchase_order_items;

-- New purchase_orders SELECT policy (uses security definer function)
CREATE POLICY purchase_orders_select ON purchase_orders
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND can_user_see_purchase_order(id)
  );

-- New purchase_orders UPDATE policy for suppliers
CREATE POLICY purchase_orders_supplier_update ON purchase_orders
  FOR UPDATE
  USING (
    is_supplier_user()
    AND can_user_see_purchase_order(id)
    AND EXISTS (
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

-- New purchase_order_items SELECT policy (uses security definer function)
CREATE POLICY po_items_select ON purchase_order_items
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND can_user_see_po_item(supplier_id, purchase_order_id)
  );

-- ============================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION can_user_see_purchase_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_see_po_item(UUID, UUID) TO authenticated;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback:
-- DROP FUNCTION IF EXISTS can_user_see_purchase_order(UUID);
-- DROP FUNCTION IF EXISTS can_user_see_po_item(UUID, UUID);
-- Then restore policies from 069_remove_po_supplier_fields.sql
