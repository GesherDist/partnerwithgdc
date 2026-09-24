-- Fix PO number sequence to be in sync with existing PO numbers
-- This resets the sequence to the next available number

DO $$
DECLARE
  max_seq INTEGER;
BEGIN
  -- Find the highest sequence number from existing POs
  -- PO format is: PO-YYYY-NNNNN (e.g., PO-2026-00025)
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(po_number FROM 'PO-[0-9]{4}-([0-9]+)')
        AS INTEGER
      )
    ),
    0
  ) INTO max_seq
  FROM purchase_orders
  WHERE po_number ~ '^PO-[0-9]{4}-[0-9]+$';

  -- Reset the sequence to max + 1
  PERFORM setval('po_number_seq', max_seq + 1, false);

  RAISE NOTICE 'PO number sequence reset to %', max_seq + 1;
END $$;
