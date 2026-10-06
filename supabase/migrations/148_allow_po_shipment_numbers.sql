-- ============================================
-- Migration: Allow PO Numbers as Shipment Numbers
-- Date: 2026-10-06
-- Description: Update shipment number constraint to accept both SO and PO formats
-- ============================================

-- Drop existing constraint
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_number_format;

-- Add new constraint that accepts both SO and PO formats
-- Format: SO2600057 or PO2600057 (2 letters + 7 digits)
ALTER TABLE shipments
ADD CONSTRAINT shipments_number_format
CHECK (shipment_number ~ '^(SO|PO)\d{7}$');

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 148 completed successfully';
  RAISE NOTICE 'Shipment numbers now accept both SO and PO formats';
  RAISE NOTICE 'Valid formats: SO2600057, PO2600057';
END $$;
