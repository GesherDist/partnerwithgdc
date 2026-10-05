-- Migration: Sync order_series from Sales Orders to Purchase Orders
-- Purpose: For POs linked to Sales Orders, copy the order_series from SO to PO
-- This ensures GDC 0 data shows up in Operations Dashboard
-- Date: Oct 2, 2026

-- ============================================
-- UPDATE: Copy order_series from linked Sales Orders to Purchase Orders
-- ============================================

-- Update all POs that have a linked Sales Order
-- Copy the order_series value from the Sales Order
UPDATE purchase_orders po
SET
  order_series = so.order_series,
  updated_at = NOW()
FROM sales_orders so
WHERE
  po.sales_order_id = so.id
  AND so.order_series IS NOT NULL
  AND (po.order_series IS NULL OR po.order_series != so.order_series);

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % purchase orders with order_series from linked sales orders', updated_count;
END $$;

-- ============================================
-- VERIFY: Check the results
-- ============================================

-- Count POs by order_series
-- Uncomment to verify:
-- SELECT
--   order_series,
--   COUNT(*) as po_count,
--   COUNT(sales_order_id) as linked_po_count,
--   COUNT(*) FILTER (WHERE sales_order_id IS NULL) as unlinked_po_count
-- FROM purchase_orders
-- WHERE deleted_at IS NULL
-- GROUP BY order_series
-- ORDER BY order_series;

-- ============================================
-- ROLLBACK SCRIPT (commented out)
-- ============================================

-- To rollback this migration, you would need to manually reset order_series
-- This is not recommended as it may break the dashboard
-- UPDATE purchase_orders SET order_series = NULL WHERE sales_order_id IS NOT NULL;
