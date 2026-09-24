/**
 * Migration 117: Add customer_qty to sales_order_items
 *
 * Purpose: Add customer_qty field to track customer's ACTUAL order quantity
 * separately from procurement/container quantities
 *
 * CRITICAL BUSINESS RULE:
 * ─────────────────────────
 * Customer Qty ≠ Procurement Qty
 * - customer_qty: What the customer ordered (e.g., 20 tires)
 * - container_qty: What we buy from manufacturer (e.g., 72 tires in full container)
 * - These are stored in SEPARATE tables and NEVER mixed
 *
 * Part of: Fulfillment Source Implementation (Phase 1)
 * Related: FULFILLMENT_SOURCE_IMPLEMENTATION_PLAN.md
 */

-- ============================================
-- STEP 1: Add customer_qty column
-- ============================================

DO $$
BEGIN
  -- Check if column already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_order_items'
    AND column_name = 'customer_qty'
  ) THEN

    ALTER TABLE sales_order_items
      ADD COLUMN customer_qty INTEGER;

    RAISE NOTICE '✅ Added customer_qty column to sales_order_items';

  ELSE
    RAISE NOTICE '⚠️  customer_qty column already exists';
  END IF;
END $$;

-- ============================================
-- STEP 2: Migrate existing data
-- ============================================
-- Copy quantity → customer_qty for existing records
-- This ensures no data loss during migration

UPDATE sales_order_items
SET customer_qty = quantity
WHERE customer_qty IS NULL;

-- ============================================
-- STEP 3: Make customer_qty NOT NULL
-- ============================================
-- After data migration, enforce NOT NULL constraint

ALTER TABLE sales_order_items
  ALTER COLUMN customer_qty SET NOT NULL;

-- ============================================
-- STEP 4: Add CHECK constraint
-- ============================================
-- Customer quantity must be positive

ALTER TABLE sales_order_items
  DROP CONSTRAINT IF EXISTS check_customer_qty_positive;

ALTER TABLE sales_order_items
  ADD CONSTRAINT check_customer_qty_positive
  CHECK (customer_qty > 0);

-- ============================================
-- STEP 5: Add column comment
-- ============================================

COMMENT ON COLUMN sales_order_items.customer_qty IS 'Customer actual order quantity (NEVER changes). Separate from procurement/container qty which is stored in fulfillment_allocations table.';

-- ============================================
-- STEP 6: Create index (optional performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_sales_order_items_customer_qty
ON sales_order_items(customer_qty)
WHERE customer_qty IS NOT NULL;

-- ============================================
-- Verification Query (Optional)
-- ============================================

-- Uncomment to verify migration:
-- SELECT
--   id,
--   sku,
--   quantity as old_quantity,
--   customer_qty as new_customer_qty,
--   CASE
--     WHEN quantity = customer_qty THEN '✅ Migrated'
--     ELSE '⚠️  Mismatch'
--   END as status
-- FROM sales_order_items
-- LIMIT 10;

-- Success message
DO $$
DECLARE
  total_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items FROM sales_order_items;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 117 completed successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Added: customer_qty column';
  RAISE NOTICE 'Migrated: % existing sales order items', total_items;
  RAISE NOTICE 'Constraint: customer_qty > 0';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Next: Fulfillment allocations (source, container qty) will be stored separately';
  RAISE NOTICE '';
END $$;
