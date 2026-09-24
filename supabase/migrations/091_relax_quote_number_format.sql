-- Migration: Relax quote number format constraint
-- Purpose: Allow custom quote numbers (not just auto-generated QT-YYYY-NNNNN format)
-- Date: 2025-08-26

-- Drop the strict format constraint
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_number_format;

-- Add a new flexible constraint (just ensure it's not empty and has reasonable length)
ALTER TABLE quotes ADD CONSTRAINT quotes_number_not_empty
  CHECK (quote_number IS NOT NULL AND LENGTH(TRIM(quote_number)) > 0 AND LENGTH(quote_number) <= 50);

-- Add comment for documentation
COMMENT ON CONSTRAINT quotes_number_not_empty ON quotes IS
  'Quote number must be non-empty and max 50 characters. Custom formats allowed.';
