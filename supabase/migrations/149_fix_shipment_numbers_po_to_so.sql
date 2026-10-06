-- ============================================
-- Migration: Fix Shipment Numbers (PO to SO)
-- Date: 2026-10-06
-- Description: Convert shipment numbers from PO format to SO format (Load Number)
-- ============================================

-- Step 1: Update shipment numbers from PO format to SO format
-- Use supplier_reference_number (Load Number) as shipment number
UPDATE shipments
SET shipment_number = supplier_reference_number
WHERE shipment_number LIKE 'PO%'
  AND supplier_reference_number IS NOT NULL
  AND supplier_reference_number LIKE 'SO%';

-- Step 2: Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Count updated shipments
  SELECT COUNT(*) INTO updated_count
  FROM shipments
  WHERE shipment_number LIKE 'SO%'
    AND supplier_reference_number IS NOT NULL;

  RAISE NOTICE '✅ Migration 149 completed successfully';
  RAISE NOTICE 'Updated % shipments from PO to SO format', updated_count;
  RAISE NOTICE 'Shipment numbers now use Load Number (SO2600057) instead of PO number';
END $$;
