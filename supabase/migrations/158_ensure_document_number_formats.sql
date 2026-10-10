-- ============================================
-- Migration: 158_ensure_document_number_formats.sql
-- Description: Re-assert the final document number formats
-- Created: 2026-10-09
--
-- Why: the number generators were defined three times (013, 107, 144). The
-- final formats live in 144_update_sales_order_prefix_to_c_so.sql, but that
-- file shares its number with 144_add_remaining_load_statuses.sql (and 107 /
-- 145 are duplicated too). A database where the wrong "144" ran, or where 107
-- ran again later, keeps the old generator and creates QT-2026-00058 style
-- numbers while existing records (converted by 145) use QT-2600058.
-- This uniquely numbered migration runs last and makes the formats final:
--   Quotes:         QT-YYNNNNN    (e.g. QT-2600064)
--   Sales orders:   C-SO-YYNNNNN  (e.g. C-SO-2600064)
--   Purchase orders: PO-YYNNNNN   (e.g. PO-2600064)
--
-- Safe: replaces three functions with the same bodies as 144 (and 151 for
-- POs); changes no data. CREATE OR REPLACE keeps the signature, so nothing
-- that depends on the functions is dropped. Re-runnable.
-- Numbering: each generator continues after the highest existing number in
-- the new format for the current year.
-- Not included on purpose: renaming records created by the old generator
-- (e.g. QT-2026-00058). Do that explicitly if wanted, then re-sync any
-- Pipedrive deal that shows the old number.
-- Test: SELECT generate_quote_number(), generate_order_number(), generate_po_number();
--       -> QT-26NNNNN, C-SO-26NNNNN, PO-26NNNNN (nothing is inserted).
-- Rollback: re-run the previous definitions (144 / 151); no data to restore.
-- ============================================

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_short TEXT;
  max_num INTEGER;
BEGIN
  year_short := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(quote_number FROM '^QT-' || year_short || '(\d{5})$') AS INTEGER)), 0)
  INTO max_num
  FROM quotes
  WHERE quote_number ~ ('^QT-' || year_short || '\d{5}$');

  RETURN 'QT-' || year_short || LPAD((max_num + 1)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_quote_number() IS 'Generates next quote number in format QT-YYNNNNN (e.g., QT-2600064)';

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_short TEXT;
  max_num INTEGER;
BEGIN
  year_short := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '^C-SO-' || year_short || '(\d{5})$') AS INTEGER)), 0)
  INTO max_num
  FROM sales_orders
  WHERE order_number ~ ('^C-SO-' || year_short || '\d{5}$');

  RETURN 'C-SO-' || year_short || LPAD((max_num + 1)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS 'Generates next sales order number in format C-SO-YYNNNNN (e.g., C-SO-2600064)';

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_short TEXT;
  max_num INTEGER;
BEGIN
  year_short := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM '^PO-' || year_short || '(\d{5})$') AS INTEGER)), 0)
  INTO max_num
  FROM purchase_orders
  WHERE po_number ~ ('^PO-' || year_short || '\d{5}$');

  RETURN 'PO-' || year_short || LPAD((max_num + 1)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_po_number() IS 'Generates next PO number in format PO-YYNNNNN (e.g., PO-2600064)';
