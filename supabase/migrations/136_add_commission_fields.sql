-- ============================================================================
-- HISTORICAL DATA IMPORT - STEP 2: ADD COMMISSION TRACKING FIELDS
-- ============================================================================
-- Purpose: Add commission tracking columns to sales_orders table
-- Date: September 26, 2026
-- Run Order: 2 of 3
-- ============================================================================

BEGIN;

-- ============================================================================
-- Add Commission Tracking Fields
-- ============================================================================

ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS is_commission_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS galileo_invoice_number VARCHAR(50);

-- ============================================================================
-- Add Column Comments
-- ============================================================================

COMMENT ON COLUMN sales_orders.is_commission_only IS
  'TRUE when Galileo invoices customer directly and Gesher receives commission only ($275/tire)';

COMMENT ON COLUMN sales_orders.commission_amount IS
  'Commission amount Gesher receives from Galileo (usually $275 per tire)';

COMMENT ON COLUMN sales_orders.galileo_invoice_number IS
  'Galileo invoice number when is_commission_only = TRUE';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  has_commission_cols BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales_orders'
    AND column_name IN ('is_commission_only', 'commission_amount', 'galileo_invoice_number')
  ) INTO has_commission_cols;

  IF has_commission_cols THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Commission fields added successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Fields added to sales_orders table:';
    RAISE NOTICE '  • is_commission_only (BOOLEAN)';
    RAISE NOTICE '  • commission_amount (DECIMAL)';
    RAISE NOTICE '  • galileo_invoice_number (VARCHAR)';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next: Run IMPORT_003_sales_orders.sql';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING '❌ Failed to add commission fields';
  END IF;

END $$;

COMMIT;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
