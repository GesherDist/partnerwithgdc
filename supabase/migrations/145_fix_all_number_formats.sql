-- ============================================
-- MIGRATION: 145_fix_all_number_formats.sql
-- PURPOSE: Update all number formats to match Jenny's documents
-- DATE: October 2, 2026
-- ============================================

-- SHIPMENT NUMBER FORMAT: SOYYNNNNN (e.g., SO2600064)
-- QUOTE NUMBER FORMAT: QT-YYNNNNN (e.g., QT-2600064)
-- SALES ORDER FORMAT: C-SO-YYNNNNN (e.g., C-SO-2600064)
-- PURCHASE ORDER FORMAT: PO-YYNNNNN (e.g., PO-2600064)

-- ============================================
-- 1. DROP OLD CONSTRAINTS
-- ============================================

-- Drop the old shipment number format constraint
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_number_format;

-- ============================================
-- 2. UPDATE SHIPMENT NUMBER GENERATION FUNCTION
-- ============================================

DROP FUNCTION IF EXISTS generate_shipment_number();

CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  year_short TEXT;
  max_num INTEGER;
  next_num INTEGER;
  new_number VARCHAR(50);
  attempt_count INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  year_short := SUBSTRING(current_year FROM 3 FOR 2); -- "2026" -> "26"

  -- Loop until we find a unique number (with safety limit)
  LOOP
    -- Find the maximum number for current year
    -- Format: SOYYNNNNN (e.g., SO2600064)
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(shipment_number FROM '^SO' || year_short || '(\d{5})$') AS INTEGER
        )
      ),
      0
    ) INTO max_num
    FROM shipments
    WHERE shipment_number ~ ('^SO' || year_short || '\d{5}$')
      AND deleted_at IS NULL;

    -- Generate next number
    next_num := COALESCE(max_num, 0) + 1;
    new_number := 'SO' || year_short || LPAD(next_num::TEXT, 5, '0');

    -- Check if this number already exists (race condition safety)
    IF NOT EXISTS (
      SELECT 1 FROM shipments
      WHERE shipment_number = new_number
        AND deleted_at IS NULL
    ) THEN
      RETURN new_number;
    END IF;

    -- Increment attempt counter
    attempt_count := attempt_count + 1;

    -- Safety check to prevent infinite loop
    IF attempt_count >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique shipment number after % attempts', max_attempts;
    END IF;

    -- Small delay to reduce race condition chances
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_shipment_number() IS 'Generates next shipment number in format SOYYNNNNN (e.g., SO2600064)';

-- ============================================
-- 3. DATA MIGRATION - UPDATE EXISTING RECORDS
-- ============================================

-- Update existing Shipment numbers from SH-2026-NNNNN to SOYYNNNNN
-- Example: SH-2026-00010 → SO2600010
UPDATE shipments
SET shipment_number =
  'SO' ||
  SUBSTRING(shipment_number FROM 7 FOR 2) ||  -- Extract year: position 7-8 (26 from SH-2026-)
  SUBSTRING(shipment_number FROM 10 FOR 5)     -- Extract sequence: position 10-14 (00010)
WHERE shipment_number ~ '^SH-20\d{2}-\d{5}$'
  AND deleted_at IS NULL;

-- Handle historical import data with SO6-NNNN format
-- Example: SO6-0024 → SO2600024
UPDATE shipments
SET shipment_number =
  'SO26' ||
  LPAD(
    REGEXP_REPLACE(shipment_number, '^SO6-', '', 'g'),  -- Remove SO6- prefix
    5,
    '0'
  )
WHERE shipment_number ~ '^SO6-\d+'
  AND deleted_at IS NULL;

-- CATCH-ALL: Handle ANY remaining format that doesn't match SOYYNNNNN
-- This ensures no rows are left in invalid format before adding constraint
UPDATE shipments
SET shipment_number =
  'SO' ||
  TO_CHAR(EXTRACT(YEAR FROM COALESCE(eta_to_port, created_at)), 'YY') ||  -- Get year from date
  LPAD(
    COALESCE(
      NULLIF(REGEXP_REPLACE(shipment_number, '[^0-9]', '', 'g'), ''),  -- Extract numbers if exist
      '1'  -- Default to 00001 if no numbers found
    )::TEXT,
    5,
    '0'
  )
WHERE shipment_number !~ '^SO\d{7}$'  -- Doesn't match correct format
  AND deleted_at IS NULL;

-- Update existing Quote numbers from QT-2026-NNNNN to QT-2600NNNNN
-- Example: QT-2026-00023 → QT-2600023
UPDATE quotes
SET quote_number =
  'QT-' ||
  SUBSTRING(quote_number FROM 7 FOR 2) ||  -- Extract year: position 7-8 (26 from QT-2026-)
  SUBSTRING(quote_number FROM 10 FOR 5)     -- Extract sequence: position 10-14 (00023)
WHERE quote_number ~ '^QT-20\d{2}-\d{5}$'
  AND deleted_at IS NULL;

-- Update existing Sales Order numbers from SO-2026-NNNNN to C-SO-2600NNNNN
-- Example: SO-2026-00012 → C-SO-2600012
UPDATE sales_orders
SET order_number =
  'C-SO-' ||
  SUBSTRING(order_number FROM 7 FOR 2) ||  -- Extract year: position 7-8 (26 from SO-2026-)
  SUBSTRING(order_number FROM 10 FOR 5)     -- Extract sequence: position 10-14 (00012)
WHERE order_number ~ '^SO-20\d{2}-\d{5}$'
  AND deleted_at IS NULL;

-- Also update Sales Orders that are missing C-SO prefix but already have correct year format
-- Example: SO2600023 → C-SO-2600023
UPDATE sales_orders
SET order_number = 'C-' || order_number
WHERE order_number ~ '^SO\d{7}$'
  AND order_number !~ '^C-SO'
  AND deleted_at IS NULL;

-- ============================================
-- 4. ADD NEW CONSTRAINT WITH CORRECT FORMAT
-- ============================================

-- Add new constraint for shipment number format: SOYYNNNNN
ALTER TABLE shipments
ADD CONSTRAINT shipments_number_format
CHECK (shipment_number ~ '^SO\d{7}$');

-- ============================================
-- NOTES:
-- ============================================
-- All formats now match Jenny's documents exactly:
--
-- Shipment Numbers:  SO2600064      (Galileo load numbers - shipments.shipment_number)
-- Purchase Orders:   PO-2600064     (internal POs - purchase_orders.po_number)
-- Quotes:            QT-2600064     (customer quotes - quotes.quote_number)
-- Sales Orders:      C-SO-2600064   (customer orders - sales_orders.order_number)
--
-- Format pattern:
--   - Shipments: SOYYNNNNN (no dashes)
--   - PO/QT/SO: PREFIX-YYNNNNN (with dashes)
--   - YY = last 2 digits of year (2026 = 26)
--   - NNNNN = 5-digit sequential number (00001, 00064, etc.)
--
-- Historical data handling:
--   - Old format SH-2026-00010 → SO2600010
--   - Historical SO6-0024 → SO2600024
--   - Non-standard formats → SO2600001 (uses year from eta_to_port or created_at)
