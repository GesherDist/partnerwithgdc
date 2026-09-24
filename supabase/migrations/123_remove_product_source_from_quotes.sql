/**
 * Migration: Remove product_source from quotes and sales_orders
 *
 * Reason: Product source is now handled at the fulfillment allocation level,
 * allowing multi-source fulfillment for a single order.
 */

-- ============================================
-- STEP 1: Remove product_source from quotes
-- ============================================

-- Drop CHECK constraint first
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_product_source_check;

-- Drop the column
ALTER TABLE quotes DROP COLUMN IF EXISTS product_source;

-- ============================================
-- STEP 2: Remove product_source from sales_orders
-- ============================================

-- Drop CHECK constraint first
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_product_source_check;

-- Drop the column
ALTER TABLE sales_orders DROP COLUMN IF EXISTS product_source;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 123 completed: Removed product_source from quotes and sales_orders';
  RAISE NOTICE 'Fulfillment is now handled via fulfillment_allocations table';
END $$;
