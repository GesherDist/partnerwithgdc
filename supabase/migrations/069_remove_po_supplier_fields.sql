-- ============================================
-- MIGRATION: 069_remove_po_supplier_fields.sql
-- PURPOSE: Remove supplier fields from purchase_orders (now on items)
-- AUTHOR: System
-- DATE: 2024
-- DEPENDS ON: 068_po_items_supplier.sql
-- ============================================

-- ============================================
-- UPDATE RLS POLICIES TO CHECK ITEM-LEVEL SUPPLIER
-- ============================================

-- Drop existing policies that reference purchase_orders.supplier_id
DROP POLICY IF EXISTS purchase_orders_select ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_supplier_update ON purchase_orders;

-- New select policy: Check item-level supplier_id
CREATE POLICY purchase_orders_select ON purchase_orders
  FOR SELECT
  USING (
    deleted_at IS NULL AND
    auth.role() = 'authenticated' AND
    (
      -- Non-supplier users can see all POs
      NOT is_supplier_user()
      OR
      -- Supplier users can see POs where at least one item belongs to them
      EXISTS (
        SELECT 1 FROM purchase_order_items poi
        WHERE poi.purchase_order_id = purchase_orders.id
          AND poi.supplier_id = get_user_supplier_id()
      )
    )
  );

-- New update policy for suppliers: Check item-level supplier_id
CREATE POLICY purchase_orders_supplier_update ON purchase_orders
  FOR UPDATE
  USING (
    deleted_at IS NULL AND
    is_supplier_user() AND
    EXISTS (
      SELECT 1 FROM purchase_order_items poi
      WHERE poi.purchase_order_id = purchase_orders.id
        AND poi.supplier_id = get_user_supplier_id()
    ) AND
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
-- ADD RLS POLICY FOR PURCHASE ORDER ITEMS
-- ============================================

-- Supplier users should only see items assigned to them
DROP POLICY IF EXISTS po_items_select ON purchase_order_items;

CREATE POLICY po_items_select ON purchase_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.deleted_at IS NULL
        AND auth.role() = 'authenticated'
        AND (
          -- Non-supplier users can see all items
          NOT is_supplier_user()
          OR
          -- Supplier users can only see items assigned to them
          purchase_order_items.supplier_id = get_user_supplier_id()
        )
    )
  );

-- ============================================
-- REMOVE SUPPLIER FIELDS FROM PURCHASE_ORDERS
-- ============================================

-- Drop the index first
DROP INDEX IF EXISTS idx_po_supplier;

-- Remove the columns
ALTER TABLE purchase_orders
  DROP COLUMN IF EXISTS supplier_id,
  DROP COLUMN IF EXISTS supplier_name,
  DROP COLUMN IF EXISTS supplier_contact;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- ALTER TABLE purchase_orders ADD COLUMN supplier_id UUID REFERENCES suppliers(id);
-- ALTER TABLE purchase_orders ADD COLUMN supplier_name VARCHAR(100);
-- ALTER TABLE purchase_orders ADD COLUMN supplier_contact VARCHAR(100);
-- CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
-- -- Then recreate original RLS policies from 063_supplier_rls_policies.sql
