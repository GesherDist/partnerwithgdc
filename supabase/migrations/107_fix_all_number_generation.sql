-- Fix All Number Generation Functions (Year-based)
-- Issue: All modules use global sequences that cause duplicate numbers
-- Solution: Check existing records per year and generate next number

-- ============================================
-- 1. QUOTE NUMBERS (QT-YYYY-NNNNN)
-- ============================================

DROP FUNCTION IF EXISTS generate_quote_number();

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Find highest quote number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(quote_number FROM 'QT-' || current_year || '-(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM quotes
  WHERE quote_number LIKE 'QT-' || current_year || '-%';

  next_num := max_num + 1;

  RETURN 'QT-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quote_number() IS 'Generates next quote number in format QT-YYYY-NNNNN (year-based)';

-- ============================================
-- 2. SALES ORDER NUMBERS (SO-YYYY-NNNNN)
-- ============================================

DROP FUNCTION IF EXISTS generate_order_number();

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Find highest order number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(order_number FROM 'SO-' || current_year || '-(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM sales_orders
  WHERE order_number LIKE 'SO-' || current_year || '-%';

  next_num := max_num + 1;

  RETURN 'SO-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates next sales order number in format SO-YYYY-NNNNN (year-based)';

-- ============================================
-- 3. PURCHASE ORDER NUMBERS (PO-YYYY-NNNNN)
-- ============================================

DROP FUNCTION IF EXISTS generate_po_number();

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Find highest PO number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(po_number FROM 'PO-' || current_year || '-(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || current_year || '-%';

  next_num := max_num + 1;

  RETURN 'PO-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates next PO number in format PO-YYYY-NNNNN (year-based)';

-- ============================================
-- 4. INVOICE NUMBERS (INV-YYYY-NNNNN)
-- ============================================

DROP FUNCTION IF EXISTS generate_invoice_number();

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Find highest invoice number for current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(invoice_number FROM 'INV-' || current_year || '-(\d{5})') AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || current_year || '-%';

  next_num := max_num + 1;

  RETURN 'INV-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number() IS 'Generates next invoice number in format INV-YYYY-NNNNN (year-based)';

-- ============================================
-- NOTES:
-- ============================================
-- 1. Each function is INDEPENDENT - no shared sequences
-- 2. Each function checks its OWN table for max number
-- 3. Numbers reset every year (YYYY changes)
-- 4. Customer PO is user-entered (not auto-generated)
-- 5. Format: PREFIX-YYYY-NNNNN (e.g., SO-2026-00051)
