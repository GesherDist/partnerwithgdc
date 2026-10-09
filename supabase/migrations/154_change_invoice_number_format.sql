-- Change Invoice Number Format
-- From: INV-YYYY-NNNNN (e.g., INV-2026-00002)
-- To: INV-XXXXX (e.g., INV-00001)

-- Drop old check constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_number_format;

-- Add new check constraint that accepts both old and new formats
ALTER TABLE invoices ADD CONSTRAINT invoices_number_format
  CHECK (invoice_number ~ '^INV-[0-9]{5}$' OR invoice_number ~ '^INV-[0-9]{4}-[0-9]{5}$');

-- Update the function to generate new format
DROP FUNCTION IF EXISTS generate_invoice_number();

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  max_num INTEGER;
  next_num INTEGER;
BEGIN
  -- Find highest invoice number (extract numeric part after 'INV-')
  SELECT COALESCE(
    MAX(
      CAST(
        CASE
          -- Handle new format: INV-XXXXX
          WHEN invoice_number ~ '^INV-\d{5}$' THEN
            SUBSTRING(invoice_number FROM 'INV-(\d{5})')
          -- Handle old format: INV-YYYY-XXXXX (take the last 5 digits)
          WHEN invoice_number ~ '^INV-\d{4}-\d{5}$' THEN
            SUBSTRING(invoice_number FROM 'INV-\d{4}-(\d{5})')
          ELSE NULL
        END AS INTEGER
      )
    ),
    0
  ) INTO max_num
  FROM invoices
  WHERE invoice_number IS NOT NULL;

  next_num := max_num + 1;

  RETURN 'INV-' || LPAD(next_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_invoice_number() IS 'Generates next invoice number in format INV-XXXXX (global sequence)';
