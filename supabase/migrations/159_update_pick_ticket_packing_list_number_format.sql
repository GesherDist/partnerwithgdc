-- ============================================
-- MIGRATION: 159_update_pick_ticket_packing_list_number_format.sql
-- PURPOSE: Update Pick Ticket and Packing List number format to match SO/PO format
-- OLD FORMAT: PT-2026-00001, PL-2026-00001 (full year)
-- NEW FORMAT: PT-2600001, PL-2600001 (2-digit year + sequence)
-- DATE: 2026-10-12
-- ============================================

-- ============================================
-- DROP OLD CONSTRAINTS
-- ============================================

-- Remove old format constraints
ALTER TABLE pick_tickets DROP CONSTRAINT IF EXISTS pick_tickets_number_format;
ALTER TABLE packing_lists DROP CONSTRAINT IF EXISTS packing_lists_number_format;

-- ============================================
-- ADD NEW CONSTRAINTS
-- ============================================

-- New format: PT-YYXXXXX (e.g., PT-2600001)
ALTER TABLE pick_tickets
ADD CONSTRAINT pick_tickets_number_format
CHECK (pick_ticket_number ~ '^PT-[0-9]{7,}$');

-- New format: PL-YYXXXXX (e.g., PL-2600001)
ALTER TABLE packing_lists
ADD CONSTRAINT packing_lists_number_format
CHECK (packing_list_number ~ '^PL-[0-9]{7,}$');

-- ============================================
-- UPDATE SEQUENCES TO START FROM APPROPRIATE NUMBER
-- ============================================

-- Reset sequences to start from a higher number to avoid conflicts
-- Using 60001 as base (so first number will be 2600001 for year 2026)
SELECT setval('pick_ticket_number_seq', 60001, false);
SELECT setval('packing_list_number_seq', 60001, false);

-- ============================================
-- UPDATE NUMBER GENERATION FUNCTIONS
-- ============================================

-- Function to generate pick ticket number in new format
-- Format: PT-YYXXXXX (e.g., PT-2600001)
CREATE OR REPLACE FUNCTION generate_pick_ticket_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  -- Get 2-digit year (26 for 2026)
  year_prefix := TO_CHAR(NOW(), 'YY');

  -- Get next sequence number
  seq_num := NEXTVAL('pick_ticket_number_seq');

  -- Format: PT-YYXXXXX (e.g., PT-2600001)
  RETURN 'PT-' || year_prefix || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_pick_ticket_number() IS 'Generates next pick ticket number in format PT-YYXXXXX (e.g., PT-2600001)';

-- Function to generate packing list number in new format
-- Format: PL-YYXXXXX (e.g., PL-2600001)
CREATE OR REPLACE FUNCTION generate_packing_list_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  -- Get 2-digit year (26 for 2026)
  year_prefix := TO_CHAR(NOW(), 'YY');

  -- Get next sequence number
  seq_num := NEXTVAL('packing_list_number_seq');

  -- Format: PL-YYXXXXX (e.g., PL-2600001)
  RETURN 'PL-' || year_prefix || LPAD(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_packing_list_number() IS 'Generates next packing list number in format PL-YYXXXXX (e.g., PL-2600001)';

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN pick_tickets.pick_ticket_number IS 'Unique pick ticket number in format PT-YYXXXXX (e.g., PT-2600001)';
COMMENT ON COLUMN packing_lists.packing_list_number IS 'Unique packing list number in format PL-YYXXXXX (e.g., PL-2600001)';
