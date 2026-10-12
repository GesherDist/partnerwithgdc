-- ============================================
-- Migration: 160_fix_po_number_format_add_hyphen.sql
-- Description: Fix PO number format from PO2600076 to PO-2600076 (add hyphen)
-- Created: 2026-10-12
-- ============================================

-- Step 1: Update existing PO numbers to add hyphen
-- Convert: PO2600076 → PO-2600076
-- Only updates records that match the pattern without hyphen

UPDATE purchase_orders
SET po_number = 'PO-' || SUBSTRING(po_number FROM 3)
WHERE po_number ~ '^PO\d{7}$'  -- Matches PO followed by exactly 7 digits (no hyphen)
  AND po_number NOT LIKE 'PO-%';  -- Safety: skip if already has hyphen

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % PO numbers to include hyphen', updated_count;
END $$;

-- Step 2: Recreate the generate_po_number function with correct format
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_short TEXT;
  max_num INTEGER;
BEGIN
  year_short := TO_CHAR(NOW(), 'YY');

  -- Find max sequence from BOTH formats (with and without hyphen) for safety
  SELECT COALESCE(
    GREATEST(
      -- New format: PO-YYNNNNN
      (SELECT MAX(CAST(SUBSTRING(po_number FROM '^PO-' || year_short || '(\d{5})$') AS INTEGER))
       FROM purchase_orders
       WHERE po_number ~ ('^PO-' || year_short || '\d{5}$')),
      -- Old format: POYYNNNNN (without hyphen)
      (SELECT MAX(CAST(SUBSTRING(po_number FROM '^PO' || year_short || '(\d{5})$') AS INTEGER))
       FROM purchase_orders
       WHERE po_number ~ ('^PO' || year_short || '\d{5}$'))
    ),
    0
  ) INTO max_num;

  -- Always generate with hyphen: PO-YYNNNNN
  RETURN 'PO-' || year_short || LPAD((max_num + 1)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates next PO number in format PO-YYNNNNN (e.g., PO-2600076)';

-- ============================================
-- VERIFICATION QUERY (run manually to check):
-- ============================================
-- SELECT po_number FROM purchase_orders WHERE po_number ~ '^PO\d' ORDER BY created_at DESC LIMIT 10;
-- SELECT generate_po_number();
