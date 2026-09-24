-- ============================================
-- MIGRATION: 129_fix_shipment_number_generation.sql
-- PURPOSE: Fix shipment number generation to avoid duplicates
-- AUTHOR: System
-- DATE: 2024-09-21
-- ============================================

-- Drop old function
DROP FUNCTION IF EXISTS generate_shipment_number();

-- Drop old sequence (not needed anymore)
DROP SEQUENCE IF EXISTS shipment_number_seq;

-- Create new function that checks existing shipments for current year
CREATE OR REPLACE FUNCTION generate_shipment_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  current_year TEXT;
  max_num INTEGER;
  next_num INTEGER;
  new_number VARCHAR(50);
  attempt_count INTEGER := 0;
  max_attempts INTEGER := 100;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');

  -- Loop until we find a unique number (with safety limit)
  LOOP
    -- Find the maximum number for current year
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(shipment_number FROM 'SH-' || current_year || '-([0-9]{5})')
        AS INTEGER
      )
    ), 0)
    INTO max_num
    FROM shipments
    WHERE shipment_number LIKE 'SH-' || current_year || '-%'
      AND deleted_at IS NULL;

    -- Generate next number
    next_num := COALESCE(max_num, 0) + 1;
    new_number := 'SH-' || current_year || '-' || LPAD(next_num::TEXT, 5, '0');

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

COMMENT ON FUNCTION generate_shipment_number() IS 'Generates next shipment number in format SH-YYYY-NNNNN, checking for duplicates';
