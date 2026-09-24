-- ============================================
-- MIGRATION: 110_relax_sales_order_number_format.sql
-- PURPOSE: Remove order number format constraint for flexibility
-- DATE: 2026-09-10
-- AUTHOR: Data Ingestion - Historical Orders Import
-- ============================================

-- BACKGROUND:
-- Current constraint only allows: SO-YYYY-NNNNN (e.g., SO-2026-00001)
-- Historical data has various formats: SO2600023, SO-2600023, etc.
-- Remove format restriction completely - allow ANY format (like quotes)

-- IMPACT:
-- ✅ Safe change - only removes validation
-- ✅ No data loss
-- ✅ No structure change
-- ✅ Existing orders unaffected
-- ✅ Future orders can use ANY format

-- SIMILAR TO: Migration 091 (relax quote number format)

-- ============================================
-- STEP 1: DROP OLD FORMAT CONSTRAINT
-- ============================================

ALTER TABLE sales_orders
DROP CONSTRAINT IF EXISTS sales_orders_number_format;

-- ============================================
-- STEP 2: ADD BASIC VALIDATION (NOT NULL + LENGTH)
-- ============================================
-- No format restriction - just ensure it's not empty and reasonable length

ALTER TABLE sales_orders
ADD CONSTRAINT sales_orders_number_not_empty
CHECK (
  order_number IS NOT NULL AND
  LENGTH(TRIM(order_number)) > 0 AND
  LENGTH(order_number) <= 50
);

-- ============================================
-- STEP 3: ADD DOCUMENTATION
-- ============================================

COMMENT ON CONSTRAINT sales_orders_number_not_empty ON sales_orders IS
  'Order number must be non-empty and max 50 characters. Custom formats allowed (no format restriction).';

-- ============================================
-- VERIFICATION (Optional - uncomment to test)
-- ============================================

-- Test new format (should work):
-- SELECT 'SO-2026-00001'::VARCHAR(50) AS test1;

-- Test historical format (should work):
-- SELECT 'SO2600023'::VARCHAR(50) AS test2;

-- Test custom format (should work):
-- SELECT 'ORDER-123-ABC'::VARCHAR(50) AS test3;

-- Test any format (should work):
-- SELECT 'CUSTOM-ORDER-2026'::VARCHAR(50) AS test4;

-- Test empty (should fail):
-- SELECT ''::VARCHAR(50) AS test5;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 110 completed successfully!';
  RAISE NOTICE '   - Old format constraint removed';
  RAISE NOTICE '   - Basic validation added (NOT NULL + LENGTH)';
  RAISE NOTICE '   - ANY format now allowed:';
  RAISE NOTICE '     • SO-2026-00001';
  RAISE NOTICE '     • SO2600023';
  RAISE NOTICE '     • CUSTOM-ORDER-123';
  RAISE NOTICE '     • Any other format (max 50 chars)';
  RAISE NOTICE '   - Ready for historical data import';
END $$;

-- ============================================
-- ROLLBACK INSTRUCTIONS
-- ============================================

-- To rollback this migration (restore strict format):
--
-- ALTER TABLE sales_orders
-- DROP CONSTRAINT IF EXISTS sales_orders_number_not_empty;
--
-- ALTER TABLE sales_orders
-- ADD CONSTRAINT sales_orders_number_format
-- CHECK (order_number ~ '^SO-[0-9]{4}-[0-9]{5}$');
--
-- COMMENT ON CONSTRAINT sales_orders_number_format ON sales_orders IS
--   'Order number must be in format SO-YYYY-NNNNN';

-- ============================================
-- END OF MIGRATION
-- ============================================
