-- Migration: Remove PO Number Format Constraint
-- Reason: Excel data has multiple PO number formats (PO-2600023, PO-N145669, PONE-3405)
--         Database constraint only allowed PO-YYYY-NNNNN format
-- Date: 2025-09-10

-- Drop the strict format constraint
ALTER TABLE purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_number_format;

-- Add a looser constraint that allows various formats
-- Only requires that po_number is not empty
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_number_not_empty CHECK (length(trim(po_number)) > 0);

-- Comment explaining the change
COMMENT ON CONSTRAINT purchase_orders_number_not_empty ON purchase_orders IS
  'Allows flexible PO number formats from Excel (PO-2600023, PO-N145669, PONE-3405, etc.)';
