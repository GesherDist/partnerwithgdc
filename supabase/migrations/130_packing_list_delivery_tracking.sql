-- ============================================
-- MIGRATION: 130_packing_list_delivery_tracking.sql
-- PURPOSE: Add delivery tracking fields to packing_lists (replace shipment for warehouse orders)
-- AUTHOR: System
-- DATE: 2024-09-21
-- DESCRIPTION: Warehouse orders don't need separate shipment records - packing list tracking is enough
-- ============================================

-- ============================================
-- 1. ADD DELIVERY TRACKING FIELDS TO PACKING LISTS
-- ============================================

-- Add delivery tracking columns
ALTER TABLE packing_lists
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS carrier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipped_date DATE,
  ADD COLUMN IF NOT EXISTS delivered_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Add index for tracking number lookup
CREATE INDEX IF NOT EXISTS idx_packing_lists_tracking ON packing_lists(tracking_number)
  WHERE tracking_number IS NOT NULL;

-- Add index for delivery dates
CREATE INDEX IF NOT EXISTS idx_packing_lists_shipped_date ON packing_lists(shipped_date)
  WHERE shipped_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_packing_lists_delivered_date ON packing_lists(delivered_date)
  WHERE delivered_date IS NOT NULL;

-- ============================================
-- 2. UPDATE PACKING LIST STATUS ENUM - ADD 'delivered'
-- ============================================

-- Add 'delivered' status to enum
ALTER TYPE packing_list_status ADD VALUE IF NOT EXISTS 'delivered';

-- ============================================
-- 3. COMMENTS
-- ============================================

COMMENT ON COLUMN packing_lists.tracking_number IS 'Carrier tracking number (UPS, FedEx, freight company)';
COMMENT ON COLUMN packing_lists.carrier IS 'Shipping carrier name (UPS, FedEx, LTL Freight, etc.)';
COMMENT ON COLUMN packing_lists.shipped_date IS 'Date when packing list was shipped';
COMMENT ON COLUMN packing_lists.delivered_date IS 'Date when delivery was confirmed';
COMMENT ON COLUMN packing_lists.delivery_notes IS 'Delivery confirmation notes, signature, issues, etc.';

-- ============================================
-- ROLLBACK NOTES
-- ============================================
-- To rollback this migration:
-- DROP INDEX IF EXISTS idx_packing_lists_delivered_date;
-- DROP INDEX IF EXISTS idx_packing_lists_shipped_date;
-- DROP INDEX IF EXISTS idx_packing_lists_tracking;
-- ALTER TABLE packing_lists DROP COLUMN IF EXISTS delivery_notes;
-- ALTER TABLE packing_lists DROP COLUMN IF EXISTS delivered_date;
-- ALTER TABLE packing_lists DROP COLUMN IF EXISTS shipped_date;
-- ALTER TABLE packing_lists DROP COLUMN IF EXISTS carrier;
-- ALTER TABLE packing_lists DROP COLUMN IF EXISTS tracking_number;
-- Note: Cannot remove enum value 'delivered' once added (PostgreSQL limitation)
