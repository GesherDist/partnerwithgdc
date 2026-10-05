-- Update Number Formats to Match Jenny's Documents
-- Purchase Orders: PO-YYNNNNN format (e.g., PO-2600064)
-- Sales Orders: C-SO-YYNNNNN format (e.g., C-SO-2600064)
-- Quotes: QT-YYNNNNN format (e.g., QT-2600064)
-- Shipments: SOYYNNNNN format (e.g., SO2600023) - Galileo load numbers

-- ============================================
-- 1. PURCHASE ORDER NUMBER GENERATION
-- ============================================

DROP FUNCTION IF EXISTS generate_po_number();

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  year_short TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  year_short := SUBSTRING(current_year FROM 3 FOR 2); -- Get last 2 digits: "2026" -> "26"

  -- Find highest PO number for current year
  -- Format: PO-YYNNNNN (e.g., PO-2600064)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(po_number FROM '^PO-' || year_short || '(\d{5})$') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM purchase_orders
  WHERE po_number ~ ('^PO-' || year_short || '\d{5}$');

  next_num := max_num + 1;

  RETURN 'PO-' || year_short || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates next PO number in format PO-YYNNNNN (e.g., PO-2600064)';

-- ============================================
-- 2. SALES ORDER NUMBER GENERATION
-- ============================================

DROP FUNCTION IF EXISTS generate_order_number();

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  year_short TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  year_short := SUBSTRING(current_year FROM 3 FOR 2); -- Get last 2 digits: "2026" -> "26"

  -- Find highest order number for current year
  -- Format: C-SO-YYNNNNN (e.g., C-SO-2600064)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM '^C-SO-' || year_short || '(\d{5})$') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM sales_orders
  WHERE order_number ~ ('^C-SO-' || year_short || '\d{5}$');

  next_num := max_num + 1;

  RETURN 'C-SO-' || year_short || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates next sales order number in format C-SO-YYNNNNN (e.g., C-SO-2600064)';

-- ============================================
-- 3. QUOTE NUMBER GENERATION
-- ============================================

DROP FUNCTION IF EXISTS generate_quote_number();

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  year_short TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  year_short := SUBSTRING(current_year FROM 3 FOR 2); -- Get last 2 digits: "2026" -> "26"

  -- Find highest quote number for current year
  -- Format: QT-YYNNNNN (e.g., QT-2600064)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(quote_number FROM '^QT-' || year_short || '(\d{5})$') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM quotes
  WHERE quote_number ~ ('^QT-' || year_short || '\d{5}$');

  next_num := max_num + 1;

  RETURN 'QT-' || year_short || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quote_number() IS 'Generates next quote number in format QT-YYNNNNN (e.g., QT-2600064)';

-- ============================================
-- NOTES:
-- ============================================
-- All formats match Jenny's documents exactly:
--
-- Shipment Numbers:  SO2600023      (Galileo load numbers - shipments.shipment_number)
-- Purchase Orders:   PO-2600064     (internal POs - purchase_orders.po_number)
-- Quotes:            QT-2600064     (customer quotes - quotes.quote_number)
-- Sales Orders:      C-SO-2600064   (customer orders - sales_orders.order_number)
--
-- Format pattern: PREFIX-YYNNNNN where:
--   - PREFIX = PO, QT, or C-SO
--   - YY = last 2 digits of year (2026 = 26)
--   - NNNNN = 5-digit sequential number (00001, 00064, etc.)
--
-- Jenny's GDC sheets show:
--   - Load # column: SO2600058 (shipment/container number)
--   - PO column: PO-2600058, Q459074 (Purchase Order numbers)
--   - Customer column: GDC (unallocated) or Valley/Lindsay (allocated)
