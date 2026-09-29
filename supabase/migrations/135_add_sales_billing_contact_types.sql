-- ============================================================================
-- Add Sales and Billing Contact Types
-- ============================================================================
-- Purpose: Add 'sales' and 'billing' to contact_type enum
-- Date: September 28, 2026
-- ============================================================================

BEGIN;

-- Add new values to contact_type enum
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'billing';

-- Verification
DO $$
DECLARE
  has_sales BOOLEAN;
  has_billing BOOLEAN;
BEGIN
  -- Check if 'sales' exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'contact_type'
    AND e.enumlabel = 'sales'
  ) INTO has_sales;

  -- Check if 'billing' exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'contact_type'
    AND e.enumlabel = 'billing'
  ) INTO has_billing;

  IF has_sales AND has_billing THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Contact types added successfully';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Contact types now available:';
    RAISE NOTICE '  • primary';
    RAISE NOTICE '  • purchasing';
    RAISE NOTICE '  • accounts_payable';
    RAISE NOTICE '  • receiving';
    RAISE NOTICE '  • executive';
    RAISE NOTICE '  • other';
    RAISE NOTICE '  • sales (NEW)';
    RAISE NOTICE '  • billing (NEW)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING '❌ Failed to add contact types';
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
