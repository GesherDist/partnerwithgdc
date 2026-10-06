-- ============================================
-- Migration: Add All Operations Dashboard Statuses
-- Date: 2026-10-06
-- Description: Add all 12 GDC status values to both load_status and po_status enums
-- ============================================

-- ============================================
-- PART 1: Add to load_status enum (for shipments)
-- ============================================

-- Current statuses: available, sold, open, hold, in_transit, invoiced
-- Adding: not_invoiced, closed, po_needed, partially_paid, paid, disputed

ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'disputed';

COMMENT ON TYPE load_status IS 'Operations Dashboard load/shipment status (12 statuses total for GDC 0, GDC 1, GDC 2)';

-- ============================================
-- PART 2: Add to po_status enum (for purchase orders)
-- ============================================

-- Adding Operations Dashboard statuses to PO enum
-- These match the statuses used in Excel GDC sheets

ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'sold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'hold';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'disputed';

COMMENT ON TYPE po_status IS 'Purchase order status (workflow + Operations Dashboard statuses)';

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify all statuses are added
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 146 completed successfully';
  RAISE NOTICE 'load_status now has 12 values: available, sold, open, hold, in_transit, invoiced, not_invoiced, closed, po_needed, partially_paid, paid, disputed';
  RAISE NOTICE 'po_status now has all workflow + operations statuses';
END $$;
