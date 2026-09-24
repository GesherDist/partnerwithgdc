-- ============================================
-- MIGRATION: 111_add_actual_delivery_date.sql
-- PURPOSE: Add actual_delivery_date to shipments table
-- AUTHOR: System
-- DATE: 2026-09-10
-- DEPENDS ON: 071_shipments_operations_fields.sql
-- ============================================

-- Add actual_delivery_date column to shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;

COMMENT ON COLUMN shipments.actual_delivery_date IS 'Actual date when shipment was delivered to customer';

-- Add index for delivery date queries
CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments(actual_delivery_date) WHERE deleted_at IS NULL;

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_shipments_actual_delivery;
-- ALTER TABLE shipments DROP COLUMN IF EXISTS actual_delivery_date;
