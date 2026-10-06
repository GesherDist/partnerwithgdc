-- ============================================
-- Migration: Add Remaining Load Statuses
-- Date: 2026-10-06
-- Description: Add 6 missing statuses to load_status enum for Operations Dashboard (GDC 0, GDC 1, GDC 2)
-- ============================================

-- Add missing statuses to load_status enum
-- Current: available, sold, open, hold, in_transit, invoiced
-- Adding: not_invoiced, closed, po_needed, partially_paid, paid, disputed

ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'not_invoiced';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'po_needed';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'partially_paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE load_status ADD VALUE IF NOT EXISTS 'disputed';

-- Add comments
COMMENT ON TYPE load_status IS 'Operations status for load/shipment tracking (12 statuses for GDC 0, GDC 1, GDC 2)';
