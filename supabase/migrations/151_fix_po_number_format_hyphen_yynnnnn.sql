-- Fix PO Number Format to PO-YYNNNNN (e.g., PO-2600075)
-- Client requested format: PO-2600075 (hyphen + 2-digit year + 5-digit sequence)
-- Previous format: PO-2026-00075 (hyphen + 4-digit year + hyphen + 5-digit)

DROP FUNCTION IF EXISTS generate_po_number();

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year_short TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  -- Get last 2 digits of year (26 for 2026)
  current_year_short := TO_CHAR(NOW(), 'YY');

  -- Find highest PO number for current year pattern (PO-26_____)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(po_number FROM 'PO-' || current_year_short || '(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || current_year_short || '%';

  next_num := max_num + 1;

  -- Format: PO-YYNNNNN (e.g., PO-2600001, PO-2600075)
  RETURN 'PO-' || current_year_short || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates PO number in format PO-YYNNNNN (e.g., PO-2600075)';

-- ============================================
-- NOTES:
-- ============================================
-- Format: PO-YYNNNNN
-- Example: PO-2600075
-- - PO = Prefix
-- - 26 = Last 2 digits of year (2026)
-- - 00075 = 5-digit sequence (padded with zeros)
--
-- When year changes (2027), format becomes: PO-2700001
-- When PO is PO-2600075, related shipment is SO2600075 (same number, no hyphen)
