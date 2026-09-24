/**
 * Migration: Rename 'dropship' to 'direct' for product_source
 *
 * Changes the product_source value from 'dropship' to 'direct' throughout the system.
 * This is a cleaner, more customer-friendly terminology.
 *
 * Safe to run: No live data exists yet.
 *
 * IMPORTANT: Steps are ordered carefully to avoid constraint violations
 */

-- ============================================
-- STEP 1: DROP OLD CHECK CONSTRAINTS FIRST
-- ============================================
-- This allows us to update the data without constraint violations

ALTER TABLE sales_orders
DROP CONSTRAINT IF EXISTS sales_orders_product_source_check;

ALTER TABLE quotes
DROP CONSTRAINT IF EXISTS quotes_product_source_check;

-- ============================================
-- STEP 2: UPDATE EXISTING DATA
-- ============================================
-- Now we can safely update 'dropship' to 'direct'

UPDATE sales_orders
SET product_source = 'direct'
WHERE product_source = 'dropship';

UPDATE quotes
SET product_source = 'direct'
WHERE product_source = 'dropship';

-- ============================================
-- STEP 3: ADD NEW CHECK CONSTRAINTS
-- ============================================
-- Add constraints with 'direct' instead of 'dropship'

ALTER TABLE sales_orders
ADD CONSTRAINT sales_orders_product_source_check
  CHECK (product_source IS NULL OR product_source IN ('direct', 'warehouse'));

ALTER TABLE quotes
ADD CONSTRAINT quotes_product_source_check
  CHECK (product_source IS NULL OR product_source IN ('direct', 'warehouse'));

-- ============================================
-- STEP 4: UPDATE COLUMN COMMENTS
-- ============================================

COMMENT ON COLUMN sales_orders.product_source IS 'Where product is sourced from: direct (shipped directly from supplier) or warehouse (ex-stock from US warehouse). NULL means not yet selected.';
COMMENT ON COLUMN quotes.product_source IS 'Where product is sourced from: direct (shipped directly from supplier) or warehouse (ex-stock from US warehouse). NULL means not yet selected.';

-- ============================================
-- VERIFICATION (Optional - uncomment to run)
-- ============================================

-- Verify no 'dropship' values remain:
-- SELECT COUNT(*) as dropship_in_sales_orders FROM sales_orders WHERE product_source = 'dropship';
-- SELECT COUNT(*) as dropship_in_quotes FROM quotes WHERE product_source = 'dropship';

-- Verify 'direct' values exist:
-- SELECT COUNT(*) as direct_in_sales_orders FROM sales_orders WHERE product_source = 'direct';
-- SELECT COUNT(*) as direct_in_quotes FROM quotes WHERE product_source = 'direct';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '   - Old constraints dropped';
  RAISE NOTICE '   - Data updated: dropship → direct';
  RAISE NOTICE '   - New constraints added';
  RAISE NOTICE '   - Column comments updated';
END $$;
